import type { Zone } from '../types';
import { appendAuditLog } from '../lib/audit/auditLog';

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

export async function getZones(): Promise<Zone[]> {
  return request<Zone[]>('/api/zones');
}

export async function getZoneById(id: string): Promise<Zone> {
  const zones = await getZones();
  const zone = zones.find(z => z.id === id);
  if (!zone) throw new Error(`Zone ${id} not found`);
  return zone;
}

export async function createZone(data: Omit<Zone, 'id' | 'cameraCount'>, actor: string): Promise<Zone> {
  const zone = await request<Zone>('/api/zones', { method: 'POST', body: JSON.stringify(data) });
  appendAuditLog({ actor, actionType: 'ZONE_CREATE', entity: `Zone: ${zone.name}`, description: `Created zone ${zone.name}`, ipAddress: '—' });
  return zone;
}

export async function updateZone(id: string, data: Partial<Zone>, actor: string): Promise<Zone> {
  const zone = await request<Zone>(`/api/zones/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  appendAuditLog({ actor, actionType: 'ZONE_UPDATE', entity: `Zone: ${id}`, description: `Updated zone ${id}`, ipAddress: '—' });
  return zone;
}
