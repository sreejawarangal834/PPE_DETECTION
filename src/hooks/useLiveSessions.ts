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
  /** Backend's own video_id (distinct from the frontend session id) — needed
   * to call DELETE /api/videos/{video_id} on removal. Video sessions only. */
  videoId?: string;
}

function teardown(handle: SessionHandle): void {
  if (handle.captureTimer !== undefined) window.clearInterval(handle.captureTimer);
  handle.stream?.getTracks().forEach((t) => t.stop());
  try {
    handle.ws?.close();
  } catch {
    // already closed
  }
  if (handle.videoId) {
    fetch(`/api/videos/${handle.videoId}`, { method: "DELETE" }).catch(() => {});
  }
}

/**
 * Decode the intrinsic pixel dimensions of a base64 JPEG string.
 * Fires the callback asynchronously once the Image has loaded.
 * Used so BoundingBoxCanvas can correct for object-contain letterboxing.
 */
function decodeJpegDimensions(
  b64: string,
  cb: (w: number, h: number) => void,
): void {
  const img = new Image();
  img.onload = () => cb(img.naturalWidth, img.naturalHeight);
  img.src = `data:image/jpeg;base64,${b64}`;
}

export function useLiveSessions() {
  const { upsertSession, removeSession, removeAllSessions } = useDetectionStore();
  const handlesRef = useRef<Map<string, SessionHandle>>(new Map());

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

  const startVideoSession = useCallback(async (file: File, cameraId?: string): Promise<string> => {
    const id = `video-${crypto.randomUUID()}`;
    const handle: SessionHandle = {};
    handlesRef.current.set(id, handle);
    const isCurrent = () => handlesRef.current.get(id) === handle;

    upsertSession(id, () => ({
      id, kind: "video", name: file.name, status: "uploading", cameraId,
      detections: [], severity: "info", violations: [], frameIndex: 0,
    }));

    try {
      const form = new FormData();
      form.append("file", file);
      if (cameraId) form.append("camera_id", cameraId);
      const res = await fetch("/api/videos/upload", { method: "POST", body: form });
      if (!isCurrent()) return id;
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      const { video_id } = (await res.json()) as { video_id: string };
      if (!isCurrent()) return id;
      handle.videoId = video_id;

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
          // Decode intrinsic JPEG dimensions so BoundingBoxCanvas can correct
          // for object-contain letterboxing. Done async — a frame or two
          // behind is fine because dimensions are stable for a whole video.
          if (frame.jpeg) {
            decodeJpegDimensions(frame.jpeg, (w, h) => {
              if (isCurrent()) upsertSession(id, (prev) => ({ ...prev!, imageW: w, imageH: h }));
            });
          }
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

  const startWebcamSession = useCallback(async (cameraId?: string): Promise<string> => {
    stopSession(WEBCAM_SESSION_ID);
    const id = WEBCAM_SESSION_ID;
    const handle: SessionHandle = {};
    handlesRef.current.set(id, handle);
    const isCurrent = () => handlesRef.current.get(id) === handle;

    upsertSession(id, () => ({
      id, kind: "webcam", name: "Browser Webcam", status: "connecting", cameraId,
      detections: [], severity: "info", violations: [], frameIndex: 0,
    }));

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: LIVE_CAPTURE_WIDTH, height: LIVE_CAPTURE_HEIGHT },
        audio: false,
      });
      if (!isCurrent()) {
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
      const query = cameraId ? `?camera_id=${encodeURIComponent(cameraId)}` : "";
      const ws = new WebSocket(`${proto}://${window.location.host}/ws/detect/live${query}`);
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
          // Webcam: backend sends back the inferred frame as jpeg too —
          // use known capture dimensions directly (no async decode needed).
          upsertSession(id, (prev) => ({
            ...prev!,
            status:     "streaming",
            imageW:     LIVE_CAPTURE_WIDTH,
            imageH:     LIVE_CAPTURE_HEIGHT,
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

  const startRtspSession = useCallback(async (url: string, cameraId?: string): Promise<string> => {
    const id = `rtsp-${crypto.randomUUID()}`;
    const handle: SessionHandle = {};
    handlesRef.current.set(id, handle);
    const isCurrent = () => handlesRef.current.get(id) === handle;

    upsertSession(id, () => ({
      id, kind: "rtsp", name: url, status: "connecting", cameraId,
      detections: [], severity: "info", violations: [], frameIndex: 0,
    }));

    try {
      if (!url.startsWith("rtsp://")) throw new Error("URL must start with rtsp://");

      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      const params = new URLSearchParams({ url });
      if (cameraId) params.set("camera_id", cameraId);
      const ws = new WebSocket(`${proto}://${window.location.host}/ws/detect/rtsp?${params}`);
      handle.ws = ws;

      ws.onopen = () => { if (isCurrent()) upsertSession(id, (prev) => ({ ...prev!, status: "streaming" })); };
      ws.onmessage = (ev) => {
        if (!isCurrent()) return;
        const data = JSON.parse(ev.data) as FrameMessage | { type: "done" | "error"; message?: string };
        if (data.type === "frame") {
          const frame = data as FrameMessage;
          // Decode intrinsic JPEG dimensions for object-contain correction.
          if (frame.jpeg) {
            decodeJpegDimensions(frame.jpeg, (w, h) => {
              if (isCurrent()) upsertSession(id, (prev) => ({ ...prev!, imageW: w, imageH: h }));
            });
          }
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

  return { startVideoSession, startWebcamSession, startRtspSession, stopSession, stopAllSessions };
}

export type { LiveSession };
export { WEBCAM_SESSION_ID };
