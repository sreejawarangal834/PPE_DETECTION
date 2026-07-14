import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getWorkerById } from '../../api/workersApi';
import { useAlertStore } from '../../lib/alerts/alertStore';
import ComplianceHistoryChart from './ComplianceHistoryChart';
import ZoneEntryExitLog from './ZoneEntryExitLog';
import PageShell from '../../components/ui/PageShell';
import Badge from '../../components/ui/Badge';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';
import { ROUTES } from '../../constants/routes';
import { PPE_LABEL } from '../../constants/ppeTypes';

export default function WorkerProfilePage() {
  const { workerId } = useParams<{ workerId: string }>();
  const navigate = useNavigate();
  const { data: worker, isLoading } = useQuery({
    queryKey: ['worker', workerId],
    queryFn: () => getWorkerById(workerId!),
    enabled: !!workerId,
    staleTime: 30_000,
  });
  const recentAlerts = useAlertStore(s => s.alerts)
    .filter(a => a.workerId === workerId)
    .slice(0, 10);

  if (isLoading) return <PageShell><LoadingSkeleton variant="table" /></PageShell>;
  if (!worker) return <PageShell><p className="text-status-danger">Worker not found.</p></PageShell>;

  return (
    <PageShell><div className="space-y-6 max-w-5xl">
      <button onClick={() => navigate(ROUTES.WORKERS)} className="text-sm text-accent hover:underline flex items-center gap-1">
        ← Back to workers
      </button>

      {/* Header card */}
      <div className="bg-panel border border-border-soft rounded-xl p-6 flex items-start gap-6">
        <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center text-2xl font-bold text-accent shrink-0">
          {worker.name.charAt(0)}
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-text-primary">{worker.name}</h1>
          <p className="text-sm text-text-muted">{worker.id} · {worker.department}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant={worker.complianceRate >= 80 ? 'compliant' : 'non_compliant'} label={`${worker.complianceRate}% compliant`} />
            {worker.activeViolations > 0 && <Badge variant="high" label={`${worker.activeViolations} active violation${worker.activeViolations > 1 ? 's' : ''}`} />}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-center shrink-0">
          {[['Total Violations', worker.totalViolations],['Current Zone', worker.currentZoneName ?? 'Off-site']].map(([l,v]) => (
            <div key={l} className="bg-panel-alt rounded-lg px-4 py-2">
              <p className="text-xs text-text-muted">{l}</p>
              <p className="text-lg font-semibold text-text-primary">{v}</p>
            </div>
          ))}
        </div>
      </div>

      <ComplianceHistoryChart workerId={worker.id} complianceRate={worker.complianceRate} />

      {/* Recent violations */}
      <div className="bg-panel border border-border-soft rounded-xl p-4">
        <h2 className="text-sm font-semibold text-text-secondary mb-3">Recent Violations (last 10)</h2>
        {recentAlerts.length === 0 ? (
          <p className="text-sm text-text-muted">No recent violations.</p>
        ) : (
          <div className="divide-y divide-border-soft">
            {recentAlerts.map(a => (
              <div key={a.id} className="py-3 flex items-center gap-3">
                <Badge variant={a.severity} />
                <div className="flex-1">
                  <p className="text-sm text-text-primary">{a.missingPpe.map(p => PPE_LABEL[p] ?? p).join(', ')}</p>
                  <p className="text-xs text-text-muted">{a.timestamp} · {a.zoneName}</p>
                </div>
                <Badge variant={a.status} />
              </div>
            ))}
          </div>
        )}
      </div>

      <ZoneEntryExitLog workerId={worker.id} />
    </div>
    </PageShell>
  );
}
