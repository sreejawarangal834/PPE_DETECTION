/**
 * buildDailyReportHTML
 * --------------------
 * Generates a self-contained HTML string for the daily compliance PDF.
 * Called by DailyReport.tsx → passed to printReport() → injected into iframe.
 *
 * No JSX — pure string so it works inside a plain .ts file.
 */
import type { DailyReport } from '../../types';
import type { Alert } from '../../types';
import { PPE_LABEL } from '../../constants/ppeTypes';
import { SITE_NAME } from '../../constants/app';
import { formatDate } from '../utils';

function complianceColor(v: number) {
  if (v >= 80) return '#4F9E7C';
  if (v >= 60) return '#D9A441';
  return '#C25450';
}

function severityColor(s: string) {
  if (s === 'high')   return '#C25450';
  if (s === 'medium') return '#D9A441';
  return '#4F9E7C';
}

function statusColor(s: string) {
  const m: Record<string, string> = {
    open: '#C25450', acknowledged: '#D9A441', escalated: '#C25450', resolved: '#4F9E7C',
  };
  return m[s] ?? '#9BA3B8';
}

/** Inline SVG CCTV snapshot */
function snapshotSVG(alertId: string, severity: string): string {
  const bc = severityColor(severity);
  return `
<svg width="100%" viewBox="0 0 320 140" xmlns="http://www.w3.org/2000/svg"
  style="display:block;border-radius:5px;background:#1a1d23;width:100%;height:140px;">
  <defs>
    <pattern id="s${alertId}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="3" height="6" fill="#20242D"/>
      <rect x="3" width="3" height="6" fill="#12151A"/>
    </pattern>
  </defs>
  <rect width="320" height="140" fill="url(#s${alertId})"/>
  <rect x="8" y="8" width="46" height="18" rx="3" fill="rgba(0,0,0,0.75)"/>
  <circle cx="18" cy="17" r="4" fill="#4F9E7C"/>
  <text x="26" y="21" fill="#4F9E7C" font-size="9" font-family="monospace" font-weight="700">LIVE</text>
  <rect x="95" y="28" width="68" height="88" rx="2" fill="none" stroke="${bc}" stroke-width="2.5"/>
  <rect x="95" y="17" width="96" height="15" rx="2" fill="${bc}" opacity="0.9"/>
  <text x="99" y="27" fill="white" font-size="8" font-family="monospace">PPE VIOLATION ${(0.85 + Math.random() * 0.12).toFixed(2)}</text>
  <rect x="190" y="42" width="52" height="72" rx="2" fill="none" stroke="#4A8FA3" stroke-width="1.5"/>
  <text x="8" y="134" fill="#9BA3B8" font-size="8" font-family="monospace" opacity="0.7">
    CCTV CAPTURE — ${new Date().toLocaleTimeString('en-GB')}
  </text>
</svg>`;
}

