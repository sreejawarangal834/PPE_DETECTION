/**
 * Plant Management Dashboard — KPI summary, plant heatmap, plain-language summary.
 * Read-only. No action buttons. No technical jargon.
 */
import { useQuery } from '@tanstack/react-query';
import { getKpiSummary } from '../../api/reportsApi';
import KPICard from '../../components/widgets/KPICard';
import PlantLayoutWidget from '../../components/widgets/PlantLayoutWidget';
import ErrorBoundary from '../../components/ui/ErrorBoundary';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';
import { formatDuration } from '../../lib/utils';

export default function PlantManagementDashboard() {
  const { data: kpi, isLoading } = useQuery({ queryKey: ['reports', 'kpi'], queryFn: getKpiSummary, staleTime: 300_000 });

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Safety Summary</h1>
        <p className="text-sm text-text-muted mt-1">Site-wide safety performance — today</p>
      </div>

      {/* Row 1 — 5 KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <ErrorBoundary>
          <KPICard title="Overall Compliance" value={kpi ? `${kpi.overallCompliance}%` : '—'}
            trend={kpi ? { direction: kpi.complianceTrend >= 0 ? 'up' : 'down', delta: `${Math.abs(kpi.complianceTrend)}%`, positive: true } : undefined}
            sparklineData={kpi?.sparklineData} isLoading={isLoading} />
        </ErrorBoundary>
        <ErrorBoundary>
          <KPICard title="Active Violations" value={kpi ? String(kpi.totalActiveViolations) : '—'}
            trend={kpi ? { direction: kpi.violationsTrend <= 0 ? 'down' : 'up', delta: String(Math.abs(kpi.violationsTrend)), positive: false } : undefined}
            isLoading={isLoading} />
        </ErrorBoundary>
        <ErrorBoundary>
          <KPICard title="Areas of Concern"
            value={kpi ? String(kpi.zonesAtRisk) : '—'}
            trend={kpi ? { direction: kpi.zonesAtRiskTrend === 0 ? 'neutral' : kpi.zonesAtRiskTrend > 0 ? 'up' : 'down', delta: String(Math.abs(kpi.zonesAtRiskTrend)), positive: false } : undefined}
            isLoading={isLoading} />
        </ErrorBoundary>
        <ErrorBoundary>
          <KPICard title="Workers on Site Today" value={kpi ? String(kpi.workersTrackedToday) : '—'} isLoading={isLoading} />
        </ErrorBoundary>
        <ErrorBoundary>
          <KPICard title="Avg Alert Response Time"
            value={kpi ? formatDuration(kpi.avgResponseTimeMs) : '—'}
            trend={kpi ? { direction: kpi.avgResponseTimeTrend <= 0 ? 'down' : 'up', delta: `${Math.abs(kpi.avgResponseTimeTrend)}s`, positive: true } : undefined}
            isLoading={isLoading} />
        </ErrorBoundary>
      </div>

      {/* Row 2 — Plant heatmap (read-only) */}
      <ErrorBoundary>
        <PlantLayoutWidget readonly />
      </ErrorBoundary>

      {/* Row 3 — Plain-language written summary */}
      <div className="bg-panel border border-border-soft rounded-xl p-6">
        <p className="text-xs text-text-muted font-medium uppercase tracking-wide mb-3">Site Safety Summary</p>
        {isLoading ? (
          <LoadingSkeleton variant="line" className="h-4 w-3/4" />
        ) : (
          <p className="text-base text-text-secondary leading-relaxed">
            {kpi?.writtenSummary ?? 'No summary available.'}
          </p>
        )}
      </div>
    </div>
  );
}
