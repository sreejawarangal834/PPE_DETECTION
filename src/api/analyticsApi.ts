import { authRequest } from '../lib/http';

export interface ZoneLiveStat {
  zoneId: string;
  zoneName: string;
  compliancePercent: number | null; // null = no tracked sessions in this zone/window yet
  violations: number;
  workersSeen: number;
}

export interface LiveStats {
  overallCompliance: number | null;
  zoneStats: ZoneLiveStat[];
  timeline: { t: string; violations: number }[];
}

/**
 * Real replacement for src/lib/websocket/mockWebSocketService.ts's fabricated
 * zone_compliance_update/top_zones_update streams (GET /api/analytics/live-stats — see
 * backend/repositories/live_stats.py for the honest metric definition). Polled via
 * react-query rather than pushed over a socket — periodic real data beats a fake live push.
 */
export async function getLiveStats(windowMinutes = 60): Promise<LiveStats> {
  return authRequest(`/api/analytics/live-stats?windowMinutes=${windowMinutes}`);
}
