"""
Prometheus metrics definition and lag updater for UC3.
"""

from __future__ import annotations

import logging
from prometheus_client import Counter, Gauge, Histogram

log = logging.getLogger("ppe_backend.metrics")

FRAMES_CONSUMED_TOTAL = Counter(
    "frames_consumed_total",
    "Total frames consumed from stream sources",
    ["camera_id"],
)

ALERTS_PUBLISHED_TOTAL = Counter(
    "alerts_published_total",
    "Total alerts published to platform Redis Stream",
    ["source_uc", "severity", "alert_type"],
)

PROCESSING_LATENCY_SECONDS = Histogram(
    "processing_latency_seconds",
    "Time spent processing a frame through model inference and compliance evaluation",
    ["camera_id"],
)

STREAM_LAG = Gauge(
    "stream_lag",
    "Current consumer group lag on Redis frame streams",
    ["camera_id", "group_name"],
)


def update_stream_lag(redis_client, camera_id: str, group_name: str = "uc3_group") -> None:
    """Helper to update stream_lag gauge using XINFO GROUPS."""
    stream_key = f"frames:{camera_id}"
    try:
        groups = redis_client.xinfo_groups(stream_key)
        for g in groups:
            g_name = g.get("name") or g.get(b"name")
            if isinstance(g_name, bytes):
                g_name = g_name.decode("utf-8")
            if g_name == group_name:
                lag = g.get("lag") or g.get(b"lag")
                if lag is None or lag == -1:
                    lag = g.get("pending") or g.get(b"pending") or 0
                STREAM_LAG.labels(camera_id=camera_id, group_name=group_name).set(int(lag))
                break
    except Exception:
        pass
