import type { AuditLogEntry } from '../../types';
import { format } from 'date-fns';

let _log: AuditLogEntry[] = [
  { id: 'aud-001', timestamp: '2026-07-09 08:00:00', actor: 'admin', actionType: 'USER_CREATE',   entity: 'User: officer', description: 'Created user account for Safety Officer', ipAddress: '192.168.1.10' },
  { id: 'aud-002', timestamp: '2026-07-09 08:05:00', actor: 'admin', actionType: 'ZONE_UPDATE',   entity: 'Zone: Welding Zone', description: 'Updated required PPE for Welding Zone', ipAddress: '192.168.1.10' },
  { id: 'aud-003', timestamp: '2026-07-09 09:30:00', actor: 'admin', actionType: 'CAMERA_CREATE', entity: 'Camera: CAM-05', description: 'Added camera CAM-05 for Loading Bay', ipAddress: '192.168.1.10' },
  { id: 'aud-004', timestamp: '2026-07-09 10:00:00', actor: 'officer', actionType: 'ALERT_ACK',   entity: 'Alert: ALT-003', description: 'Acknowledged alert ALT-003 for Worker W-007', ipAddress: '192.168.1.25' },
  { id: 'aud-005', timestamp: '2026-07-09 10:30:00', actor: 'officer', actionType: 'ALERT_RESOLVE', entity: 'Alert: ALT-004', description: 'Resolved alert ALT-004 — worker confirmed compliant', ipAddress: '192.168.1.25' },
];

let _counter = 6;

export function appendAuditLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): void {
  _log.unshift({
    id: `aud-${String(_counter++).padStart(3, '0')}`,
    timestamp: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
    ...entry,
  });
}

export interface AuditLogFilters {
  actor?: string;
  actionType?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export function queryAuditLog(filters: AuditLogFilters = {}) {
  let data = [..._log];
  if (filters.actor)      data = data.filter(e => e.actor.includes(filters.actor!));
  if (filters.actionType) data = data.filter(e => e.actionType === filters.actionType);
  if (filters.search)     data = data.filter(e =>
    e.description.toLowerCase().includes(filters.search!.toLowerCase()) ||
    e.entity.toLowerCase().includes(filters.search!.toLowerCase())
  );
  const total = data.length;
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 50;
  return { data: data.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize };
}
