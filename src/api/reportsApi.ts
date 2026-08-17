import type { DailyReport, WorkerComplianceRow, KpiSummary } from '../types';
import { generateDailyReport, generateKpiSummary } from '../data/reports';

function delay(ms = 400) { return new Promise<void>(r => setTimeout(r, ms)); }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function getDailyReport(date: string): Promise<DailyReport> {
  await delay();
  return generateDailyReport(date);
}

export async function getWeeklyReport(weekStart: string): Promise<DailyReport[]> {
  await delay();
  return Array.from({ length: 7 }, (_, i) => generateDailyReport(`Day ${i + 1} of ${weekStart}`));
}

export async function getMonthlyReport(month: string): Promise<DailyReport[]> {
  await delay();
  return Array.from({ length: 30 }, (_, i) => generateDailyReport(`Day ${i + 1} of ${month}`));
}

export async function getWorkerComplianceReport(filters?: {
  zones?: string[];
  departments?: string[];
  thresholdBelow?: number;
  page?: number;
  pageSize?: number;
}): Promise<{ data: WorkerComplianceRow[]; total: number }> {
  const params = new URLSearchParams();
  filters?.zones?.forEach(z => params.append('zone', z));
  filters?.departments?.forEach(d => params.append('department', d));
  if (filters?.thresholdBelow !== undefined) params.set('thresholdBelow', String(filters.thresholdBelow));
  if (filters?.page) params.set('page', String(filters.page));
  if (filters?.pageSize) params.set('pageSize', String(filters.pageSize));
  return request(`/api/reports/workers${params.toString() ? `?${params}` : ''}`);
}

/* ─── Person-wise reporting (Phase 3 — real backend, no mock) ─────────────── */

export interface PersonSummary {
  id: string;
  label: string;
  name: string | null;
  department: string | null;
}

export async function searchPersons(query: string): Promise<PersonSummary[]> {
  const params = new URLSearchParams();
  if (query) params.set('search', query);
  return request(`/api/persons${params.toString() ? `?${params}` : ''}`);
}

export interface PersonComplianceDetail {
  person: PersonSummary & { source: string; status: string };
  perZone: { zoneId: string; zoneName: string; violations: number }[];
  perPpe: { ppeType: string; violations: number; lastSeen: string | null }[];
  trend: { day: string; violations: number }[];
  timeline: {
    id: string; ppeType: string; confidence: number | null; startedAt: string;
    zoneId: string | null; zoneName: string | null; cameraCode: string | null;
    severity: string; alertStatus: string;
  }[];
}

export interface PersonComplianceFilters {
  from?: string;
  to?: string;
  zoneIds?: string[];
  ppeTypes?: string[];
  severity?: string[];
}

export async function getPersonCompliance(personId: string, filters: PersonComplianceFilters = {}): Promise<PersonComplianceDetail> {
  const params = new URLSearchParams();
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  filters.zoneIds?.forEach(z => params.append('zone_ids', z));
  filters.ppeTypes?.forEach(p => params.append('ppe_types', p));
  filters.severity?.forEach(s => params.append('severity', s));
  return request(`/api/persons/${personId}/compliance${params.toString() ? `?${params}` : ''}`);
}

export async function getAdHocReport(filters: {
  zones?: string[];
  dateRange?: { from: string; to: string };
  ppeTypes?: string[];
  severity?: string;
  groupBy?: string;
}): Promise<{ labels: string[]; values: number[]; tableData: Record<string, unknown>[] }> {
  await delay(600);
  const labels = filters.zones?.length ? filters.zones : ['Assembly Line', 'Welding Zone', 'Chemical Zone', 'Storage Area'];
  const values = labels.map(() => Math.floor(Math.random() * 20 + 1));
  const tableData = labels.map((l, i) => ({ zone: l, violations: values[i], compliance: `${Math.floor(60 + Math.random() * 40)}%` }));
  return { labels, values, tableData };
}

export async function getKpiSummary(): Promise<KpiSummary> {
  await delay();
  return generateKpiSummary();
}
