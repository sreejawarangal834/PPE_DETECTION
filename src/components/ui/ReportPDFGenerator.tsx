/**
 * ReportPDFGenerator
 * ------------------
 * Renders a hidden, print-ready section that becomes the entire PDF when
 * window.print() is called. Uses @media print CSS to show only this section
 * and hide everything else.
 *
 * Includes:
 *  - Report header (site name, title, date, filters)
 *  - KPI summary strip
 *  - Zone compliance table
 *  - Shift breakdown table
 *  - Recent alerts with CCTV snapshot placeholders
 */
import type { DailyReport, Alert } from '../../types';
import { SITE_NAME } from '../../constants/app';
import { formatDate } from '../../lib/utils';
import { PPE_LABEL } from '../../constants/ppeTypes';
import { useAlertStore } from '../../lib/alerts/alertStore';
import { useAuthStore } from '../../lib/auth/authStore';
import SnapshotImage from './SnapshotImage';

interface Props {
  report: DailyReport;
  date: string;
  reportId: string;          // unique id so multiple reports don't conflict
}

function severityColor(s: string) {
  if (s === 'high')   return '#C25450';
  if (s === 'medium') return '#D9A441';
  return '#4F9E7C';
}

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, string> = {
    open:         '#C25450',
    acknowledged: '#D9A441',
    escalated:    '#C25450',
    resolved:     '#4F9E7C',
  };
  const color = colors[status] ?? '#A8A296';
  return (
    <span style={{
      display: 'inline-block',
      padding: '1px 7px',
      borderRadius: 4,
      fontSize: 10,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      border: `1px solid ${color}`,
      color,
    }}>
      {status}
    </span>
  );
}

