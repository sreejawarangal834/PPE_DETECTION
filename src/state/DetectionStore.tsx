import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { detectionEvents as mockEvents, type DetectionEvent } from "../data/mockData";
import type { Detection, SocketState } from "../hooks/useDetectionSocket";
import type { Severity } from "../data/mockData";

export interface LiveCamera {
  id: string;
  name: string;
  status: SocketState;
  jpeg?: string;
  detections: Detection[];
  severity: Severity;
  violations: string[];
  frameIndex: number;
}

interface DetectionStoreValue {
  liveCamera: LiveCamera | null;
  events: DetectionEvent[];
  setLiveCamera: (updater: (prev: LiveCamera | null) => LiveCamera | null) => void;
  pushLiveEvent: (event: DetectionEvent) => void;
  resetLiveCamera: () => void;
}

const DetectionStoreContext = createContext<DetectionStoreValue | null>(null);

export function DetectionStoreProvider({ children }: { children: ReactNode }) {
  const [liveCamera, setLiveCameraState] = useState<LiveCamera | null>(null);
  const [liveEvents, setLiveEvents] = useState<DetectionEvent[]>([]);

  const setLiveCamera = useCallback((updater: (prev: LiveCamera | null) => LiveCamera | null) => {
    setLiveCameraState(updater);
  }, []);

  const pushLiveEvent = useCallback((event: DetectionEvent) => {
    setLiveEvents((prev) => [event, ...prev].slice(0, 200));
  }, []);

  const resetLiveCamera = useCallback(() => {
    setLiveCameraState(null);
    setLiveEvents([]);
  }, []);

  const events = [...liveEvents, ...mockEvents];

  return (
    <DetectionStoreContext.Provider
      value={{ liveCamera, events, setLiveCamera, pushLiveEvent, resetLiveCamera }}
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
