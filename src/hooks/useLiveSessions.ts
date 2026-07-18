import { useCallback, useEffect, useRef } from "react";
import { useDetectionStore, type LiveSession } from "../state/DetectionStore";
import type { FrameMessage } from "./useDetectionSocket";

const LIVE_CAPTURE_WIDTH = 640;
const LIVE_CAPTURE_HEIGHT = 480;
const LIVE_CAPTURE_INTERVAL_MS = 150; // ~6-7 fps pushed to the backend per webcam session
const LIVE_JPEG_QUALITY = 0.7;

const WEBCAM_SESSION_ID = "webcam";

interface SessionHandle {
  ws?: WebSocket;
  stream?: MediaStream;
  captureTimer?: number;
}

function teardown(handle: SessionHandle): void {
  if (handle.captureTimer !== undefined) window.clearInterval(handle.captureTimer);
  handle.stream?.getTracks().forEach((t) => t.stop());
  try {
    handle.ws?.close();
  } catch {
    // already closed
  }
}

/**
 * Manages any number of concurrent detection sessions — multiple uploaded
 * videos plus (at most) one browser-webcam session — each with its own
 * WebSocket connection. Every session writes its frames into DetectionStore
 * under its own id, so they render independently (e.g. one card per session
 * in Grid View) instead of one session overwriting another.
 *
 * Each `start*Session` registers its `SessionHandle` in `handlesRef`
 * *synchronously*, before any `await` — every subsequent resume point
 * re-checks `isCurrent()` (handlesRef still holds *this* handle for this id)
 * before touching the store or acquiring more resources. This is what makes
 * "stop a session that's still uploading/connecting" and "double-click
 * start a new webcam session before the first finishes" both safe: a
 * superseded call finds itself no longer current, releases anything it just
 * acquired (e.g. a MediaStream), and quietly stops instead of clobbering
 * whatever replaced it or writing into a session the user already dismissed.
 */
