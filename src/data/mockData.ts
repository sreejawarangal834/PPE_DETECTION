export type Severity = "ok" | "medium" | "high";

export interface DetectionEvent {
  id: string;
  timestamp: string;
  camera: string;
  zone: string;
  message: string;
  severity: Severity;
  confidence: number;
}

export interface Camera {
  id: string;
  name: string;
  zone: string;
  status: "online" | "offline";
  fps: number;
  latencyMs: number;
  workersDetected: number;
  activeViolations: number;
}

export const cameras: Camera[] = [
  {
    id: "CAM-01",
    name: "Assembly line — north",
    zone: "Assembly Line",
    status: "online",
    fps: 24.1,
    latencyMs: 42,
    workersDetected: 7,
    activeViolations: 2,
  },
  {
    id: "CAM-02",
    name: "Welding bay",
    zone: "Welding Zone",
    status: "online",
    fps: 23.6,
    latencyMs: 47,
    workersDetected: 1,
    activeViolations: 1,
  },
  {
    id: "CAM-03",
    name: "Storage — east gate",
    zone: "Storage Area",
    status: "online",
    fps: 24.8,
    latencyMs: 39,
    workersDetected: 0,
    activeViolations: 0,
  },
  {
    id: "CAM-04",
    name: "Chemical handling",
    zone: "Chemical Zone",
    status: "online",
    fps: 22.9,
    latencyMs: 51,
    workersDetected: 0,
    activeViolations: 0,
  },
];

export const detectionEvents: DetectionEvent[] = [
  {
    id: "V000009",
    timestamp: "12:49:20",
    camera: "CAM-02",
    zone: "Welding Zone",
    message: "Missing helmet, vest, gloves",
    severity: "high",
    confidence: 0.91,
  },
  {
    id: "V000008",
    timestamp: "12:49:20",
    camera: "CAM-01",
    zone: "Assembly Line",
    message: "Missing helmet, vest, gloves",
    severity: "high",
    confidence: 0.88,
  },
  {
    id: "V000007",
    timestamp: "12:49:20",
    camera: "CAM-01",
    zone: "Assembly Line",
    message: "Missing vest, gloves",
    severity: "medium",
    confidence: 0.83,
  },
  {
    id: "V000006",
    timestamp: "12:49:20",
    camera: "CAM-01",
    zone: "Assembly Line",
    message: "Missing helmet, vest, gloves",
    severity: "high",
    confidence: 0.9,
  },
  {
    id: "V000005",
    timestamp: "12:48:39",
    camera: "CAM-01",
    zone: "Assembly Line",
    message: "Missing helmet, gloves",
    severity: "medium",
    confidence: 0.86,
  },
  {
    id: "V000004",
    timestamp: "12:48:39",
    camera: "CAM-01",
    zone: "Assembly Line",
    message: "Missing helmet, vest, gloves",
    severity: "high",
    confidence: 0.89,
  },
  {
    id: "—",
    timestamp: "12:47:11",
    camera: "CAM-03",
    zone: "Storage Area",
    message: "All required PPE detected",
    severity: "ok",
    confidence: 0.97,
  },
  {
    id: "—",
    timestamp: "12:46:52",
    camera: "CAM-04",
    zone: "Chemical Zone",
    message: "All required PPE detected",
    severity: "ok",
    confidence: 0.95,
  },
];
