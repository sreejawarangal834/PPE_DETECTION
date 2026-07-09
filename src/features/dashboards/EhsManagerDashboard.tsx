/**
 * EHS Manager Dashboard — reports landing.
 * Shows KPI strip then the full reports tab shell.
 */
import { useQuery } from '@tanstack/react-query';
import { getKpiSummary } from '../../api/reportsApi';
import KPICard from '../../components/widgets/KPICard';
import ErrorBoundary from '../../components/ui/ErrorBoundary';
import { formatDuration } from '../../lib/utils';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';

export default function EhsManagerDashboard() {
  const { data: kpi, isLoading } = useQuery({ queryKey: ['reports', 'kpi'], queryFn: getKpiSummary, staleTime: 300_000 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Reports & Analytics</h1>
        <p className="text-sm text-text-muted mt-1">Compliance overview and detailed reporting</p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <ErrorBoundary>
          <KPICard title="Overall Compliance" value={kpi ? `${kpi.overallCompliance}%` : '—'}
            trend={kpi ? { direction: kpi.complianceTrend >= 0 ? 'up' : 'down', delta: `${Math.abs(kpi.complianceTrend)}%`, positive: true } : undefined}
            isLoading={isLoading} />
        </ErrorBoundary>
        <ErrorBoundary>
          <KPICard title="Active Violations" value={kpi ? String(kpi.totalActiveViolations) : '—'}
            trend={kpi ? { direction: kpi.violationsTrend <= 0 ? 'down' : 'up', delta: String(Math.abs(kpi.violationsTrend)), positive: false } : undefined}
            isLoading={isLoading} />
        </ErrorBoundary>
        <ErrorBoundary>
          <KPICard title="Zones at Risk" value={kpi ? String(kpi.zonesAtRisk) : '—'} isLoading={isLoading} />
        </ErrorBoundary>
        <ErrorBoundary>
          <KPICard title="Avg Response Time" value={kpi ? formatDuration(kpi.avgResponseTimeMs) : '—'} isLoading={isLoading} />
        </ErrorBoundary>
      </div>

      {/* Quick links to reports */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Daily Report',    path: ROUTES.REPORTS,           tab: 'daily'   },
          { label: 'Weekly Report',   path: ROUTES.REPORTS,           tab: 'weekly'  },
          { label: 'Worker Report',   path: ROUTES.REPORTS,           tab: 'workers' },
          { label: 'Ad-Hoc Query',    path: ROUTES.REPORTS_ANALYTICS, tab: ''        },
        ].map(item => (
          <Link key={item.label} to={`${item.path}${item.tab ? `?tab=${item.tab}` : ''}`}
            className="bg-panel border border-border-soft rounded-xl p-4 hover:border-accent transition-colors text-sm font-medium text-text-secondary hover:text-text-primary">
            {item.label} →
          </Link>
        ))}
      </div>
    </div>
  );
}
