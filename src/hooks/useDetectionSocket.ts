import type { Severity } from "../constants/severity";

export interface Detection {
  label: string;
  conf: number;
  box: [number, number, number, number];
  /** Set by backend compliance engine — true for PPE items and compliant body parts */
  compliant?: boolean;
  /** Synthesized from the last real sighting while this tracked person is
   *  briefly undetected (e.g. poor lighting) — not a fresh detection. */
  ghost?: boolean;
}

export interface FrameMessage {
  type: "frame";
  frameIndex: number;
  /** Present for uploaded-video playback; absent for browser-webcam sessions
   *  (the browser already has the frame on-screen via <video>). */
  jpeg?: string;
  detections: Detection[];
  severity: Severity;
  violations: string[];
}

export type SocketState = "idle" | "uploading" | "connecting" | "streaming" | "done" | "error";
