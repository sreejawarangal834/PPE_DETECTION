import { format, formatDistanceToNow } from 'date-fns';
import * as XLSX from 'xlsx';

export function formatDate(iso: string | number): string {
  return format(new Date(iso), 'dd MMM yyyy, HH:mm');
}

export function formatTime(iso: string | number): string {
  return format(new Date(iso), 'HH:mm:ss');
}

export function formatDateShort(iso: string | number): string {
  return format(new Date(iso), 'dd MMM yyyy');
}

export function formatRelative(iso: string | number): string {
  return formatDistanceToNow(new Date(iso), { addSuffix: true });
}

export function formatDuration(ms: number): string {
  if (ms <= 0) return '—';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function formatComplianceRate(rate: number): string {
  return `${rate.toFixed(1)}%`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function exportToCSV(
  data: Record<string, unknown>[],
  filename: string
): void {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, `${filename}.csv`, { bookType: 'csv' });
}

export function generateExcelWorkbook(
  sheets: { name: string; data: Record<string, unknown>[]; metadata?: string[] }[],
  filename: string
): void {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const rows: Record<string, unknown>[] = [];
    if (sheet.metadata) rows.push(...sheet.metadata.map(m => ({ Info: m })));
    rows.push(...(sheet.data as Record<string, unknown>[]));
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ');
}

export function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.slice(0, maxLen) + '…' : str;
}
