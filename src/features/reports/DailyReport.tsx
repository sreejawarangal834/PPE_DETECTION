import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getDailyReport } from '../../api/reportsApi';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';
import Button from '../../components/ui/Button';
import { Download, FileSpreadsheet, FileText, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { generateExcelWorkbook } from '../../lib/utils';

const TT = {
  contentStyle: { background: 'var(--color-chart-tooltip-bg)', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '11px', color: 'var(--color-text-primary)' },
};

function complianceFill(v: number) {
  if (v >= 80) return 'var(--color-compliance-good)';
  if (v >= 60) return 'var(--color-compliance-warn)';
  return 'var(--color-compliance-bad)';
}

export default function DailyReport() {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const { data: report, isLoading } = useQuery({
    queryKey: ['reports', 'daily', date],
    queryFn: () => getDailyReport(date),
    staleTime: 300_000,
  });

  if (isLoading) return <LoadingSkeleton variant="chart" />;
  if (!report) return null;

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Date Picker with Calendar Icon */}
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4A8FA3]" aria-hidden="true" />
          <input 
            type="date" 
            value={date} 
            onChange={e => setDate(e.target.value)}
            className="bg-[#1B1F27] border border-[#21252D] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#E8EAF0] focus:outline-none focus:ring-2 focus:ring-[#4A8FA3] focus:border-[#4A8FA3] transition-all duration-200"
          />
        </div>
        
        {/* Excel Button */}
        <button
          onClick={() => generateExcelWorkbook([{
            name: 'Daily',
            data: report.zoneBreakdown.map(z => ({ Zone: z.zoneName, 'Compliance %': z.compliance, Violations: z.violations })),
            metadata: [`Date: ${date}`, `Overall: ${report.overallCompliance}%`],
          }], `daily-report-${date}`)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#217346] to-[#4F9E7C] hover:from-[#217346]/90 hover:to-[#4F9E7C]/90 shadow-lg shadow-[#4F9E7C]/20 transition-all duration-300 transform hover:scale-105 hover:shadow-[#4F9E7C]/30"
        >
          <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
          Excel
        </button>
        
        {/* PDF Button */}
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#C25450] to-[#E85D4A] hover:from-[#C25450]/90 hover:to-[#E85D4A]/90 shadow-lg shadow-[#C25450]/20 transition-all duration-300 transform hover:scale-105 hover:shadow-[#C25450]/30"
        >
          <FileText className="w-4 h-4" aria-hidden="true" />
          PDF
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Overall Compliance', value: `${report.overallCompliance}%`, color: complianceFill(report.overallCompliance) },
          { label: 'Workers Tracked',    value: String(report.totalWorkers),     color: 'var(--color-text-primary)' },
          { label: 'Total Violations',   value: String(report.totalViolations),  color: 'var(--color-status-danger)' },
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
              {['Shift','Workers','Violations','Compliance'].map(h => (
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
