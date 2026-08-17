import type { Worker, WorkerZoneLog, PagedResult } from '../types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function getWorkers(filters?: { search?: string; zone?: string; compliance?: string }): Promise<Worker[]> {
  const params = new URLSearchParams();
  if (filters?.search) params.set('search', filters.search);
  if (filters?.zone) params.set('zone', filters.zone);
  if (filters?.compliance) params.set('compliance', filters.compliance);
  return request(`/api/workers${params.toString() ? `?${params}` : ''}`);
}

export async function getWorkerById(id: string): Promise<Worker> {
  return request(`/api/workers/${id}`);
}

export async function getWorkerZoneLog(
  workerId: string,
  filters?: { zone?: string; page?: number; pageSize?: number }
): Promise<PagedResult<WorkerZoneLog>> {
  const params = new URLSearchParams();
  if (filters?.zone) params.set('zone', filters.zone);
  if (filters?.page) params.set('page', String(filters.page));
  if (filters?.pageSize) params.set('pageSize', String(filters.pageSize));
  return request(`/api/workers/${workerId}/zone-log${params.toString() ? `?${params}` : ''}`);
}

// No-op: live per-frame worker telemetry belongs to in-process session state
// (see backend/repositories/workers.py's docstring on activeViolations), not
// a client-side cache to patch — kept so no caller mirroring the old mock-WS
// pattern hits a missing export.
export function updateWorkerLive(_id: string, _patch: Partial<Worker>): void {}
