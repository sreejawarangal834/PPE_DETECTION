import { useQuery } from '@tanstack/react-query';
import { getKpiSummary } from '../../api/reportsApi';
import KPICard from '../../components/widgets/KPICard';
import PlantLayoutWidget from '../../components/widgets/PlantLayoutWidget';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';
import { formatDuration } from '../../lib/utils';
import { TrendingUp, AlertTriangle, MapPin, Users, Clock } from 'lucide-react';
import PageShell from '../../components/ui/PageShell';

export default function KpiSummaryPage() {
  const { data: kpi, isLoading } = useQuery({
    queryKey: ['reports', 'kpi'],
    queryFn: getKpiSummary,
    staleTime: 300_000,
  });

  const avgRt = kpi?.avgResponseTimeMs ? formatDuration(kpi.avgResponseTimeMs) : '—';

  return (
    <PageShell>
      <div className="space-y-6 max-w-5xl">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Safety Summary</h1>
        <p className="text-sm text-text-muted mt-1">Site-wide safety performance at a glance</p>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard
          title="Overall Compliance"
          value={kpi ? `${kpi.overallCompliance}%` : '—'}
          trend={kpi ? {
            direction: kpi.complianceTrend >= 0 ? 'up' : 'down',
            delta: `${Math.abs(kpi.complianceTrend)}%`,
            positive: true,
          } : undefined}
          sparklineData={kpi?.sparklineData}
          icon={<TrendingUp className="w-4 h-4" />}
          isLoading={isLoading}
        />
        <KPICard
          title="Active Violations"
          value={kpi ? String(kpi.totalActiveViolations) : '—'}
          trend={kpi ? {
            direction: kpi.violationsTrend <= 0 ? 'down' : 'up',
            delta: String(Math.abs(kpi.violationsTrend)),
            positive: false,
          } : undefined}
          icon={<AlertTriangle className="w-4 h-4" />}
          isLoading={isLoading}
        />
        <KPICard
          title="Areas of Concern"
          value={kpi ? String(kpi.zonesAtRisk) : '—'}
          trend={kpi ? {
            direction: kpi.zonesAtRiskTrend === 0 ? 'neutral' : kpi.zonesAtRiskTrend > 0 ? 'up' : 'down',
            delta: String(Math.abs(kpi.zonesAtRiskTrend)),
            positive: false,
          } : undefined}
          icon={<MapPin className="w-4 h-4" />}
          isLoading={isLoading}
        />
        <KPICard
          title="Workers on Site"
          value={kpi ? String(kpi.workersTrackedToday) : '—'}
          icon={<Users className="w-4 h-4" />}
          isLoading={isLoading}
        />
        <KPICard
          title="Avg Response Time"
          value={avgRt}
          trend={kpi ? {
            direction: kpi.avgResponseTimeTrend <= 0 ? 'down' : 'up',
            delta: `${Math.abs(kpi.avgResponseTimeTrend)}s`,
            positive: true,
          } : undefined}
          icon={<Clock className="w-4 h-4" />}
          isLoading={isLoading}
        />
      </div>

      {/* Plant Layout Heatmap */}
      <PlantLayoutWidget readonly />

      {/* Written Summary */}
      <div className="bg-panel border border-border-soft rounded-xl p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted mb-3">Site Safety Summary</p>
        {isLoading ? (
          <LoadingSkeleton variant="line" className="h-4 w-3/4" />
        ) : (
          <p className="text-sm text-text-secondary leading-relaxed">
            {kpi?.writtenSummary ?? 'No summary available.'}
          </p>
        )}
      </div>
    </div>
    </PageShell>
  );
}
