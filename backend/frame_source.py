"""
Frame source abstraction.

The detection loop in main.py only depends on this interface, not on where
frames come from. FileVideoSource (uploaded video files) and RTSPSource
(live RTSP streams — IP cameras, or a phone running an RTSP-server app)
both implement the same `frames()` generator and plug into the same
WebSocket handler unchanged.

The read loop itself mirrors the frameextraction branch's
extract_frames.py (cv2.VideoCapture, read until ret is False), except frames
are handed off in-memory for inference instead of being written to disk.
"""

from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Callable, Iterator, Protocol

import cv2
import numpy as np
import redis as redis_sync

log = logging.getLogger("ppe_backend.frame_source")


class FrameSource(Protocol):
    def frames(self) -> Iterator[np.ndarray]: ...
    def cleanup(self) -> None: ...


class FileVideoSource:
    def __init__(
        self,
        path: Path,
        loop: bool = True,
        on_loop: Callable[[], None] | None = None,
    ) -> None:
        self.path = path
        self.loop = loop
        self.on_loop = on_loop
        # Read (and re-read on every loop reopen) from the capture itself —
        # frame_reader in main.py paces playback to whatever this reports.
        self.fps: float = 0.0

    def frames(self) -> Iterator[np.ndarray]:
        first = True
        while True:
            cap = cv2.VideoCapture(str(self.path))
            if not cap.isOpened():
                raise RuntimeError(f"Could not open video: {self.path}")
            self.fps = cap.get(cv2.CAP_PROP_FPS) or 0.0
            try:
                while True:
                    ret, frame = cap.read()
                    if not ret:
                        break
                    yield frame
            finally:
                cap.release()
            if not self.loop:
                break
            # Reopening (rather than seeking to frame 0) sidesteps codecs/VFR
            # files that mishandle CAP_PROP_POS_FRAMES — reopen cost is
            # negligible next to per-frame inference time.
            if not first and self.on_loop:
                self.on_loop()
            first = False

    def cleanup(self) -> None:
        """Remove the uploaded file backing this session once it ends."""
        self.path.unlink(missing_ok=True)


