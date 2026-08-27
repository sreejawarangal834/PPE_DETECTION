import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Area, AreaChart,
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { getLiveStats } from '../../api/analyticsApi';
import ComplianceGauge from '../../components/widgets/ComplianceGauge';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';

const TT = {
  contentStyle: {
    background: 'var(--color-chart-tooltip-bg)',
    border: '1px solid var(--color-border)',
    borderRadius: '6px',
    fontSize: '11px',
    color: 'var(--color-text-primary)',
  },
  cursor: { stroke: 'var(--color-border)', strokeWidth: 1 },
};

/**
 * Real site-wide/per-zone/timeline stats (GET /api/analytics/live-stats — see
 * backend/repositories/live_stats.py). Previously seeded with Math.random() at mount and
 * "updated" by a fabricated zone_compliance_update event every few seconds
 * (mockWebSocketService.ts) — a compliance dashboard is exactly the place that must never
 * make numbers up.
 */
export default function ComplianceStats() {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'live-stats'],
    queryFn: () => getLiveStats(60),
    refetchInterval: 20_000,
    staleTime: 15_000,
  });

  if (isLoading || !data) return <LoadingSkeleton variant="chart" />;

  const overall = data.overallCompliance;
  const zoneBars = data.zoneStats.map(z => ({ name: z.zoneName.split(' ')[0], violations: z.violations }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr_1.4fr] gap-4">

      {/* Card 1 — Compliance Gauge */}
      <div className="bg-panel border border-border-soft rounded-xl p-4 flex flex-col">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted mb-3">
          Overall Compliance
        </p>
        <div className="flex-1 flex flex-col items-center justify-center">
          {overall !== null ? (
            <ComplianceGauge value={overall} size={160} label="" />
          ) : (
            <div className="flex flex-col items-center gap-2 text-text-muted">
              <ComplianceGauge value={0} size={160} label="" />
              <p className="text-xs">No tracked activity yet</p>
            </div>
          )}
          <p className="text-xs text-text-muted mt-2 text-center">
            Site-wide · Last 4 hours
          </p>
        </div>
      </div>

      {/* Card 2 — Violations per Zone */}
      <div className="bg-panel border border-border-soft rounded-xl p-4 flex flex-col">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted mb-3">
          Violations Per Zone — Last Hour
        </p>
        <div className="flex-1">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={zoneBars} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="var(--color-chart-grid)" vertical={false} />
              <XAxis dataKey="name"
                tick={{ fill: 'var(--color-chart-tick)', fontSize: 10 }}
                axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: 'var(--color-chart-tick)', fontSize: 10 }}
                axisLine={false} tickLine={false} width={24} allowDecimals={false} />
              <Tooltip {...TT} />
              <Bar dataKey="violations" fill="var(--color-chart-4)"
                radius={[3, 3, 0, 0]} name="Violations" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Card 3 — Violations Timeline */}
      <div className="bg-panel border border-border-soft rounded-xl p-4 flex flex-col">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted mb-3">
          Violations — Last 60 Min
        </p>
        <div className="flex-1">
          {data.timeline.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-text-muted">
              No violations in the last hour
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data.timeline} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--color-chart-1)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="var(--color-chart-grid)" vertical={false} />
                <XAxis dataKey="t"
                  tick={{ fill: 'var(--color-chart-tick)', fontSize: 9 }}
                  axisLine={false} tickLine={false} interval={3} />
                <YAxis
                  tick={{ fill: 'var(--color-chart-tick)', fontSize: 10 }}
                  axisLine={false} tickLine={false} width={24} allowDecimals={false} />
                <Tooltip {...TT} />
                <Area type="monotone" dataKey="violations"
                  stroke="var(--color-chart-1)" strokeWidth={2}
                  fill="url(#areaFill)" dot={false} name="Violations" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
