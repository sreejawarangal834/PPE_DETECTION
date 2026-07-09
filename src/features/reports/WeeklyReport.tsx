import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getWeeklyReport } from '../../api/reportsApi';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';
import Button from '../../components/ui/Button';
import { format, startOfWeek } from 'date-fns';
import { generateExcelWorkbook } from '../../lib/utils';
import { FileSpreadsheet, FileText, Calendar } from 'lucide-react';

const TT = { contentStyle: { background: 'var(--color-panel)', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 11 } };

export default function WeeklyReport() {
  const [weekStart, setWeekStart] = useState(format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'));
  const { data: days = [], isLoading } = useQuery({
    queryKey: ['reports', 'weekly', weekStart],
    queryFn: () => getWeeklyReport(weekStart),
    staleTime: 300_000,
  });

  if (isLoading) return <LoadingSkeleton variant="chart" />;

  const chartData = days.map((d, i) => ({ day: `Day ${i + 1}`, compliance: d.overallCompliance, violations: d.totalViolations }));
  const topZones = days[0]?.zoneBreakdown.sort((a, b) => b.violations - a.violations).slice(0, 3) ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4 flex-wrap">
        {/* Date Picker with Calendar Icon */}
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4A8FA3]" aria-hidden="true" />
          <input 
            type="date" 
            value={weekStart} 
            onChange={e => setWeekStart(e.target.value)}
            className="bg-[#1B1F27] border border-[#21252D] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#E8EAF0] focus:outline-none focus:ring-2 focus:ring-[#4A8FA3] focus:border-[#4A8FA3] transition-all duration-200"
          />
        </div>
        
        {/* Excel Button */}
        <button
          onClick={() => generateExcelWorkbook([{
            name: 'Weekly',
            data: chartData.map(d => ({ Day: d.day, 'Compliance %': d.compliance, Violations: d.violations })),
          }], `weekly-report-${weekStart}`)}
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

      <div className="bg-panel border border-border-soft rounded-xl p-4">
        <p className="text-sm font-semibold text-text-secondary mb-3">7-Day Compliance Trend</p>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={chartData} margin={{ left: -10 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="var(--color-border-soft)" />
            <XAxis dataKey="day" tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} />
            <YAxis domain={[0, 100]} tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} />
            <Tooltip {...TT} />
            <Line type="monotone" dataKey="compliance" stroke="var(--color-accent)" strokeWidth={2} dot={false} name="Compliance %" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-panel border border-border-soft rounded-xl p-4">
          <p className="text-sm font-semibold text-text-secondary mb-3">Top Violating Zones</p>
          {topZones.map(z => (
            <div key={z.zoneId} className="flex items-center justify-between py-1.5 border-b border-border-soft last:border-0">
              <span className="text-sm text-text-primary">{z.zoneName}</span>
              <span className="text-sm font-mono text-status-danger">{z.violations}</span>
            </div>
          ))}
        </div>
        <div className="bg-panel border border-border-soft rounded-xl p-4">
          <p className="text-sm font-semibold text-text-secondary mb-3">Weekly Summary</p>
          <div className="space-y-2">
            <p className="text-sm text-text-secondary">Avg compliance: <span className="text-text-primary font-medium">{Math.round(chartData.reduce((s, d) => s + d.compliance, 0) / Math.max(chartData.length, 1))}%</span></p>
            <p className="text-sm text-text-secondary">Total violations: <span className="text-status-danger font-medium">{chartData.reduce((s, d) => s + d.violations, 0)}</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