class RTSPSource:
    """
    Live RTSP stream — an IP camera, or a phone running an RTSP-server app
    (e.g. "IP Webcam" on Android, "RTSP Camera Server" on iOS) on the same
    network.

    Unlike an uploaded file, an RTSP stream has no natural end: a dropped
    connection (wifi blip, phone screen lock, app backgrounded) should be
    retried rather than treated as EOF, so `frames()` reconnects internally
    instead of returning control to the caller.
    """

    def __init__(
        self,
        url: str,
        reconnect_delay: float = 2.0,
        max_reconnect_attempts: int | None = None,
        status_callback: Callable[[str], None] | None = None,
    ) -> None:
        self.url = url
        self.reconnect_delay = reconnect_delay
        self.max_reconnect_attempts = max_reconnect_attempts
        # Optional observability hook, e.g. persisting cameras.status
        # (online/reconnecting/offline) — see main.py's detect_rtsp_ws.
        # Fired from whatever thread is driving this generator (main.py
        # advances it via asyncio.to_thread), so callers that need to touch
        # asyncio/DB state from here must hand off thread-safely themselves
        # (see repositories/writer.py's submit_threadsafe).
        self.status_callback = status_callback
        # Left unset (0.0) until a connection succeeds — most RTSP servers
        # (especially phone apps) don't report a reliable FPS up front, so
        # frame_reader's PACE_TO_SOURCE_FPS in main.py falls back to
        # FALLBACK_FPS whenever this stays 0.
        self.fps: float = 0.0
        # Kept only for interface symmetry with FileVideoSource — a live
        # stream has no "loop" concept, so this is never invoked.
        self.on_loop: Callable[[], None] | None = None
        # Settable after construction (main.py wires this to the session's
        # `_stop` asyncio.Event right after creating it — same pattern as
        # `on_loop`). Without this, a client that disconnects while the
        # stream is unreachable can't actually stop this generator: the
        # whole reconnect-forever loop below runs inside ONE call to
        # next(frames()), so main.py's frame_reader never gets a chance to
        # notice `_stop` between iterations until a connection attempt
        # actually succeeds or fails in a way that yields/raises. Checking
        # this callable at each retry/read point closes that gap.
        self.should_stop: Callable[[], bool] | None = None

    def _wants_stop(self) -> bool:
        return self.should_stop is not None and self.should_stop()

    def _notify(self, status: str) -> None:
        if self.status_callback is not None:
            try:
                self.status_callback(status)
            except Exception:
                log.exception("RTSPSource status_callback raised for status=%s", status)

    def frames(self) -> Iterator[np.ndarray]:
        attempt = 0
        while True:
            if self._wants_stop():
                log.info("RTSP source stopping (should_stop) before reconnect attempt: %s", self.url)
                return
            cap = cv2.VideoCapture(self.url, cv2.CAP_FFMPEG)
            # Keep OpenCV's internal buffer to a single frame so a network
            # stall drops stale frames instead of queuing them — a live feed
            # should show "now", not slowly fall behind.
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            if not cap.isOpened():
                cap.release()
                attempt += 1
                if (
                    self.max_reconnect_attempts is not None
                    and attempt > self.max_reconnect_attempts
                ):
                    raise RuntimeError(
                        f"Could not open RTSP stream after {attempt} attempts: {self.url}"
                    )
                log.warning(
                    "RTSP connect failed (attempt %d), retrying in %.1fs: %s",
                    attempt, self.reconnect_delay, self.url,
                )
                self._notify("reconnecting")
                # Sleep in small slices so a client disconnect (should_stop)
                # is noticed within ~0.2s instead of waiting out the full
                # reconnect_delay — matters because this whole retry loop
                # runs inside a single next(frames()) call from main.py's
                # frame_reader, which otherwise has no chance to see `_stop`
                # until a connection attempt actually yields or raises.
                slept = 0.0
                while slept < self.reconnect_delay:
                    if self._wants_stop():
                        return
                    time.sleep(min(0.2, self.reconnect_delay - slept))
                    slept += 0.2
                continue

            self.fps = cap.get(cv2.CAP_PROP_FPS) or 0.0
            attempt = 0
            announced_online = False
            try:
                while True:
                    if self._wants_stop():
                        log.info("RTSP source stopping (should_stop) mid-stream: %s", self.url)
                        return
                    ret, frame = cap.read()
                    if not ret:
                        log.info("RTSP stream ended/dropped, reconnecting: %s", self.url)
                        self._notify("reconnecting")
                        break
                    if not announced_online:
                        # "online" means a frame actually arrived, not just
                        # that cap.isOpened() — a connected-but-silent stream
                        # (e.g. phone app backgrounded right after handshake)
                        # should not read as healthy.
                        self._notify("online")
                        announced_online = True
                    yield frame
            finally:
                cap.release()
            time.sleep(self.reconnect_delay)

    def cleanup(self) -> None:
        """No uploaded file backs a live stream — nothing to remove."""
        pass


