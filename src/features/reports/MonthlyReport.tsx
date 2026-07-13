import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMonthlyReport } from '../../api/reportsApi';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';
import { format } from 'date-fns';
import { generateExcelWorkbook } from '../../lib/utils';
import { FileSpreadsheet, FileText, Calendar } from 'lucide-react';

const TT = { contentStyle: { background: 'var(--color-panel)', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 11 } };
const PPE_COLORS = ['var(--color-severity-high)','var(--color-severity-medium)','var(--color-accent)','var(--color-status-ok)','var(--color-severity-low)','var(--color-status-info)'];

export default function MonthlyReport() {
  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const { data: days = [], isLoading } = useQuery({
    queryKey: ['reports', 'monthly', month],
    queryFn: () => getMonthlyReport(month),
    staleTime: 300_000,
  });

  if (isLoading) return <LoadingSkeleton variant="chart" />;

  const chartData = days.map((d, i) => ({ day: `${i + 1}`, compliance: d.overallCompliance, violations: d.totalViolations }));
  const ppePie = [
    { name: 'Helmet', value: 34 }, { name: 'Vest', value: 22 }, { name: 'Gloves', value: 18 },
    { name: 'Mask', value: 12 }, { name: 'Shoes', value: 9 }, { name: 'Eye Prot', value: 5 },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4 flex-wrap">
        {/* Month Picker with Calendar Icon */}
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4A8FA3]" aria-hidden="true" />
          <input 
            type="month" 
            value={month} 
            onChange={e => setMonth(e.target.value)}
            className="bg-[#1B1F27] border border-[#21252D] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#E8EAF0] focus:outline-none focus:ring-2 focus:ring-[#4A8FA3] focus:border-[#4A8FA3] transition-all duration-200"
          />
        </div>
        
        {/* Excel Button */}
        <button
          onClick={() => generateExcelWorkbook([{
            name: 'Monthly',
            data: chartData.map(d => ({ Day: d.day, 'Compliance %': d.compliance, Violations: d.violations })),
          }], `monthly-report-${month}`)}
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
        <p className="text-sm font-semibold text-text-secondary mb-3">30-Day Compliance Trend</p>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={chartData} margin={{ left: -10 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="var(--color-border-soft)" />
            <XAxis dataKey="day" tick={{ fill: 'var(--color-text-muted)', fontSize: 9 }} interval={4} />
            <YAxis domain={[0, 100]} tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} />
            <Tooltip {...TT} />
            <Line type="monotone" dataKey="compliance" stroke="var(--color-accent)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-panel border border-border-soft rounded-xl p-4">
          <p className="text-sm font-semibold text-text-secondary mb-3">PPE Category Breakdown</p>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={120} height={120}>
              <PieChart>
                <Pie data={ppePie} dataKey="value" cx="50%" cy="50%" innerRadius={28} outerRadius={50} strokeWidth={0}>
                  {ppePie.map((_, i) => <Cell key={i} fill={PPE_COLORS[i % PPE_COLORS.length]} />)}
                </Pie>
                <Tooltip {...TT} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1 text-xs">
              {ppePie.map((p, i) => (
                <div key={p.name} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: PPE_COLORS[i % PPE_COLORS.length] }} />
                  <span className="text-text-secondary">{p.name}: <strong className="text-text-primary">{p.value}%</strong></span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="bg-panel border border-border-soft rounded-xl p-4">
          <p className="text-sm font-semibold text-text-secondary mb-3">Monthly Summary</p>
          <div className="space-y-2">
            <p className="text-sm text-text-secondary">Avg compliance: <span className="text-text-primary font-medium">{Math.round(chartData.reduce((s, d) => s + d.compliance, 0) / Math.max(chartData.length, 1))}%</span></p>
            <p className="text-sm text-text-secondary">Total violations: <span className="text-status-danger font-medium">{chartData.reduce((s, d) => s + d.violations, 0)}</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
