import type { ManagedUser, SystemHealthItem, AlertConfig, AuditLogEntry, PagedResult } from '../types';
import type { UserRole } from '../constants/roles';
import { authRequest } from '../lib/http';
import { appendAuditLog, type AuditLogFilters } from '../lib/audit/auditLog';
import { getAlertConfig, saveAlertConfig } from '../data/alertConfig';
import { CAMERAS } from '../data/mockData';

function delay(ms = 350) { return new Promise<void>(r => setTimeout(r, ms)); }

/* ─── Users (Phase 4 — real backend, admin-only: backend/main.py's /api/admin/users) ────── */
interface BackendUser { id: string; name: string; email: string; role: UserRole; assignedZones: string[]; createdAt?: string }

function toManagedUser(u: BackendUser): ManagedUser {
  return {
    id: u.id, username: u.email, name: u.name, email: u.email, role: u.role,
    status: 'active', lastLogin: '—', assignedZones: u.assignedZones, createdAt: u.createdAt ?? '—',
  };
}

export async function getUsers(): Promise<ManagedUser[]> {
  const users = await authRequest<BackendUser[]>('/api/admin/users');
  return users.map(toManagedUser);
}

export async function createUser(data: {
  name: string; username: string; email: string; role: UserRole;
  password: string; assignedZones: string[];
}, _actor: string): Promise<ManagedUser> {
  // _actor is unused now — the server derives the acting user from the caller's own JWT
  // (backend/main.py's create_user_endpoint) and writes audit_log itself; a client-supplied
  // actor name is not trusted for that (SCHEMA_DEEP_DIVE.md §2).
  const user = await authRequest<BackendUser>('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify({ name: data.name, email: data.email, password: data.password, role: data.role, assignedZones: data.assignedZones }),
  });
  return toManagedUser(user);
}

export async function updateUser(id: string, data: Partial<ManagedUser>, _actor: string): Promise<ManagedUser> {
  const user = await authRequest<BackendUser>(`/api/admin/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name: data.name, role: data.role, assignedZones: data.assignedZones }),
  });
  return toManagedUser(user);
}

/* ─── System Health ──────────────────────────────────────── */
export async function getSystemHealth(): Promise<SystemHealthItem[]> {
  await delay(200);
  const cameraItems: SystemHealthItem[] = CAMERAS.map(c => ({
    id: c.id, name: c.name, type: 'camera',
    status: c.status === 'online' ? 'online' : c.status === 'offline' ? 'offline' : 'degraded',
    lastHeartbeat: c.lastSeen,
    offlineSinceMs: c.status === 'offline' ? Date.now() - new Date(c.lastSeen).getTime() : undefined,
  }));
  const services: SystemHealthItem[] = [
    { id: 'svc-inference', name: 'Inference Engine',   type: 'service', status: 'online',   lastHeartbeat: new Date().toISOString() },
    { id: 'svc-db',        name: 'Database',            type: 'service', status: 'online',   lastHeartbeat: new Date().toISOString() },
    { id: 'svc-ws',        name: 'WebSocket Broker',    type: 'service', status: 'online',   lastHeartbeat: new Date().toISOString() },
  ];
  return [...cameraItems, ...services];
}

/* ─── Alert Config ───────────────────────────────────────── */
export async function getAdminAlertConfig(): Promise<AlertConfig[]> {
  await delay(200);
  return getAlertConfig();
}

export async function saveAdminAlertConfig(config: AlertConfig[], actor: string): Promise<void> {
  await delay(300);
  saveAlertConfig(config);
  appendAuditLog({ actor, actionType: 'ALERT_CONFIG_SAVE', entity: 'AlertConfig', description: 'Saved alert severity and escalation thresholds', ipAddress: '—' });
}

/* ─── Audit Log (Phase 4 — real backend/audit_log, DB-enforced append-only) ──────────────── */
export async function getAuditLog(filters: AuditLogFilters = {}): Promise<PagedResult<AuditLogEntry>> {
  const params = new URLSearchParams();
  if (filters.actor) params.set('actor', filters.actor);
  if (filters.actionType) params.set('actionType', filters.actionType);
  if (filters.search) params.set('search', filters.search);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
  return authRequest(`/api/admin/audit-log${params.toString() ? `?${params}` : ''}`);
}