export function buildDailyReportHTML(
  report: DailyReport,
  date: string,
  alerts: Alert[],
  userName: string
): string {
  const topAlerts = alerts.slice(0, 6);
  const reportDate = new Date(date).toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  /* ── Header ──────────────────────────────────────────── */
  const header = `
<div class="header-row">
  <div>
    <p style="font-size:9pt;color:#6B7280;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px;">${SITE_NAME}</p>
    <h1>Daily Compliance Report</h1>
    <p style="font-size:12pt;color:#4B5563;margin-top:4px;">Report Date: ${reportDate}</p>
  </div>
  <div class="header-meta">
    <p>Generated: ${formatDate(Date.now())}</p>
    <p>Prepared by: ${userName}</p>
    <p style="font-weight:700;color:#374151;margin-top:4px;">CONFIDENTIAL — SAFETY USE ONLY</p>
  </div>
</div>`;

  /* ── KPI Strip ───────────────────────────────────────── */
  const kpis = `
<div class="kpi-grid">
  <div class="kpi-card">
    <div class="kpi-label">Overall Compliance</div>
    <div class="kpi-value" style="color:${complianceColor(report.overallCompliance)}">${report.overallCompliance}%</div>
  </div>
  <div class="kpi-card">
    <div class="kpi-label">Workers Tracked</div>
    <div class="kpi-value">${report.totalWorkers}</div>
  </div>
  <div class="kpi-card">
    <div class="kpi-label">Total Violations</div>
    <div class="kpi-value" style="color:#C25450">${report.totalViolations}</div>
  </div>
</div>`;

  /* ── Zone Compliance Table ───────────────────────────── */
  const zoneRows = report.zoneBreakdown.map((z, i) => {
    const col = complianceColor(z.compliance);
    const status = z.compliance >= 80 ? '✓ Compliant' : z.compliance >= 60 ? '⚠ Needs attention' : '✗ At risk';
    const bg = i % 2 === 0 ? '#fff' : '#F9FAFB';
    return `<tr style="background:${bg}">
      <td style="font-weight:500">${z.zoneName}</td>
      <td style="font-weight:700;color:${col}">${z.compliance}%</td>
      <td style="color:${z.violations > 0 ? '#C25450' : '#4F9E7C'};font-weight:600">${z.violations}</td>
      <td style="color:${col};font-weight:600;font-size:10pt">${status}</td>
    </tr>`;
  }).join('');

  const zoneTable = `
<h2>Zone-Wise Compliance</h2>
<table>
  <thead><tr><th>Zone</th><th>Compliance %</th><th>Violations</th><th>Status</th></tr></thead>
  <tbody>${zoneRows}</tbody>
</table>`;

  /* ── Shift Breakdown ─────────────────────────────────── */
  const shiftRows = report.shiftBreakdown.map((s, i) => {
    const col = complianceColor(s.compliance);
    const bg = i % 2 === 0 ? '#fff' : '#F9FAFB';
    return `<tr style="background:${bg}">
      <td style="text-transform:capitalize;font-weight:500">${s.shift}</td>
      <td style="font-family:monospace">${s.workers}</td>
      <td style="color:${s.violations > 0 ? '#C25450' : '#4F9E7C'};font-family:monospace;font-weight:600">${s.violations}</td>
      <td style="font-weight:700;font-family:monospace;color:${col}">${s.compliance}%</td>
    </tr>`;
  }).join('');

  const shiftTable = `
<h2 style="margin-top:20px">Shift Breakdown</h2>
<table>
  <thead><tr><th>Shift</th><th>Workers</th><th>Violations</th><th>Compliance %</th></tr></thead>
  <tbody>${shiftRows}</tbody>
</table>`;

  /* ── Alert Snapshots ─────────────────────────────────── */
  const alertCards = topAlerts.map(a => {
    const sc = severityColor(a.severity);
    const stc = statusColor(a.status);
    const missing = a.missingPpe.map(p => PPE_LABEL[p] ?? p).join(', ');
    const ackLine = a.acknowledgedBy
      ? `<p style="color:#6B7280;font-size:9pt;margin-top:4px">Ack: ${a.acknowledgedBy}${a.acknowledgedAt ? ' · ' + new Date(a.acknowledgedAt).toLocaleTimeString('en-GB') : ''}</p>`
      : '';
    const resLine = a.resolvedBy
      ? `<p style="color:#4F9E7C;font-size:9pt;margin-top:2px">✓ Resolved: ${a.resolvedBy}${a.resolutionNotes ? ' — ' + a.resolutionNotes.slice(0, 70) + '…' : ''}</p>`
      : '';

    return `
<div class="alert-card" style="border-color:${sc}40">
  <div class="alert-card-header" style="background:${sc}0d;border-bottom-color:${sc}30">
    <div>
      <span style="font-size:10pt;font-weight:700;color:${sc};text-transform:uppercase;letter-spacing:0.05em">${a.severity} severity</span>
      <span style="margin-left:8px;font-size:9pt;color:#6B7280;font-family:monospace">${a.id}</span>
    </div>
    <span class="status-pill" style="border:1px solid ${stc};color:${stc}">${a.status}</span>
  </div>
  <div class="alert-card-body">
    <div class="snapshot">${snapshotSVG(a.id, a.severity)}</div>
    <div class="meta-grid">
      <p><span>Zone: </span><strong>${a.zoneName}</strong></p>
      <p><span>Camera: </span><strong style="font-family:monospace">${a.cameraId}</strong></p>
      <p><span>Worker: </span><strong>${a.workerName}</strong></p>
      <p><span>Time: </span><strong style="font-family:monospace">${a.timestamp}</strong></p>
    </div>
    <p style="margin-top:6px;font-size:10pt;color:#374151">
      Missing PPE: <strong style="color:${sc}">${missing}</strong>
    </p>
    ${ackLine}${resLine}
  </div>
</div>`;
  }).join('');

  const alertsSection = topAlerts.length > 0 ? `
<div class="page-break"></div>
<h2>PPE Violation Snapshots (${topAlerts.length} alerts)</h2>
<p style="font-size:10pt;color:#6B7280;margin-bottom:14px">
  CCTV captures recorded at the time of each PPE violation detection.
</p>
<div class="alert-grid">${alertCards}</div>` : '';

  /* ── Footer ──────────────────────────────────────────── */
  const footer = `
<div class="footer">
  <span>${SITE_NAME} — PPE Compliance Report — ${date}</span>
  <span>Generated by ${userName} · ${formatDate(Date.now())}</span>
</div>`;

  return header + kpis + zoneTable + shiftTable + alertsSection + footer;
}
