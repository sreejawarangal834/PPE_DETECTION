import type { DailyReport, WorkerComplianceRow, KpiSummary } from '../types';
import { WORKERS } from './workers';
import { ALERTS } from './mockData';

export function generateDailyReport(date: string): DailyReport {
  const violations = ALERTS.filter(a => a.severity !== 'info').length;
  return {
    date,
    overallCompliance: 78,
    totalWorkers: WORKERS.filter(w => w.currentZoneId).length,
    totalViolations: violations,
    zoneBreakdown: [
      { zoneId: 'z-assembly',    zoneName: 'Assembly Line',        compliance: 72, violations: 4 },
      { zoneId: 'z-welding',     zoneName: 'Welding Zone',          compliance: 55, violations: 3 },
      { zoneId: 'z-chemical',    zoneName: 'Chemical Zone',         compliance: 80, violations: 1 },
      { zoneId: 'z-storage',     zoneName: 'Storage Area',          compliance: 95, violations: 0 },
      { zoneId: 'z-loading',     zoneName: 'Loading Bay',           compliance: 90, violations: 0 },
      { zoneId: 'z-maintenance', zoneName: 'Maintenance Workshop',  compliance: 85, violations: 0 },
    ],
    shiftBreakdown: [
      { shift: 'morning',   compliance: 82, violations: 3, workers: 9 },
      { shift: 'afternoon', compliance: 74, violations: 4, workers: 7 },
      { shift: 'night',     compliance: 79, violations: 1, workers: 4 },
    ],
  };
}

export function generateWorkerComplianceReport(
  _filters?: { zones?: string[]; departments?: string[]; thresholdBelow?: number }
): WorkerComplianceRow[] {
  return WORKERS.map(w => ({
    workerId: w.id,
    workerName: w.name,
    department: w.department,
    totalShifts: 22,
    compliantShifts: Math.round(22 * w.complianceRate / 100),
    violationCount: w.totalViolations,
    complianceRate: w.complianceRate,
    mostFrequentViolation: 'Helmet',
    lastViolationDate: w.totalViolations > 0 ? '2026-07-08' : '—',
  }));
}

export function generateKpiSummary(): KpiSummary {
  const resolved = ALERTS.filter(a => a.resolvedAt && a.acknowledgedAt);
  const avgMs = resolved.length > 0
    ? resolved.reduce((sum, a) => sum + (new Date(a.acknowledgedAt!).getTime() - a.createdAt), 0) / resolved.length
    : 0;
  return {
    overallCompliance: 78,
    complianceTrend: 2.1,
    totalActiveViolations: ALERTS.filter(a => a.status === 'open' || a.status === 'escalated').length,
    violationsTrend: -1,
    zonesAtRisk: 2,
    zonesAtRiskTrend: 0,
    workersTrackedToday: WORKERS.filter(w => w.currentZoneId).length,
    avgResponseTimeMs: avgMs,
    avgResponseTimeTrend: -12,
    sparklineData: [65, 70, 68, 74, 72, 76, 78],
    writtenSummary: 'Overall site compliance is at 78% today, up 2% from yesterday. The Welding Zone remains below target at 55% — priority action is recommended. Assembly Line has improved from last week but still requires attention. Chemical Zone and Storage Area are performing well.',
  };
}
