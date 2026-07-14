import type { Worker, WorkerZoneLog, PagedResult } from '../types';
import { WORKERS, ZONE_LOGS } from '../data/workers';

let _workers = [...WORKERS];

function delay(ms = 300) { return new Promise<void>(r => setTimeout(r, ms)); }

export async function getWorkers(filters?: { search?: string; zone?: string; compliance?: string }): Promise<Worker[]> {
  await delay();
  let data = [..._workers];
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    data = data.filter(w => w.id.toLowerCase().includes(q) || w.name.toLowerCase().includes(q));
  }
  if (filters?.zone) data = data.filter(w => w.currentZoneId === filters.zone);
  if (filters?.compliance === 'compliant') data = data.filter(w => w.complianceRate >= 80);
  if (filters?.compliance === 'non_compliant') data = data.filter(w => w.complianceRate < 80);
  return data;
}

export async function getWorkerById(id: string): Promise<Worker> {
  await delay(200);
  const w = _workers.find(w => w.id === id);
  if (!w) throw new Error(`Worker ${id} not found`);
  return { ...w };
}

export async function getWorkerZoneLog(
  workerId: string,
  filters?: { zone?: string; page?: number; pageSize?: number }
): Promise<PagedResult<WorkerZoneLog>> {
  await delay(200);
  let data = ZONE_LOGS.filter(l => l.workerId === workerId);
  if (filters?.zone) data = data.filter(l => l.zoneId === filters.zone);
  const total = data.length;
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 25;
  return { data: data.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize };
}

export function updateWorkerLive(id: string, patch: Partial<Worker>): void {
  const idx = _workers.findIndex(w => w.id === id);
  if (idx !== -1) _workers[idx] = { ..._workers[idx], ...patch };
}
