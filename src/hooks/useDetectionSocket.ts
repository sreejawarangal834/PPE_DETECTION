import { useCallback, useEffect, useRef, useState } from "react";
import type { Severity } from "../constants/severity";

export interface Detection {
  label: string;
  conf: number;
  box: [number, number, number, number];
  /** Set by backend compliance engine — true for PPE items and compliant body parts */
  compliant?: boolean;
}

export interface FrameMessage {
  type: "frame";
  frameIndex: number;
  jpeg: string;
  detections: Detection[];
  severity: Severity;
  violations: string[];
}

export type SocketState = "idle" | "uploading" | "connecting" | "streaming" | "done" | "error";

/**
 * Transport for the detection pipeline: upload a video, open the
 * per-video WebSocket, and surface each decoded frame message as it
 * arrives. Swapping this for an RTSP source later only means changing
 * what `start` does internally (e.g. hitting a "connect to camera"
 * endpoint instead of an upload) — callers just keep reading `latest`.
 */
export function useDetectionSocket() {
  const [state, setState] = useState<SocketState>("idle");
  const [latest, setLatest] = useState<FrameMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const start = useCallback(async (file: File) => {
    wsRef.current?.close();
    setError(null);
    setLatest(null);
    setState("uploading");

    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/videos/upload", { method: "POST", body: form });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      const { video_id } = (await res.json()) as { video_id: string };

      setState("connecting");
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(`${proto}://${window.location.host}/ws/detect/${video_id}`);
      wsRef.current = ws;

      ws.onopen = () => setState("streaming");
      ws.onmessage = (ev) => {
        const data = JSON.parse(ev.data);
        if (data.type === "frame") {
          setLatest(data as FrameMessage);
        } else if (data.type === "done") {
          setState("done");
        } else if (data.type === "error") {
          setState("error");
          setError(data.message ?? "Detection pipeline error");
        }
      };
      ws.onerror = () => setState("error");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  }, []);

  useEffect(() => {
    return () => wsRef.current?.close();
  }, []);

  return { state, latest, error, start };
}
