import type { DailyReport, WorkerComplianceRow, KpiSummary } from '../types';
import { generateDailyReport, generateWorkerComplianceReport, generateKpiSummary } from '../data/reports';

function delay(ms = 400) { return new Promise<void>(r => setTimeout(r, ms)); }

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
  await delay();
  let data = generateWorkerComplianceReport(filters);
  if (filters?.departments?.length) data = data.filter(r => filters.departments!.includes(r.department));
  if (filters?.thresholdBelow !== undefined) data = data.filter(r => r.complianceRate < filters.thresholdBelow!);
  const total = data.length;
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 25;
  return { data: data.slice((page - 1) * pageSize, page * pageSize), total };
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
