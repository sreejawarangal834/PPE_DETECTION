import type { Alert, PagedResult } from '../types';
import { appendAuditLog } from '../lib/audit/auditLog';
// GET /api/alerts is zone-scoped for `operator`, and acknowledge/resolve now enforce
// require_role("admin","operator") (Phase 4 — see backend/main.py); every call here needs the
// current access token attached, hence authRequest over a plain fetch.
import { authRequest as request } from '../lib/http';

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
