import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { WORKERS } from '../../data/workers';
import { mockWsService } from '../../lib/websocket/mockWebSocketService';
import type { WsEvent } from '../../types';

interface Counts { total: number; compliant: number; nonCompliant: number; unknown: number; }

function computeCounts(zones?: string[]): Counts {
  const ws = WORKERS.filter(w => !zones?.length || (w.currentZoneId && zones.includes(w.currentZoneId)));
  const tracked = ws.filter(w => w.currentZoneId);
  return {
    total:        ws.length,
    compliant:    tracked.filter(w => w.complianceRate >= 80).length,
    nonCompliant: tracked.filter(w => w.complianceRate < 80).length,
    unknown:      ws.filter(w => !w.currentZoneId).length,
  };
}

export default function WorkerStatusWidget({ assignedZones }: { assignedZones?: string[] }) {
  const [counts, setCounts] = useState<Counts>(() => computeCounts(assignedZones));

  useEffect(() => {
    function handler(e: WsEvent) {
      if (e.type === 'worker_update') setCounts(computeCounts(assignedZones));
    }
    mockWsService.onMessage(handler);
    return () => { mockWsService.removeAllHandlers(); };
  }, [assignedZones]);

  const data = [
    { name: 'Compliant',     value: counts.compliant,    color: 'var(--color-compliance-good)' },
    { name: 'Non-Compliant', value: counts.nonCompliant, color: 'var(--color-compliance-bad)'  },
    { name: 'Unknown',       value: counts.unknown,      color: 'var(--color-text-muted)'      },
  ].filter(d => d.value > 0);

  return (
    <div className="bg-panel border border-border-soft rounded-xl p-4 flex flex-col">
      {/* Header */}
      <p className="text-xs font-medium uppercase tracking-wide text-text-muted mb-3">Worker Status</p>

      {/* Donut + legend */}
      <div className="flex items-center gap-4">
        <div className="relative w-[88px] h-[88px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data.length ? data : [{ name: 'None', value: 1, color: 'var(--color-panel-alt)' }]}
                dataKey="value" cx="50%" cy="50%"
                innerRadius={26} outerRadius={44} strokeWidth={0}>
                {(data.length ? data : [{ color: 'var(--color-panel-alt)' }]).map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          {/* Centre count */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-lg font-bold text-text-primary leading-none">{counts.total}</span>
            <span className="text-[9px] text-text-muted mt-0.5">total</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-1.5 text-text-secondary min-w-0">
              <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: 'var(--color-compliance-good)' }} />
              <span className="whitespace-nowrap">Compliant</span>
            </span>
            <span className="font-mono font-semibold text-text-primary">{counts.compliant}</span>
          </div>
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-1.5 text-text-secondary min-w-0">
              <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: 'var(--color-compliance-bad)' }} />
              <span className="whitespace-nowrap">Non-Compliant</span>
            </span>
            <span className="font-mono font-semibold text-text-primary">{counts.nonCompliant}</span>
          </div>
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-1.5 text-text-secondary min-w-0">
              <span className="w-2 h-2 rounded-sm shrink-0 bg-text-muted" />
              <span className="whitespace-nowrap">Unknown</span>
            </span>
            <span className="font-mono font-semibold text-text-primary">{counts.unknown}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
