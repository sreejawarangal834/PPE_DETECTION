import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDailyReport } from '../../api/reportsApi';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';
import { Calendar, FileSpreadsheet, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { generateExcelWorkbook } from '../../lib/utils';
import { printReport } from '../../lib/utils/printReport';
import { buildDailyReportHTML } from '../../lib/utils/buildDailyReportHTML';
import { useAlertStore } from '../../lib/alerts/alertStore';
import { useAuthStore } from '../../lib/auth/authStore';

const TT = {
  contentStyle: {
    background: 'var(--color-chart-tooltip-bg)',
    border: '1px solid var(--color-border)',
    borderRadius: '6px',
    fontSize: '11px',
    color: 'var(--color-text-primary)',
  },
};

function complianceFill(v: number) {
  if (v >= 80) return 'var(--color-compliance-good)';
  if (v >= 60) return 'var(--color-compliance-warn)';
  return 'var(--color-compliance-bad)';
}

export default function DailyReport() {
  const [date, setDate]         = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isPrinting, setIsPrinting] = useState(false);

  const { data: report, isLoading } = useQuery({
    queryKey: ['reports', 'daily', date],
    queryFn:  () => getDailyReport(date),
    staleTime: 300_000,
  });

  const alerts  = useAlertStore(s => s.alerts);
  const user    = useAuthStore(s => s.user);

  if (isLoading) return <LoadingSkeleton variant="chart" />;
  if (!report) return null;

  /** Generate HTML string → inject into iframe → print */
  function handlePDFExport() {
    setIsPrinting(true);
    try {
      const html = buildDailyReportHTML(report!, date, alerts, user?.name ?? 'System');
      printReport(html, `Daily Compliance Report — ${date}`);
    } finally {
      // Re-enable button after a short delay (iframe handles its own cleanup)
      setTimeout(() => setIsPrinting(false), 1500);
    }
  }

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-accent" aria-hidden="true" />
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="bg-panel border border-border-soft rounded-xl pl-10 pr-4 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-all duration-200"
          />
        </div>

        {/* Excel */}
        <button
          onClick={() => generateExcelWorkbook([{
            name: 'Daily',
            data: report.zoneBreakdown.map(z => ({
              Zone: z.zoneName, 'Compliance %': z.compliance, Violations: z.violations,
            })),
            metadata: [`Date: ${date}`, `Overall: ${report.overallCompliance}%`],
          }], `daily-report-${date}`)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#217346] to-[#4F9E7C] hover:opacity-90 shadow-lg shadow-[#4F9E7C]/20 transition-all duration-200"
        >
          <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
          Excel
        </button>

        {/* PDF — generates HTML and prints via hidden iframe */}
        <button
          onClick={handlePDFExport}
          disabled={isPrinting}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#C25450] to-[#E85D4A] hover:opacity-90 shadow-lg shadow-[#C25450]/20 transition-all duration-200 disabled:opacity-60"
        >
          {isPrinting ? (
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
          ) : (
            <FileText className="w-4 h-4" aria-hidden="true" />
          )}
          {isPrinting ? 'Preparing…' : 'Download PDF'}
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Overall Compliance', value: `${report.overallCompliance}%`,  color: complianceFill(report.overallCompliance) },
          { label: 'Workers Tracked',    value: String(report.totalWorkers),      color: 'var(--color-text-primary)' },
          { label: 'Total Violations',   value: String(report.totalViolations),   color: 'var(--color-status-danger)' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-panel border border-border-soft rounded-xl p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted mb-2">{label}</p>
            <p className="text-3xl font-bold leading-none" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Zone compliance bar chart */}
      <div className="bg-panel border border-border-soft rounded-xl p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted mb-4">Zone-Wise Compliance</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={report.zoneBreakdown} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="var(--color-chart-grid)" vertical={false} />
            <XAxis dataKey="zoneName"
              tick={{ fill: 'var(--color-chart-tick)', fontSize: 10 }}
              axisLine={false} tickLine={false}
              tickFormatter={v => v.split(' ')[0]} />
            <YAxis domain={[0, 100]}
              tick={{ fill: 'var(--color-chart-tick)', fontSize: 10 }}
              axisLine={false} tickLine={false} width={28} />
            <Tooltip {...TT} formatter={(v: unknown) => [`${v}%`, 'Compliance']} />
            <Bar dataKey="compliance" radius={[3, 3, 0, 0]}>
              {report.zoneBreakdown.map((z, i) => (
                <Cell key={i} fill={complianceFill(z.compliance)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Shift breakdown table */}
      <div className="bg-panel border border-border-soft rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border-soft">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Shift Breakdown</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-panel-alt text-xs text-text-muted">
              {['Shift', 'Workers', 'Violations', 'Compliance'].map(h => (
                <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {report.shiftBreakdown.map(s => (
              <tr key={s.shift} className="border-t border-border-soft hover:bg-panel-hover transition-colors">
                <td className="px-4 py-3 text-text-primary capitalize font-medium">{s.shift}</td>
                <td className="px-4 py-3 text-text-secondary font-mono">{s.workers}</td>
                <td className="px-4 py-3 text-status-danger font-mono font-medium">{s.violations}</td>
                <td className="px-4 py-3 font-mono font-bold" style={{ color: complianceFill(s.compliance) }}>
                  {s.compliance}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
