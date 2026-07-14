import type { ManagedUser, SystemHealthItem, AlertConfig, AuditLogEntry, PagedResult } from '../types';
import type { UserRole } from '../constants/roles';
import { getAllUsers, updateUserRecord, createUserRecord } from './authApi';
import { queryAuditLog, appendAuditLog, type AuditLogFilters } from '../lib/audit/auditLog';
import { getAlertConfig, saveAlertConfig } from '../data/alertConfig';
import { CAMERAS } from '../data/mockData';

function delay(ms = 350) { return new Promise<void>(r => setTimeout(r, ms)); }

/* ─── Users ─────────────────────────────────────────────── */
export async function getUsers(): Promise<ManagedUser[]> {
  await delay();
  return getAllUsers() as ManagedUser[];
}

export async function createUser(data: {
  name: string; username: string; email: string; role: UserRole;
  password: string; assignedZones: string[];
}, actor: string): Promise<ManagedUser> {
  await delay(400);
  const user = createUserRecord({ ...data, status: 'active' });
  appendAuditLog({ actor, actionType: 'USER_CREATE', entity: `User: ${data.username}`, description: `Created user ${data.name} with role ${data.role}`, ipAddress: '—' });
  return user as unknown as ManagedUser;
}

export async function updateUser(id: string, data: Partial<ManagedUser>, actor: string): Promise<ManagedUser> {
  await delay(300);
  updateUserRecord(id, data);
  appendAuditLog({ actor, actionType: 'USER_UPDATE', entity: `User: ${id}`, description: `Updated user ${id}`, ipAddress: '—' });
  const users = getAllUsers();
  return users.find(u => u.id === id) as ManagedUser;
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

/* ─── Audit Log ──────────────────────────────────────────── */
export async function getAuditLog(filters: AuditLogFilters = {}): Promise<PagedResult<AuditLogEntry>> {
  await delay(250);
  return queryAuditLog(filters);
}
