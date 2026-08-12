import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Detection, SocketState } from "../hooks/useDetectionSocket";
import type { Severity } from "../constants/severity";

export interface LiveCamera {
  id: string;
  name: string;
  status: SocketState;
  jpeg?: string;
  /** Set for browser-webcam sessions — rendered directly via <video>, no jpeg round-trip */
  stream?: MediaStream;
  detections: Detection[];
  severity: Severity;
  violations: string[];
  frameIndex: number;
}

/** One concurrently-running detection session — an uploaded video, the
 *  browser webcam, or a live RTSP stream (e.g. a phone running an
 *  RTSP-server app). */
export interface LiveSession extends LiveCamera {
  kind: "video" | "webcam" | "rtsp";
  /** The camera slot (src/types Camera.id) this session is bound to — set when
   * the user picks a slot at upload/webcam-start time (see CameraSlotPicker).
   * Undefined for a session started without picking one. */
  cameraId?: string;
}

const SEVERITY_RANK: Record<Severity, number> = { info: 0, low: 1, medium: 2, high: 3 };

function worstSeverity(severities: Severity[]): Severity {
  return severities.reduce<Severity>(
    (worst, s) => (SEVERITY_RANK[s] > SEVERITY_RANK[worst] ? s : worst),
    "info",
  );
}

interface DetectionStoreValue {
  /** All active sessions (videos + webcam), keyed by session id. */
  sessions: LiveSession[];
  /**
   * Backward-compat single-camera view for widgets that only care about "is
   * something live and what does it show": null when nothing is running, the
   * session itself when exactly one is active, or a merged read-only summary
   * (detections/violations/severity pooled across sessions) when several are
   * running at once — those widgets don't render jpeg/stream directly, so a
   * merged view is enough for them.
   */
  liveCamera: LiveCamera | null;
  upsertSession: (id: string, updater: (prev: LiveSession | undefined) => LiveSession) => void;
  removeSession: (id: string) => void;
  removeAllSessions: () => void;
}

const DetectionStoreContext = createContext<DetectionStoreValue | null>(null);

export function DetectionStoreProvider({ children }: { children: ReactNode }) {
  const [sessionMap, setSessionMap] = useState<Record<string, LiveSession>>({});

  const upsertSession = useCallback((id: string, updater: (prev: LiveSession | undefined) => LiveSession) => {
    setSessionMap((prev) => ({ ...prev, [id]: updater(prev[id]) }));
  }, []);

  const removeSession = useCallback((id: string) => {
    setSessionMap((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const removeAllSessions = useCallback(() => {
    setSessionMap({});
  }, []);

  const sessions = useMemo(() => Object.values(sessionMap), [sessionMap]);

  const liveCamera = useMemo<LiveCamera | null>(() => {
    if (sessions.length === 0) return null;
    if (sessions.length === 1) return sessions[0];
    return {
      id:         "aggregate",
      name:       `${sessions.length} Live Sessions`,
      status:     "streaming",
      detections: sessions.flatMap((s) => s.detections),
      violations: [...new Set(sessions.flatMap((s) => s.violations))],
      severity:   worstSeverity(sessions.map((s) => s.severity)),
      frameIndex: Math.max(...sessions.map((s) => s.frameIndex)),
    };
  }, [sessions]);

  return (
    <DetectionStoreContext.Provider
      value={{ sessions, liveCamera, upsertSession, removeSession, removeAllSessions }}
    >
      {children}
    </DetectionStoreContext.Provider>
  );
}

export function useDetectionStore() {
  const ctx = useContext(DetectionStoreContext);
  if (!ctx) throw new Error("useDetectionStore must be used within DetectionStoreProvider");
  return ctx;
}