export function useLiveSessions() {
  const { upsertSession, removeSession, removeAllSessions } = useDetectionStore();
  const handlesRef = useRef<Map<string, SessionHandle>>(new Map());

  /**
   * Tear down the session at `id`. When `expected` is given, only tears it
   * down if it's still the same handle — a closed/replaced socket's late
   * `onclose`/`onerror` firing after a *newer* session has already taken
   * over that id must not reap the new one.
   */
  const stopSession = useCallback((id: string, expected?: SessionHandle) => {
    const handle = handlesRef.current.get(id);
    if (!handle) return;
    if (expected && handle !== expected) return;
    handlesRef.current.delete(id);
    teardown(handle);
    removeSession(id);
  }, [removeSession]);

  const stopAllSessions = useCallback(() => {
    for (const handle of handlesRef.current.values()) teardown(handle);
    handlesRef.current.clear();
    removeAllSessions();
  }, [removeAllSessions]);

  /** Upload a video file and start an independent detection session for it. Returns its session id. */
  const startVideoSession = useCallback(async (file: File): Promise<string> => {
    const id = `video-${crypto.randomUUID()}`;
    const handle: SessionHandle = {};
    handlesRef.current.set(id, handle);
    const isCurrent = () => handlesRef.current.get(id) === handle;

    upsertSession(id, () => ({
      id, kind: "video", name: file.name, status: "uploading",
      detections: [], severity: "info", violations: [], frameIndex: 0,
    }));

    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/videos/upload", { method: "POST", body: form });
      if (!isCurrent()) return id; // stopped while uploading
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      const { video_id } = (await res.json()) as { video_id: string };
      if (!isCurrent()) return id; // stopped while parsing the response

      upsertSession(id, (prev) => ({ ...prev!, status: "connecting" }));
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(`${proto}://${window.location.host}/ws/detect/${video_id}`);
      handle.ws = ws;

      ws.onopen = () => { if (isCurrent()) upsertSession(id, (prev) => ({ ...prev!, status: "streaming" })); };
      ws.onmessage = (ev) => {
        if (!isCurrent()) return;
        const data = JSON.parse(ev.data) as FrameMessage | { type: "done" | "error"; message?: string };
        if (data.type === "frame") {
          const frame = data as FrameMessage;
          upsertSession(id, (prev) => ({
            ...prev!,
            status:     "streaming",
            jpeg:       frame.jpeg,
            detections: frame.detections,
            severity:   frame.severity,
            violations: frame.violations,
            frameIndex: frame.frameIndex,
          }));
        } else if (data.type === "done") {
          upsertSession(id, (prev) => ({ ...prev!, status: "done" }));
        } else if (data.type === "error") {
          upsertSession(id, (prev) => ({ ...prev!, status: "error" }));
        }
      };
      ws.onerror = () => { if (isCurrent()) upsertSession(id, (prev) => ({ ...prev!, status: "error" })); };
      ws.onclose = () => stopSession(id, handle);
    } catch {
      if (isCurrent()) upsertSession(id, (prev) => ({ ...prev!, status: "error" }));
    }
    return id;
  }, [upsertSession, stopSession]);

  /** Capture the browser's own webcam and stream frames to the backend for inference. Returns its session id. */
  const startWebcamSession = useCallback(async (): Promise<string> => {
    stopSession(WEBCAM_SESSION_ID); // supersede whatever's currently there — real session or a racing in-flight attempt
    const id = WEBCAM_SESSION_ID;
    const handle: SessionHandle = {};
    handlesRef.current.set(id, handle);
    const isCurrent = () => handlesRef.current.get(id) === handle;

    upsertSession(id, () => ({
      id, kind: "webcam", name: "Browser Webcam", status: "connecting",
      detections: [], severity: "info", violations: [], frameIndex: 0,
    }));

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: LIVE_CAPTURE_WIDTH, height: LIVE_CAPTURE_HEIGHT },
        audio: false,
      });
      if (!isCurrent()) {
        // Superseded while the permission prompt was open — release the camera we just acquired.
        mediaStream.getTracks().forEach((t) => t.stop());
        return id;
      }
      handle.stream = mediaStream;
      upsertSession(id, (prev) => ({ ...prev!, stream: mediaStream }));

      const videoEl = document.createElement("video");
      videoEl.muted = true;
      videoEl.playsInline = true;
      videoEl.srcObject = mediaStream;
      await videoEl.play();
      if (!isCurrent()) {
        mediaStream.getTracks().forEach((t) => t.stop());
        return id;
      }

      const canvas = document.createElement("canvas");
      canvas.width = LIVE_CAPTURE_WIDTH;
      canvas.height = LIVE_CAPTURE_HEIGHT;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas 2D context unavailable");

      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(`${proto}://${window.location.host}/ws/detect/live`);
      handle.ws = ws;

      let sending = false;
      const sendFrame = () => {
        if (ws.readyState !== WebSocket.OPEN || sending) return;
        sending = true;
        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob && ws.readyState === WebSocket.OPEN) ws.send(blob);
          sending = false;
        }, "image/jpeg", LIVE_JPEG_QUALITY);
      };

      ws.onopen = () => {
        if (!isCurrent()) return;
        upsertSession(id, (prev) => ({ ...prev!, status: "streaming" }));
        handle.captureTimer = window.setInterval(sendFrame, LIVE_CAPTURE_INTERVAL_MS);
      };
      ws.onmessage = (ev) => {
        if (!isCurrent()) return;
        const data = JSON.parse(ev.data) as FrameMessage | { type: "error"; message?: string };
        if (data.type === "frame") {
          const frame = data as FrameMessage;
          upsertSession(id, (prev) => ({
            ...prev!,
            status:     "streaming",
            detections: frame.detections,
            severity:   frame.severity,
            violations: frame.violations,
            frameIndex: frame.frameIndex,
          }));
        } else if (data.type === "error") {
          upsertSession(id, (prev) => ({ ...prev!, status: "error" }));
        }
      };
      ws.onerror = () => { if (isCurrent()) upsertSession(id, (prev) => ({ ...prev!, status: "error" })); };
      ws.onclose = () => stopSession(id, handle);
    } catch {
      if (isCurrent()) {
        upsertSession(id, (prev) => ({ ...prev!, status: "error" }));
        handlesRef.current.delete(id);
      }
    }
    return id;
  }, [upsertSession, stopSession]);

  useEffect(() => {
    const handles = handlesRef.current;
    return () => {
      for (const handle of handles.values()) teardown(handle);
      handles.clear();
    };
  }, []);

  return { startVideoSession, startWebcamSession, stopSession, stopAllSessions };
}

export type { LiveSession };
export { WEBCAM_SESSION_ID };
