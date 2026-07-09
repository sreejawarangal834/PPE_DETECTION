import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAdHocReport } from '../../api/reportsApi';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';
import MultiSelect from '../../components/ui/MultiSelect';
import DateRangePicker from '../../components/ui/DateRangePicker';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';
import EmptyState from '../../components/ui/EmptyState';
import { ZONES } from '../../data/zones';
import { PPE_TYPES } from '../../constants/ppeTypes';
import { format } from 'date-fns';

const TT = { contentStyle: { background: 'var(--color-panel)', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 11 } };
const ZONE_OPTS = ZONES.map(z => ({ value: z.id, label: z.name }));
const PPE_OPTS  = PPE_TYPES.map(p => ({ value: p.id, label: p.label }));
const GROUP_OPTS = [{ value: 'zone', label: 'By Zone' }, { value: 'ppe', label: 'By PPE Type' }, { value: 'date', label: 'Over Time' }];

export default function AdHocAnalytics() {
  const [zones, setZones] = useState<string[]>([]);
  const [ppeTypes, setPpeTypes] = useState<string[]>([]);
  const [groupBy, setGroupBy] = useState('zone');
  const [dateRange, setDateRange] = useState({ from: format(new Date(Date.now() - 7 * 86400_000), 'yyyy-MM-dd'), to: format(new Date(), 'yyyy-MM-dd') });
  const [enabled, setEnabled] = useState(false);

  const days = (new Date(dateRange.to).getTime() - new Date(dateRange.from).getTime()) / 86400_000;

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['reports', 'adhoc', { zones, ppeTypes, groupBy, dateRange }],
    queryFn: () => getAdHocReport({ zones, ppeTypes, dateRange, groupBy }),
    enabled,
    staleTime: 60_000,
  });

  const useLineChart = groupBy === 'date' && days > 7;
  const chartData = data ? data.labels.map((l, i) => ({ name: l, value: data.values[i] })) : [];

  return (
    <div className="space-y-5">
      <div className="bg-panel border border-border-soft rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <MultiSelect options={ZONE_OPTS} value={zones} onChange={setZones} placeholder="All zones" label="Zone" />
          <MultiSelect options={PPE_OPTS} value={ppeTypes} onChange={setPpeTypes} placeholder="All PPE types" label="PPE Type" />
          <Select options={GROUP_OPTS} value={groupBy} onChange={e => setGroupBy(e.target.value)} label="Group by" />
          <DateRangePicker value={dateRange} onChange={setDateRange} label="Date range" />
        </div>
        <Button onClick={() => setEnabled(true)}>Apply Query</Button>
      </div>

      {isLoading || isFetching ? (
        <LoadingSkeleton variant="chart" />
      ) : !data ? (
        <EmptyState heading="Run a query" message="Set your filters above and click Apply." />
      ) : (
        <div className="space-y-4">
          <div className="bg-panel border border-border-soft rounded-xl p-4">
            <ResponsiveContainer width="100%" height={200}>
              {useLineChart ? (
                <LineChart data={chartData} margin={{ left: -10 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="var(--color-border-soft)" />
                  <XAxis dataKey="name" tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} />
                  <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} />
                  <Tooltip {...TT} />
                  <Line type="monotone" dataKey="value" stroke="var(--color-accent)" strokeWidth={2} dot={false} />
                </LineChart>
              ) : (
                <BarChart data={chartData} layout={groupBy !== 'date' ? 'vertical' : 'horizontal'} margin={{ left: 10 }}>
                  <XAxis dataKey="name" type={groupBy !== 'date' ? 'category' : 'category'} tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} />
                  <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} />
                  <Tooltip {...TT} />
                  <Bar dataKey="value" fill="var(--color-accent)" radius={[3,3,0,0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
          <div className="bg-panel border border-border-soft rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="bg-panel-alt text-xs text-text-muted">
                {Object.keys(data.tableData[0] ?? {}).map(k => <th key={k} className="px-4 py-2 text-left font-medium">{k}</th>)}
              </tr></thead>
              <tbody>{data.tableData.map((row, i) => (
                <tr key={i} className="border-t border-border-soft">
                  {Object.values(row).map((v, j) => <td key={j} className="px-4 py-2 text-text-secondary">{String(v)}</td>)}
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
