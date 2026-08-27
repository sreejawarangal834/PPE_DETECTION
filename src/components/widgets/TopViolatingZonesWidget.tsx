import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getLiveStats } from '../../api/analyticsApi';

type Window = 'last_hour' | 'last_4h' | 'last_8h' | 'today';

const WINDOWS: { id: Window; label: string; minutes: number }[] = [
  { id: 'last_hour', label: 'Last Hour', minutes: 60 },
  { id: 'last_4h',  label: 'Last 4h',   minutes: 4 * 60 },
  { id: 'last_8h',  label: 'Last 8h',   minutes: 8 * 60 },
  { id: 'today',    label: 'Today',      minutes: 24 * 60 },
];

interface Props { onZoneClick: (zoneId: string) => void; assignedZones?: string[]; }

/**
 * Real per-zone violation counts (GET /api/analytics/live-stats). Previously seeded from
 * src/data/mockData.ts's fabricated ALERTS array and "updated" by a fake top_zones_update
 * event whose window selector was purely decorative (the seed/mock update never actually
 * varied by the selected window) — this version's window selector is real: it's the query
 * parameter sent to the backend.
 */
export default function TopViolatingZonesWidget({ onZoneClick, assignedZones }: Props) {
  const [window_, setWindow] = useState<Window>('last_hour');
  const minutes = WINDOWS.find(w => w.id === window_)!.minutes;

  const { data } = useQuery({
    queryKey: ['analytics', 'live-stats', minutes],
    queryFn: () => getLiveStats(minutes),
    refetchInterval: 20_000,
    staleTime: 15_000,
  });

  const zones = (data?.zoneStats ?? [])
    .filter(z => !assignedZones?.length || assignedZones.includes(z.zoneId))
    .sort((a, b) => b.violations - a.violations)
    .slice(0, 5);

  const maxV = Math.max(...zones.map(z => z.violations), 1);
  const hasAny = zones.some(z => z.violations > 0);

  return (
    <div className="bg-panel border border-border-soft rounded-xl p-4 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
          Top Violating Zones
        </p>
        <select
          value={window_}
          onChange={e => setWindow(e.target.value as Window)}
          aria-label="Time window"
          className="text-xs bg-panel-alt border border-border rounded px-2 py-1 text-text-secondary focus:outline-none focus:ring-2 focus:ring-accent"
        >
          {WINDOWS.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
        </select>
      </div>

      {!hasAny ? (
        <p className="text-xs text-text-muted py-6 text-center">
          No violations detected in the selected time period.
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {zones.map(z => {
            const pct          = (z.violations / maxV) * 100;
            const hasViolation = z.violations > 0;
            return (
              <button
                key={z.zoneId}
                onClick={() => onZoneClick(z.zoneId)}
                className="w-full flex items-center gap-3 text-left hover:opacity-85 transition-opacity"
              >
                {/* Zone name */}
                <span className="text-sm text-text-primary w-[120px] shrink-0 truncate">
                  {z.zoneName}
                </span>
                {/* Bar */}
                <div className="flex-1 h-2 bg-panel-alt rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      background: hasViolation ? 'var(--color-status-danger)' : 'var(--color-panel-alt)',
                    }}
                  />
                </div>
                {/* Count */}
                <span className="text-xs font-mono text-text-secondary w-6 text-right shrink-0">
                  {z.violations}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
