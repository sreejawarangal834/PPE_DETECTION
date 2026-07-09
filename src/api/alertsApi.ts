import type { Alert, PagedResult } from '../types';
import type { AlertStatus } from '../constants/alertStatus';
import { ALERTS } from '../data/mockData';
import { appendAuditLog } from '../lib/audit/auditLog';

let _alerts: Alert[] = [...ALERTS];
let _counter = ALERTS.length + 1;

export function getAlertStore(): Alert[] { return _alerts; }
export function setAlertStore(alerts: Alert[]): void { _alerts = alerts; }

export interface AlertFilters {
  severities?: string[];
  zones?: string[];
  statuses?: string[];
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

function delay(ms = 300) { return new Promise<void>(r => setTimeout(r, ms)); }

export async function getAlerts(filters: AlertFilters = {}): Promise<PagedResult<Alert>> {
  await delay();
  let data = [..._alerts].sort((a, b) => {
    if (a.status === 'escalated' && b.status !== 'escalated') return -1;
    if (b.status === 'escalated' && a.status !== 'escalated') return 1;
    return b.createdAt - a.createdAt;
  });
  if (filters.severities?.length) data = data.filter(a => filters.severities!.includes(a.severity));
  if (filters.zones?.length) data = data.filter(a => filters.zones!.includes(a.zoneId));
  if (filters.statuses?.length) data = data.filter(a => filters.statuses!.includes(a.status));
  if (filters.search) {
    const q = filters.search.toLowerCase();
    data = data.filter(a =>
      a.workerId.toLowerCase().includes(q) ||
      a.workerName.toLowerCase().includes(q) ||
      a.zoneName.toLowerCase().includes(q) ||
      (a.acknowledgedBy ?? '').toLowerCase().includes(q) ||
      (a.resolvedBy ?? '').toLowerCase().includes(q)
    );
  }
  const total = data.length;
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  return { data: data.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize };
}

export async function getAlertById(id: string): Promise<Alert> {
  await delay(150);
  const a = _alerts.find(a => a.id === id);
  if (!a) throw new Error(`Alert ${id} not found`);
  return { ...a };
}

export async function acknowledgeAlert(id: string, actorName: string): Promise<Alert> {
  await delay(300);
  const idx = _alerts.findIndex(a => a.id === id);
  if (idx === -1) throw new Error(`Alert ${id} not found`);
  const updated: Alert = { ..._alerts[idx], status: 'acknowledged', acknowledgedBy: actorName, acknowledgedAt: new Date().toISOString() };
  _alerts[idx] = updated;
  appendAuditLog({ actor: actorName, actionType: 'ALERT_ACK', entity: `Alert: ${id}`, description: `Acknowledged alert ${id}`, ipAddress: '—' });
  return { ...updated };
}

export async function resolveAlert(id: string, actorName: string, notes: string): Promise<Alert> {
  await delay(300);
  const idx = _alerts.findIndex(a => a.id === id);
  if (idx === -1) throw new Error(`Alert ${id} not found`);
  const updated: Alert = { ..._alerts[idx], status: 'resolved', resolvedBy: actorName, resolvedAt: new Date().toISOString(), resolutionNotes: notes };
  _alerts[idx] = updated;
  appendAuditLog({ actor: actorName, actionType: 'ALERT_RESOLVE', entity: `Alert: ${id}`, description: `Resolved alert ${id}: ${notes}`, ipAddress: '—' });
  return { ...updated };
}

export function addAlertToStore(alert: Omit<Alert, 'id' | 'createdAt'>): Alert {
  const newAlert: Alert = { ...alert, id: `ALT-${String(_counter++).padStart(3,'0')}`, createdAt: Date.now() };
  _alerts.unshift(newAlert);
  return newAlert;
}

export function updateAlertStatus(id: string, status: AlertStatus, meta?: Partial<Alert>): Alert | null {
  const idx = _alerts.findIndex(a => a.id === id);
  if (idx === -1) return null;
  _alerts[idx] = { ..._alerts[idx], status, ...meta };
  return { ..._alerts[idx] };
}
