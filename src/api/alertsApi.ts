import type { Alert, PagedResult } from '../types';
import { appendAuditLog } from '../lib/audit/auditLog';

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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

// The backend doesn't paginate — it returns every alert (JSON-file scale,
// not a real DB) — so pagination/date-range filtering happens here, same as
// the mock layer did, keeping this function's contract unchanged for callers.
export async function getAlerts(filters: AlertFilters = {}): Promise<PagedResult<Alert>> {
  const params = new URLSearchParams();
  filters.severities?.forEach(s => params.append('severity', s));
  filters.zones?.forEach(z => params.append('zone', z));
  filters.statuses?.forEach(s => params.append('status', s));
  if (filters.search) params.set('search', filters.search);

  let data = await request<Alert[]>(`/api/alerts${params.toString() ? `?${params}` : ''}`);
  if (filters.dateFrom) data = data.filter(a => a.createdAt >= new Date(filters.dateFrom!).getTime());
  if (filters.dateTo) data = data.filter(a => a.createdAt <= new Date(filters.dateTo!).getTime());

  const total = data.length;
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  return { data: data.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize };
}

export async function getAlertById(id: string): Promise<Alert> {
  const { data } = await getAlerts({ pageSize: 1000 });
  const alert = data.find(a => a.id === id);
  if (!alert) throw new Error(`Alert ${id} not found`);
  return alert;
}

export async function acknowledgeAlert(id: string, actorName: string): Promise<Alert> {
  const updated = await request<Alert>(`/api/alerts/${id}/acknowledge`, {
    method: 'POST', body: JSON.stringify({ actor: actorName }),
  });
  appendAuditLog({ actor: actorName, actionType: 'ALERT_ACK', entity: `Alert: ${id}`, description: `Acknowledged alert ${id}`, ipAddress: '—' });
  return updated;
}

export async function resolveAlert(id: string, actorName: string, notes: string): Promise<Alert> {
  const updated = await request<Alert>(`/api/alerts/${id}/resolve`, {
    method: 'POST', body: JSON.stringify({ actor: actorName, notes }),
  });
  appendAuditLog({ actor: actorName, actionType: 'ALERT_RESOLVE', entity: `Alert: ${id}`, description: `Resolved alert ${id}: ${notes}`, ipAddress: '—' });
  return updated;
}
