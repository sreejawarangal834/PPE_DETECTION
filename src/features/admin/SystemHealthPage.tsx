import { useQuery } from '@tanstack/react-query';
import { getSystemHealth } from '../../api/adminApi';
import Badge from '../../components/ui/Badge';
import LoadingSkeleton from '../../components/ui/LoadingSkeleton';
import { formatRelative } from '../../lib/utils';
import { AlertTriangle } from 'lucide-react';

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

  if (isLoading) return <div className="p-6"><LoadingSkeleton variant="table" /></div>;

  return (
    <div className="p-6 space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#E8EAF0]">System Health</h1>
        <p className="text-sm text-[#5C6480] mt-1">Live status of cameras and backend services</p>
      </div>

      {/* Alert banner */}
      {hasOffline && (
        <div className="flex items-center gap-3 bg-[rgba(194,84,80,0.1)] border border-[rgba(194,84,80,0.3)] rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-[#C25450] shrink-0" aria-hidden="true" />
          <p className="text-sm text-[#C25450]">One or more components have been offline for more than 5 minutes.</p>
        </div>
      )}

      {/* Backend services */}
      <section>
        <p className="text-xs font-medium uppercase tracking-wide text-[#5C6480] mb-3">Backend Services</p>
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
        <p className="text-xs font-medium uppercase tracking-wide text-[#5C6480] mb-3">Cameras</p>
        <div className="bg-panel border border-border-soft rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-panel-alt text-xs text-text-muted">
                {['Camera ID','Name','Status','Last Seen'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cameras.map(c => (
                <tr key={c.id} className="border-t border-border-soft hover:bg-panel-hover transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-text-muted">{c.id}</td>
                  <td className="px-4 py-3 text-text-primary font-medium">{c.name}</td>
                  <td className="px-4 py-3">
                    <Badge variant={c.status as 'online' | 'offline' | 'degraded'} />
                  </td>
                  <td className="px-4 py-3 text-text-muted text-xs font-mono">
                    {formatRelative(c.lastHeartbeat)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
