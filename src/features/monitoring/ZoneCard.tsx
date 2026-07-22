import { useState, useEffect } from 'react';
import { mockWsService } from '../../lib/websocket/mockWebSocketService';
import type { WsEvent } from '../../types';

interface ZoneCardData { zoneId: string; zoneName: string; compliance: number; workers: number; violations: number; }
interface ZoneCardProps { initial: ZoneCardData; isSelected: boolean; onClick: (zoneId: string) => void; }

function complianceColor(v: number) {
  if (v >= 80) return 'var(--color-compliance-good)';
  if (v >= 60) return 'var(--color-compliance-warn)';
  return 'var(--color-compliance-bad)';
}
function complianceTextClass(v: number) {
  if (v >= 80) return 'text-compliance-good';
  if (v >= 60) return 'text-compliance-warn';
  return 'text-compliance-bad';
}

export default function ZoneCard({ initial, isSelected, onClick }: ZoneCardProps) {
  const [data, setData] = useState(initial);

  useEffect(() => {
    function handler(e: WsEvent) {
      if (e.type !== 'zone_compliance_update') return;
      const p = e.payload as { zoneId: string; compliancePercent: number; workerCount: number; violations: number };
      if (p.zoneId !== initial.zoneId) return;
      setData({ ...data, compliance: p.compliancePercent, workers: p.workerCount, violations: p.violations });
    }
    mockWsService.onMessage(handler);
    return () => { mockWsService.removeAllHandlers(); };
  }, [initial.zoneId, data]);

  const color = complianceColor(data.compliance);

  return (
    <button
      onClick={() => onClick(initial.zoneId)}
      aria-pressed={isSelected}
      aria-label={`${data.zoneName}: ${data.compliance}% compliant`}
      className={`
        bg-panel border border-border-soft rounded-xl p-4 text-left flex flex-col gap-2 cursor-pointer transition-all duration-200 hover:border-border
        ${isSelected ? 'border-accent ring-1 ring-accent ring-inset' : 'border-border-soft'}
        ${data.compliance < 60 ? 'zone-violation-pulse' : ''}
      `}
    >
      {/* Row 1: name + badge */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-text-primary leading-snug">{data.zoneName}</p>
        {data.violations > 0 && (
          <span className="shrink-0 bg-status-danger/20 text-status-danger text-xs px-2 py-0.5 rounded font-medium">
            {data.violations} violation{data.violations > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Row 2: compliance % */}
      <p className={`text-2xl font-bold leading-none ${complianceTextClass(data.compliance)}`}>
        {data.compliance}%
      </p>

      {/* Row 3: progress bar */}
      <div className="h-1 bg-panel-alt rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${data.compliance}%`, background: color }}
        />
      </div>

      {/* Row 4: workers */}
      <p className="text-xs text-text-muted font-mono">
        {data.workers} worker{data.workers !== 1 ? 's' : ''} detected
      </p>
    </button>
  );
}
