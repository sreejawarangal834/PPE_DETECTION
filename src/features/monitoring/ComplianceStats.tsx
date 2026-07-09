import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Area, AreaChart,
} from 'recharts';
import { mockWsService } from '../../lib/websocket/mockWebSocketService';
import { ZONES } from '../../data/zones';
import ComplianceGauge from '../../components/widgets/ComplianceGauge';
import type { WsEvent } from '../../types';

interface ZoneBar  { name: string; violations: number; }
interface TimeLine { t: string; violations: number; }

const TT = {
  contentStyle: {
    background: 'var(--color-chart-tooltip-bg)',
    border: '1px solid var(--color-border)',
    borderRadius: '6px',
    fontSize: '11px',
    color: 'var(--color-text-primary)',
  },
  cursor: { stroke: 'var(--color-border)', strokeWidth: 1 },
};

function buildTimeline(): TimeLine[] {
  const now = Date.now();
  return Array.from({ length: 12 }, (_, i) => ({
    t: new Date(now - (11 - i) * 5 * 60_000)
      .toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    violations: Math.floor(Math.random() * 5),
  }));
}

export default function ComplianceStats() {
  const [overall, setOverall]   = useState(78);
  const [zoneBars, setZoneBars] = useState<ZoneBar[]>(() =>
    ZONES.map(z => ({ name: z.name.split(' ')[0], violations: Math.floor(Math.random() * 4) }))
  );
  const [timeline, setTimeline] = useState<TimeLine[]>(buildTimeline);

  useEffect(() => {
    function handler(e: WsEvent) {
      if (e.type !== 'zone_compliance_update') return;
      const p = e.payload as { zoneId: string; compliancePercent: number; violations: number };
      setOverall(prev => Math.round(prev * 0.85 + p.compliancePercent * 0.15));
      setZoneBars(prev => prev.map(z => {
        const zone = ZONES.find(z2 => z2.name.startsWith(z.name));
        return zone?.id === p.zoneId ? { ...z, violations: p.violations } : z;
      }));
      setTimeline(prev => [
        ...prev.slice(1),
        {
          t: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
          violations: p.violations,
        },
      ]);
    }
    mockWsService.onMessage(handler);
    return () => { mockWsService.removeAllHandlers(); };
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

      {/* Card 1 — Compliance Gauge */}
      <div className="bg-panel border border-border-soft rounded-xl p-4 flex flex-col">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted mb-3">
          Overall Compliance
        </p>
        <div className="flex-1 flex flex-col items-center justify-center">
          <ComplianceGauge value={overall} size={160} label="" />
          <p className="text-xs text-text-muted mt-2 text-center">
            Site-wide · All active zones
          </p>
        </div>
      </div>

      {/* Card 2 — Violations per Zone */}
      <div className="bg-panel border border-border-soft rounded-xl p-4 flex flex-col">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted mb-3">
          Violations Per Zone
        </p>
        <div className="flex-1">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={zoneBars} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="var(--color-chart-grid)" vertical={false} />
              <XAxis dataKey="name"
                tick={{ fill: 'var(--color-chart-tick)', fontSize: 10 }}
                axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: 'var(--color-chart-tick)', fontSize: 10 }}
                axisLine={false} tickLine={false} width={24} />
              <Tooltip {...TT} />
              <Bar dataKey="violations" fill="var(--color-chart-4)"
                radius={[3, 3, 0, 0]} name="Violations" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Card 3 — Violations Timeline */}
      <div className="bg-panel border border-border-soft rounded-xl p-4 flex flex-col">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted mb-3">
          Violations — Last 60 Min
        </p>
        <div className="flex-1">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={timeline} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--color-chart-1)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke="var(--color-chart-grid)" vertical={false} />
              <XAxis dataKey="t"
                tick={{ fill: 'var(--color-chart-tick)', fontSize: 9 }}
                axisLine={false} tickLine={false} interval={3} />
              <YAxis
                tick={{ fill: 'var(--color-chart-tick)', fontSize: 10 }}
                axisLine={false} tickLine={false} width={24} />
              <Tooltip {...TT} />
              <Area type="monotone" dataKey="violations"
                stroke="var(--color-chart-1)" strokeWidth={2}
                fill="url(#areaFill)" dot={false} name="Violations" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
