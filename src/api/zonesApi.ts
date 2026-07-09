import type { Zone } from '../types';
import { ZONES } from '../data/zones';
import { appendAuditLog } from '../lib/audit/auditLog';

let _zones: Zone[] = [...ZONES];

function delay(ms = 300) { return new Promise<void>(r => setTimeout(r, ms)); }

export async function getZones(): Promise<Zone[]> {
  await delay();
  return [..._zones];
}

export async function getZoneById(id: string): Promise<Zone> {
  await delay(150);
  const z = _zones.find(z => z.id === id);
  if (!z) throw new Error(`Zone ${id} not found`);
  return { ...z };
}

export async function createZone(data: Omit<Zone, 'id' | 'cameraCount'>, actor: string): Promise<Zone> {
  await delay(400);
  const newZone: Zone = { ...data, id: `z-${data.name.toLowerCase().replace(/\s+/g, '-')}`, cameraCount: 0 };
  _zones.push(newZone);
  appendAuditLog({ actor, actionType: 'ZONE_CREATE', entity: `Zone: ${newZone.name}`, description: `Created zone ${newZone.name}`, ipAddress: '—' });
  return { ...newZone };
}

export async function updateZone(id: string, data: Partial<Zone>, actor: string): Promise<Zone> {
  await delay(300);
  const idx = _zones.findIndex(z => z.id === id);
  if (idx === -1) throw new Error(`Zone ${id} not found`);
  _zones[idx] = { ..._zones[idx], ...data };
  appendAuditLog({ actor, actionType: 'ZONE_UPDATE', entity: `Zone: ${id}`, description: `Updated zone ${id}`, ipAddress: '—' });
  return { ..._zones[idx] };
}
