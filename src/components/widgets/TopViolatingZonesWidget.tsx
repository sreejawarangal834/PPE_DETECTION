import { useState, useEffect } from 'react';
import { mockWsService } from '../../lib/websocket/mockWebSocketService';
import { ZONES } from '../../data/zones';
import { ALERTS } from '../../data/mockData';
import type { WsEvent } from '../../types';

interface ZoneViolation { zoneId: string; zoneName: string; violations: number; }
type Window = 'last_hour' | 'last_4h' | 'last_8h' | 'today';

const WINDOWS: { id: Window; label: string }[] = [
  { id: 'last_hour', label: 'Last Hour' },
  { id: 'last_4h',  label: 'Last 4h'   },
  { id: 'last_8h',  label: 'Last 8h'   },
  { id: 'today',    label: 'Today'      },
];

function seedCounts(assignedZones?: string[]): ZoneViolation[] {
  const counts: Record<string, number> = {};
  ALERTS.filter(a => a.status !== 'resolved').forEach(a => {
    if (assignedZones?.length && !assignedZones.includes(a.zoneId)) return;
    counts[a.zoneId] = (counts[a.zoneId] ?? 0) + 1;
  });
  return ZONES
    .filter(z => !assignedZones?.length || assignedZones.includes(z.id))
    .map(z => ({ zoneId: z.id, zoneName: z.name, violations: counts[z.id] ?? 0 }))
    .sort((a, b) => b.violations - a.violations)
    .slice(0, 5);
}

interface Props { onZoneClick: (zoneId: string) => void; assignedZones?: string[]; }

export default function TopViolatingZonesWidget({ onZoneClick, assignedZones }: Props) {
  const [window_, setWindow] = useState<Window>('last_hour');
  const [zones, setZones]    = useState<ZoneViolation[]>(() => seedCounts(assignedZones));

  useEffect(() => {
    function handler(e: WsEvent) {
      if (e.type !== 'top_zones_update') return;
      const p = e.payload as { zones: { zoneId: string; violations: number }[] };
      setZones(
        p.zones
          .filter(z => !assignedZones?.length || assignedZones.includes(z.zoneId))
          .map(z => ({
            zoneId:    z.zoneId,
            zoneName:  ZONES.find(z2 => z2.id === z.zoneId)?.name ?? z.zoneId,
            violations: z.violations,
          }))
          .sort((a, b) => b.violations - a.violations)
          .slice(0, 5)
      );
    }
    mockWsService.onMessage(handler);
    return () => { mockWsService.removeAllHandlers(); };
  }, [assignedZones]);

  const maxV  = Math.max(...zones.map(z => z.violations), 1);
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
