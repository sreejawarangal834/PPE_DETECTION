import type { Zone } from '../types';
import { appendAuditLog } from '../lib/audit/auditLog';
// Backend zone CRUD now enforces require_role("admin") (Phase 4 — see backend/main.py); every
// call here needs the current access token attached, hence authRequest over a plain fetch.
import { authRequest as request } from '../lib/http';

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
