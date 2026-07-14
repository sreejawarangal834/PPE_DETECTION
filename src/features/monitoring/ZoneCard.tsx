import { useState, useEffect } from 'react';
import { mockWsService } from '../../lib/websocket/mockWebSocketService';
import { useAlertStore } from '../../lib/alerts/alertStore';
import type { WsEvent } from '../../types';

interface ZoneCardData { zoneId: string; zoneName: string; compliance: number; workers: number; violations: number; }
interface ZoneCardProps { initial: ZoneCardData; isSelected: boolean; onClick: (zoneId: string) => void; }

function complianceColor(v: number) {
  if (v >= 80) return '#4F9E7C';
  if (v >= 60) return '#D9A441';
  return '#C25450';
}
function complianceTextClass(v: number) {
  if (v >= 80) return 'text-[#4F9E7C]';
  if (v >= 60) return 'text-[#D9A441]';
  return 'text-[#C25450]';
}

export default function ZoneCard({ initial, isSelected, onClick }: ZoneCardProps) {
  const [data, setData] = useState(initial);
  const hasHigh = useAlertStore(s =>
    s.alerts.some(a => a.zoneId === initial.zoneId && a.severity === 'high' && a.status !== 'resolved')
  );

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
        bg-[#1B1F27] border border-[#21252D] rounded-xl p-4 text-left flex flex-col gap-2 cursor-pointer transition-all duration-200 hover:border-[#262B34]
        ${isSelected ? 'border-[#4A8FA3] ring-1 ring-[#4A8FA3] ring-inset' : 'border-[#21252D]'}
        ${hasHigh && data.violations > 0 ? 'zone-violation-pulse' : ''}
      `}
    >
      {/* Row 1: name + badge */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-[#E8EAF0] leading-snug">{data.zoneName}</p>
        {data.violations > 0 && (
          <span className="shrink-0 bg-[rgba(194,84,80,0.2)] text-[#C25450] text-xs px-2 py-0.5 rounded font-medium">
            {data.violations} violation{data.violations > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Row 2: compliance % */}
      <p className={`text-2xl font-bold leading-none ${complianceTextClass(data.compliance)}`}>
        {data.compliance}%
      </p>

      {/* Row 3: progress bar */}
      <div className="h-1 bg-[#20242D] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${data.compliance}%`, background: color }}
        />
      </div>

      {/* Row 4: workers */}
      <p className="text-xs text-[#5C6480] font-mono">
        {data.workers} worker{data.workers !== 1 ? 's' : ''} detected
      </p>
    </button>
  );
}