export default function ReportPDFGenerator({ report, date, reportId }: Props) {
  const alerts = useAlertStore(s => s.alerts);
  const user   = useAuthStore(s => s.user);

  // Show top 5 alerts for the report date (mock: use most recent)
  const topAlerts: Alert[] = alerts.slice(0, 5);

  return (
    <div
      id={`pdf-report-${reportId}`}
      className="print-only"
      style={{
        fontFamily: "'IBM Plex Sans', Arial, sans-serif",
        fontSize: 13,
        color: '#111827',
        background: '#fff',
        padding: '32px 40px',
        maxWidth: 900,
        margin: '0 auto',
      }}
    >
      {/* ── Header ─────────────────────────────────────── */}
      <div style={{ borderBottom: '2px solid #1D1A16', paddingBottom: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ fontSize: 10, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
              {SITE_NAME}
            </p>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#111827' }}>
              Daily Compliance Report
            </h1>
            <p style={{ fontSize: 13, color: '#4B5563', marginTop: 4 }}>
              Report Date: {new Date(date).toLocaleDateString('en-GB', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
            </p>
          </div>
          <div style={{ textAlign: 'right', fontSize: 11, color: '#6B7280' }}>
            <p>Generated: {formatDate(Date.now())}</p>
            {user && <p>Prepared by: {user.name}</p>}
            <p style={{ marginTop: 4, fontWeight: 600, color: '#374151' }}>CONFIDENTIAL — SAFETY USE ONLY</p>
          </div>
        </div>
      </div>

      {/* ── KPI Strip ──────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Overall Compliance', value: `${report.overallCompliance}%`, color: report.overallCompliance >= 80 ? '#4F9E7C' : report.overallCompliance >= 60 ? '#D9A441' : '#C25450' },
          { label: 'Workers Tracked',    value: String(report.totalWorkers),    color: '#111827' },
          { label: 'Total Violations',   value: String(report.totalViolations), color: '#C25450' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ border: '1px solid #E5E7EB', borderRadius: 8, padding: '12px 16px', background: '#F9FAFB' }}>
            <p style={{ fontSize: 10, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{label}</p>
            <p style={{ fontSize: 28, fontWeight: 700, margin: 0, color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── Zone Compliance Table ───────────────────────── */}
      <h2 style={{ fontSize: 14, fontWeight: 700, color: '#1F2937', marginBottom: 10, borderBottom: '1px solid #E5E7EB', paddingBottom: 6 }}>
        Zone-Wise Compliance
      </h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24, fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#F3F4F6' }}>
            {['Zone', 'Compliance %', 'Violations', 'Status'].map(h => (
              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', border: '1px solid #E5E7EB' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {report.zoneBreakdown.map((z, i) => {
            const col = z.compliance >= 80 ? '#4F9E7C' : z.compliance >= 60 ? '#D9A441' : '#C25450';
            return (
              <tr key={z.zoneId} style={{ background: i % 2 === 0 ? '#fff' : '#F9FAFB' }}>
                <td style={{ padding: '8px 12px', border: '1px solid #E5E7EB', fontWeight: 500 }}>{z.zoneName}</td>
                <td style={{ padding: '8px 12px', border: '1px solid #E5E7EB', fontWeight: 700, color: col }}>{z.compliance}%</td>
                <td style={{ padding: '8px 12px', border: '1px solid #E5E7EB', color: z.violations > 0 ? '#C25450' : '#4F9E7C', fontWeight: 600 }}>{z.violations}</td>
                <td style={{ padding: '8px 12px', border: '1px solid #E5E7EB' }}>
                  <span style={{ color: col, fontWeight: 600, fontSize: 11 }}>
                    {z.compliance >= 80 ? '✓ Compliant' : z.compliance >= 60 ? '⚠ Needs attention' : '✗ At risk'}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* ── Shift Breakdown ────────────────────────────── */}
      <h2 style={{ fontSize: 14, fontWeight: 700, color: '#1F2937', marginBottom: 10, borderBottom: '1px solid #E5E7EB', paddingBottom: 6 }}>
        Shift Breakdown
      </h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 28, fontSize: 12 }}>
        <thead>
          <tr style={{ background: '#F3F4F6' }}>
            {['Shift', 'Workers', 'Violations', 'Compliance %'].map(h => (
              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', border: '1px solid #E5E7EB' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {report.shiftBreakdown.map((s, i) => {
            const col = s.compliance >= 80 ? '#4F9E7C' : s.compliance >= 60 ? '#D9A441' : '#C25450';
            return (
              <tr key={s.shift} style={{ background: i % 2 === 0 ? '#fff' : '#F9FAFB' }}>
                <td style={{ padding: '8px 12px', border: '1px solid #E5E7EB', textTransform: 'capitalize', fontWeight: 500 }}>{s.shift}</td>
                <td style={{ padding: '8px 12px', border: '1px solid #E5E7EB', fontFamily: 'monospace' }}>{s.workers}</td>
                <td style={{ padding: '8px 12px', border: '1px solid #E5E7EB', color: s.violations > 0 ? '#C25450' : '#4F9E7C', fontFamily: 'monospace', fontWeight: 600 }}>{s.violations}</td>
                <td style={{ padding: '8px 12px', border: '1px solid #E5E7EB', fontWeight: 700, fontFamily: 'monospace', color: col }}>{s.compliance}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* ── Alert Snapshots ────────────────────────────── */}
      {topAlerts.length > 0 && (
        <>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#1F2937', marginBottom: 12, borderBottom: '1px solid #E5E7EB', paddingBottom: 6 }}>
            PPE Violation Snapshots ({topAlerts.length} Alerts)
          </h2>
          <p style={{ fontSize: 11, color: '#6B7280', marginBottom: 16 }}>
            The following CCTV captures were recorded at the time of each PPE violation detection.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16 }}>
            {topAlerts.map(alert => (
              <div key={alert.id} style={{ border: `1px solid ${severityColor(alert.severity)}40`, borderRadius: 10, overflow: 'hidden', pageBreakInside: 'avoid' }}>
                {/* Alert header */}
                <div style={{ background: `${severityColor(alert.severity)}12`, borderBottom: `1px solid ${severityColor(alert.severity)}30`, padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: severityColor(alert.severity), textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {alert.severity} severity
                    </span>
                    <span style={{ marginLeft: 8, fontSize: 10, color: '#6B7280', fontFamily: 'monospace' }}>{alert.id}</span>
                  </div>
                  <StatusPill status={alert.status} />
                </div>

                {/* Real violation snapshot, or an honest "no snapshot" state */}
                <div style={{ padding: '10px 12px 4px' }}>
                  <SnapshotImage snapshotUrl={alert.snapshotUrl} alt={`Snapshot for alert ${alert.id}`} height={140} />
                </div>

                {/* Alert metadata */}
                <div style={{ padding: '8px 12px 12px', fontSize: 11 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
                    <p style={{ margin: 0, color: '#6B7280' }}>Zone: <strong style={{ color: '#111827' }}>{alert.zoneName}</strong></p>
                    <p style={{ margin: 0, color: '#6B7280' }}>Camera: <strong style={{ color: '#111827', fontFamily: 'monospace' }}>{alert.cameraId}</strong></p>
                    <p style={{ margin: 0, color: '#6B7280' }}>Worker: <strong style={{ color: '#111827' }}>{alert.workerName}</strong></p>
                    <p style={{ margin: 0, color: '#6B7280' }}>Time: <strong style={{ color: '#111827', fontFamily: 'monospace' }}>{alert.timestamp}</strong></p>
                  </div>
                  <p style={{ margin: '6px 0 0', color: '#6B7280' }}>
                    Missing PPE:{' '}
                    <strong style={{ color: severityColor(alert.severity) }}>
                      {alert.missingPpe.map(p => PPE_LABEL[p] ?? p).join(', ')}
                    </strong>
                  </p>
                  {alert.acknowledgedBy && (
                    <p style={{ margin: '4px 0 0', color: '#6B7280', fontSize: 10 }}>
                      Acknowledged by {alert.acknowledgedBy}
                      {alert.acknowledgedAt ? ` at ${new Date(alert.acknowledgedAt).toLocaleTimeString('en-GB')}` : ''}
                    </p>
                  )}
                  {alert.resolvedBy && (
                    <p style={{ margin: '2px 0 0', color: '#4F9E7C', fontSize: 10 }}>
                      ✓ Resolved by {alert.resolvedBy}
                      {alert.resolutionNotes ? ` — ${alert.resolutionNotes.slice(0, 80)}…` : ''}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Footer ─────────────────────────────────────── */}
      <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9CA3AF' }}>
        <span>{SITE_NAME} — PPE Compliance Report — {date}</span>
        <span>Generated by {user?.name ?? 'System'} · {formatDate(Date.now())}</span>
      </div>
    </div>
  );
}