class RedisFrameSource:
    """
    Reads frames the platform's Ingestion Layer publishes to the
    `frames:{camera_id}` Redis Stream contract (see Platform Integration strategy).
    Consumes via consumer group `uc3_group` / worker `uc3_worker_1` using XREADGROUP.

    Uses the synchronous `redis` client (not `redis.asyncio`) because `frames()`
    is a blocking generator advanced from a worker thread via `asyncio.to_thread`
    in main.py's frame_reader.
    """

    def __init__(
        self,
        camera_id: str,
        redis_url: str,
        block_timeout_seconds: float = 2.0,
        status_callback: Callable[[str], None] | None = None,
    ) -> None:
        from minio import Minio
        import config

        self.camera_id = camera_id
        self.stream_key = f"frames:{camera_id}"
        self.group_name = "uc3_group"
        self.consumer_name = "uc3_worker_1"
        self._redis = redis_sync.from_url(redis_url, decode_responses=False)
        self.block_timeout_seconds = block_timeout_seconds
        self.status_callback = status_callback
        self.fps: float = 0.0
        self.on_loop: Callable[[], None] | None = None
        self.should_stop: Callable[[], bool] | None = None

        self._minio_client = Minio(
            endpoint=config.MINIO_ENDPOINT,
            access_key=config.MINIO_ACCESS_KEY,
            secret_key=config.MINIO_SECRET_KEY,
            secure=config.MINIO_SECURE,
        )
        self._group_created = False

    def _wants_stop(self) -> bool:
        return self.should_stop is not None and self.should_stop()

    def _notify(self, status: str) -> None:
        if self.status_callback is not None:
            try:
                self.status_callback(status)
            except Exception:
                log.exception("RedisFrameSource status_callback raised for status=%s", status)

    def _ensure_group(self) -> None:
        if not self._group_created:
            try:
                self._redis.xgroup_create(self.stream_key, self.group_name, id="$", mkstream=True)
            except redis_sync.ResponseError as e:
                if "BUSYGROUP" not in str(e):
                    log.warning("XGROUP CREATE warning on %s: %s", self.stream_key, e)
            self._group_created = True

    def frames(self) -> Iterator[np.ndarray]:
        from datetime import datetime, timezone
        from shared.contracts.enums import FrameProvider
        from shared.contracts.frame_event import FrameEvent

        self._ensure_group()
        announced_online = False
        while True:
            if self._wants_stop():
                log.info("Redis frame source stopping (should_stop): %s", self.stream_key)
                return

            try:
                response = self._redis.xreadgroup(
                    groupname=self.group_name,
                    consumername=self.consumer_name,
                    streams={self.stream_key: ">"},
                    count=1,
                    block=int(self.block_timeout_seconds * 1000),
                )
            except redis_sync.RedisError:
                log.exception("Redis error reading %s — retrying in %.1fs", self.stream_key, self.block_timeout_seconds)
                self._notify("reconnecting")
                time.sleep(self.block_timeout_seconds)
                continue

            if not response:
                continue

            for _s_key, messages in response:
                for msg_id, fields in messages:
                    raw_data = fields.get(b"data") or fields.get("data")
                    if raw_data is None:
                        log.warning("No 'data' field in message %s on %s", msg_id, self.stream_key)
                        self._redis.xack(self.stream_key, self.group_name, msg_id)
                        continue

                    if isinstance(raw_data, bytes):
                        raw_data = raw_data.decode("utf-8")

                    try:
                        event = FrameEvent.model_validate_json(raw_data)
                    except Exception as e:
                        log.error("Failed to parse FrameEvent from msg %s: %s", msg_id, e)
                        self._redis.xack(self.stream_key, self.group_name, msg_id)
                        continue

                    now_utc = datetime.now(timezone.utc)
                    msg_ts = event.timestamp
                    if msg_ts.tzinfo is None:
                        msg_ts = msg_ts.replace(tzinfo=timezone.utc)
                    age_seconds = (now_utc - msg_ts).total_seconds()

                    if age_seconds > 5.0:
                        log.debug("Skipping stale frame msg_id=%s age=%.2fs > 5s", msg_id, age_seconds)
                        self._redis.xack(self.stream_key, self.group_name, msg_id)
                        continue

                    jpeg_bytes = None
                    if event.frame_provider == FrameProvider.REDIS:
                        try:
                            jpeg_bytes = self._redis.get(event.frame_reference)
                        except Exception as e:
                            log.warning("Failed GET for redis frame_reference %s: %s", event.frame_reference, e)

                    if jpeg_bytes is None:
                        minio_key = f"frames/{event.camera_id}/{event.frame_seq:08d}.jpg"
                        try:
                            res = self._minio_client.get_object("innovision-frames", minio_key)
                            jpeg_bytes = res.read()
                            res.close()
                            res.release_conn()
                        except Exception as e:
                            log.warning("MinIO get_object failed for bucket 'innovision-frames' key %s: %s", minio_key, e)

                    if jpeg_bytes is None:
                        log.error("Both Redis GET and MinIO download failed for msg_id=%s frame_seq=%s", msg_id, event.frame_seq)
                        self._redis.xack(self.stream_key, self.group_name, msg_id)
                        continue

                    frame = cv2.imdecode(np.frombuffer(jpeg_bytes, dtype=np.uint8), cv2.IMREAD_COLOR)
                    if frame is None:
                        log.warning("Dropped undecodable frame from %s msg_id=%s", self.stream_key, msg_id)
                        self._redis.xack(self.stream_key, self.group_name, msg_id)
                        continue

                    if not announced_online:
                        self._notify("online")
                        announced_online = True

                    try:
                        from metrics import FRAMES_CONSUMED_TOTAL, update_stream_lag
                        FRAMES_CONSUMED_TOTAL.labels(camera_id=str(self.camera_id)).inc()
                        update_stream_lag(self._redis, str(self.camera_id), self.group_name)
                    except Exception:
                        pass

                    try:
                        yield frame
                    finally:
                        try:
                            self._redis.xack(self.stream_key, self.group_name, msg_id)
                        except Exception:
                            log.exception("Failed to XACK message %s", msg_id)

    def cleanup(self) -> None:
        try:
            self._redis.close()
        except Exception:
            pass

