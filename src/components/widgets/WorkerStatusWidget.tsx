import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { WORKERS } from '../../data/workers';
import { mockWsService } from '../../lib/websocket/mockWebSocketService';
import type { WsEvent } from '../../types';

interface Counts { total: number; compliant: number; nonCompliant: number; }

function computeCounts(zones?: string[]): Counts {
  const ws = WORKERS.filter(w => w.currentZoneId && (!zones?.length || zones.includes(w.currentZoneId)));
  return {
    total:        ws.length,
    compliant:    ws.filter(w => w.complianceRate >= 80).length,
    nonCompliant: ws.filter(w => w.complianceRate < 80).length,
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
    { name: 'Compliant',     value: counts.compliant,    color: 'var(--color-status-ok)'     },
    { name: 'Non-Compliant', value: counts.nonCompliant, color: 'var(--color-status-danger)'  },
  ].filter(d => d.value > 0);

  return (
    <div className="bg-[#1B1F27] border border-[#21252D] rounded-2xl p-5 flex flex-col gap-4 hover:border-[#4A8FA3]/30 transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#9BA3B8]">Workers On-Site</p>
        <span className="text-sm font-mono text-[#E8EAF0] bg-[#20242D] px-3 py-1 rounded-lg">{counts.total} detected</span>
      </div>

      {/* Donut + legend */}
      <div className="flex items-center gap-6">
        <div className="relative w-[120px] h-[120px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data.length ? data : [{ name: 'None', value: 1, color: 'var(--color-border)' }]}
                dataKey="value" cx="50%" cy="50%"
                innerRadius={32} outerRadius={58} strokeWidth={0}>
                {(data.length ? data : [{ color: 'var(--color-border)' }]).map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          {/* Centre count */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-2xl font-bold text-[#E8EAF0]">{counts.total}</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full shrink-0 bg-[#4F9E7C] animate-pulse" />
            <span className="text-[#9BA3B8] font-medium">Compliant</span>
            <span className="font-mono font-bold text-[#4F9E7C] ml-auto">{counts.compliant}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full shrink-0 bg-[#C25450]" />
            <span className="text-[#9BA3B8] font-medium">Non-compliant</span>
            <span className="font-mono font-bold text-[#C25450] ml-auto">{counts.nonCompliant}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
