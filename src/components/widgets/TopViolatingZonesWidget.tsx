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
    <div className="bg-panel border border-border-soft rounded-xl p-4 flex flex-col gap-1">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
          Top Violating Zones
        </p>
        <select
          value={window_}
          onChange={e => setWindow(e.target.value as Window)}
          aria-label="Time window"
          className="text-xs bg-[#20242D] border border-[#262B34] rounded px-2 py-1 text-[#9BA3B8] focus:outline-none focus:ring-1 focus:ring-[#4A8FA3]"
        >
          {WINDOWS.map(w => <option key={w.id} value={w.id}>{w.label}</option>)}
        </select>
      </div>

      {!hasAny ? (
        <p className="text-xs text-text-muted py-6 text-center">
          No violations detected in the selected time period.
        </p>
      ) : (
        <div>
          {zones.map((z, idx) => {
            const pct        = (z.violations / maxV) * 100;
            const hasViolation = z.violations > 0;
            return (
              <button
                key={z.zoneId}
                onClick={() => onZoneClick(z.zoneId)}
                className={`w-full flex items-center gap-3 py-2.5 border-b border-[#21252D] last:border-0 hover:bg-[#252A35] transition-colors duration-150 rounded-sm text-left px-1 ${idx === 0 ? 'pt-1' : ''}`}
              >
                {/* Rank */}
                <span className="text-xs font-mono text-[#5C6480] w-4 shrink-0 text-right">
                  {idx + 1}
                </span>
                {/* Zone name */}
                <span className={`text-sm flex-1 truncate ${hasViolation ? 'text-[#E8EAF0]' : 'text-[#9BA3B8]'}`}>
                  {z.zoneName}
                </span>
                {/* Bar */}
                <div className="flex-1 h-1 bg-[#20242D] rounded-full overflow-hidden mx-3">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      background: hasViolation ? '#C25450' : '#21252D',
                    }}
                  />
                </div>
                {/* Count */}
                <span className={`text-sm font-mono font-bold w-6 text-right shrink-0 ${hasViolation ? 'text-[#C25450]' : 'text-[#9BA3B8]'}`}>
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
