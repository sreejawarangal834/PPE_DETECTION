import type { AlertStatus } from '../constants/alertStatus';
import type { Severity } from '../constants/severity';
import type { UserRole } from '../constants/roles';
import type { PpeTypeId } from '../constants/ppeTypes';

/* ─── Auth ───────────────────────────────────────────────── */
export interface AuthUser {
  id: string;
  username: string;
  name: string;
  email: string;
  role: UserRole;
  assignedZones: string[]; // zone IDs — non-empty for `operator`
  lastLogin: string;       // ISO string
  status: 'active' | 'inactive';
}

// Real JWT access token + opaque refresh token (Phase 4 — replaces the old client-only
// MockToken). `expiresAt` is decoded client-side from the access JWT's `exp` claim (see
// src/api/authApi.ts) rather than duplicated from a backend config constant.
export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // ms epoch
}

/* ─── Zone ───────────────────────────────────────────────── */
export interface Zone {
  id: string;
  name: string;
  description: string;
  requiredPpe: PpeTypeId[];
  cameraCount: number;
  active: boolean;
  svgCoordinates?: { x: number; y: number; w: number; h: number };
}

/* ─── Camera ─────────────────────────────────────────────── */
export interface Camera {
  id: string;
  name: string;
  rtspUrl: string;
  zoneId: string;
  zoneName: string;
  status: 'online' | 'offline' | 'error';
  fps: number;
  latencyMs: number;
  workersDetected: number;
  activeViolations: number;
  lastSeen: string;
}

/* ─── Alert ──────────────────────────────────────────────── */
export interface Alert {
  id: string;
  createdAt: number;       // unix ms
  timestamp: string;       // display string
  cameraId: string;
  zoneId: string;
  zoneName: string;
  workerId: string;
  workerName: string;
  missingPpe: PpeTypeId[];
  confidence: number;
  severity: Severity;
  status: AlertStatus;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  escalatedAt?: string;
  // Authenticated backend endpoint path (GET /api/snapshots/{id}), or null when no real
  // snapshot was captured — most importantly every legacy-imported alert (see
  // scripts/import_json_stores.py), which predates real capture entirely. Never a browser
  // path/URL you can drop straight into <img src>: the endpoint requires a Bearer token,
  // so consumers must fetch() it themselves (see AlertDetailPanel.tsx).
  snapshotUrl?: string | null;
}

/* ─── Worker ─────────────────────────────────────────────── */
export interface Worker {
  id: string;
  name: string;
  department: string;
  currentZoneId: string | null;
  currentZoneName: string | null;
  lastSeen: string;
  complianceRate: number;  // 0–100
  totalViolations: number;
  activeViolations: number;
  zonesVisited: string[];
}

export interface WorkerZoneLog {
  workerId: string;
  zoneId: string;
  zoneName: string;
  entryTime: string;
  exitTime: string | null;
  duration: string;
  complianceStatus: 'compliant' | 'non_compliant' | 'partial';
}

/* ─── Reports ────────────────────────────────────────────── */
export interface DailyReport {
  date: string;
  overallCompliance: number;
  totalWorkers: number;
  totalViolations: number;
  zoneBreakdown: ZoneCompliance[];
  shiftBreakdown: ShiftCompliance[];
}

export interface ZoneCompliance {
  zoneId: string; zoneName: string; compliance: number; violations: number;
}

export interface ShiftCompliance {
  shift: 'morning' | 'afternoon' | 'night';
  compliance: number; violations: number; workers: number;
}

export interface WorkerComplianceRow {
  workerId: string;
  workerName: string;
  department: string;
  totalShifts: number;
  compliantShifts: number;
  violationCount: number;
  complianceRate: number;
  mostFrequentViolation: string;
  lastViolationDate: string;
}

export interface KpiSummary {
  overallCompliance: number;
  complianceTrend: number;
  totalActiveViolations: number;
  violationsTrend: number;
  zonesAtRisk: number;
  zonesAtRiskTrend: number;
  workersTrackedToday: number;
  avgResponseTimeMs: number;
  avgResponseTimeTrend: number;
  sparklineData: number[];
  writtenSummary: string;
}

/* ─── Admin ──────────────────────────────────────────────── */
export interface ManagedUser {
  id: string;
  username: string;
  name: string;
  email: string;
  role: UserRole;
  status: 'active' | 'inactive';
  lastLogin: string;
  assignedZones: string[];
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  actionType: string;
  entity: string;
  description: string;
  ipAddress: string;
}

export interface SystemHealthItem {
  id: string;
  name: string;
  type: 'camera' | 'service';
  status: 'online' | 'degraded' | 'offline';
  lastHeartbeat: string;
  offlineSinceMs?: number;
}

export interface AlertConfig {
  zoneId: string;
  zoneName: string;
  confidenceThreshold: number;
  escalationDelayMinutes: number;
  severityMap: Record<string, Severity>;
}

/* ─── Notification ───────────────────────────────────────── */
export interface NotificationItem {
  id: string;
  type: 'alert_new' | 'alert_escalated' | 'system_health' | 'info';
  title: string;
  body: string;
  timestamp: number;
  read: boolean;
  linkTo?: string;
}

/* ─── WebSocket ──────────────────────────────────────────── */
export type WsStatus = 'connected' | 'reconnecting' | 'disconnected';

export type WsEventType =
  | 'zone_compliance_update'
  | 'camera_metrics_update'
  | 'alert_new'
  | 'alert_status_change'
  | 'worker_update'
  | 'system_health_update'
  | 'top_zones_update';

export interface WsEvent {
  type: WsEventType;
  payload: unknown;
}

/* ─── Misc ───────────────────────────────────────────────── */
export interface PagedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
