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
    { name: 'Compliant',     value: counts.compliant,    color: '#22c55e' },
    { name: 'Non-Compliant', value: counts.nonCompliant, color: '#ef4444'  },
  ].filter(d => d.value > 0);

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 flex flex-col gap-4 hover:shadow-[0_0_15px_rgba(59,130,246,0.4)] transition-all">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold uppercase tracking-wide text-gray-400">Workers On-Site</p>
        <span className="text-sm font-mono text-white bg-gray-700 px-3 py-1 rounded-lg">{counts.total} detected</span>
      </div>

      {/* Donut + legend */}
      <div className="flex items-center gap-6">
        <div className="relative w-[120px] h-[120px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data.length ? data : [{ name: 'None', value: 1, color: '#374151' }]}
                dataKey="value" cx="50%" cy="50%"
                innerRadius={32} outerRadius={58} strokeWidth={0}>
                {(data.length ? data : [{ color: '#374151' }]).map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          {/* Centre count */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-2xl font-bold text-white">{counts.total}</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full shrink-0 bg-green-500 animate-pulse" />
            <span className="text-gray-300 font-medium">Compliant</span>
            <span className="font-mono font-bold text-green-400 ml-auto">{counts.compliant}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full shrink-0 bg-red-500" />
            <span className="text-gray-300 font-medium">Non-compliant</span>
            <span className="font-mono font-bold text-red-400 ml-auto">{counts.nonCompliant}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
