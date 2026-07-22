import { useQuery } from '@tanstack/react-query';
import { getSystemHealth } from '../../api/adminApi';
import Badge from '../../components/ui/Badge';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';
import { formatRelative } from '../../lib/utils';
import { AlertTriangle } from 'lucide-react';
import PageShell from '../../components/ui/PageShell';

export default function SystemHealthPage() {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['admin', 'system-health'],
    queryFn: getSystemHealth,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const cameras  = items.filter(i => i.type === 'camera');
  const services = items.filter(i => i.type === 'service');
  const hasOffline = items.some(i => i.status === 'offline' && (i.offlineSinceMs ?? 0) > 5 * 60_000);

  if (isLoading) return <PageShell><LoadingSkeleton variant="table" /></PageShell>;

  return (
    <PageShell><div className="space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">System Health</h1>
        <p className="text-sm text-text-muted mt-1">Live status of cameras and backend services</p>
      </div>

      {/* Alert banner */}
      {hasOffline && (
        <div className="flex items-center gap-3 bg-status-danger/10 border border-status-danger/30 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-status-danger shrink-0" aria-hidden="true" />
          <p className="text-sm text-status-danger">One or more components have been offline for more than 5 minutes.</p>
        </div>
      )}

      {/* Backend services */}
      <section>
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted mb-3">Backend Services</p>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {services.map(s => (
            <div key={s.id} className="bg-panel border border-border-soft rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-text-primary">{s.name}</p>
                <Badge variant={s.status as 'online' | 'offline' | 'degraded'} />
              </div>
              <p className="text-xs text-text-muted font-mono">
                Last heartbeat: {formatRelative(s.lastHeartbeat)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Cameras */}
      <section>
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted mb-3">Cameras</p>
        <div className="bg-panel border border-border-soft rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-panel-alt text-xs text-text-secondary uppercase tracking-wider">
                {['Camera ID','Name','Status','Last Seen'].map(h => (
                  <th key={h} className="px-6 py-4 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-soft">
              {cameras.map(c => (
                <tr key={c.id} className="hover:bg-panel-hover/50 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs text-text-muted">{c.id}</td>
                  <td className="px-6 py-4 text-text-primary font-medium">{c.name}</td>
                  <td className="px-6 py-4">
                    <Badge variant={c.status as 'online' | 'offline' | 'degraded'} />
                  </td>
                  <td className="px-6 py-4 text-text-muted text-xs font-mono">
                    {formatRelative(c.lastHeartbeat)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
    </PageShell>
  );
}
