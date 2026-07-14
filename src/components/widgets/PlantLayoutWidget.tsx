import { useState, useEffect } from 'react';
import { ZONES } from '../../data/zones';
import { mockWsService } from '../../lib/websocket/mockWebSocketService';
import type { WsEvent } from '../../types';

function zoneColor(v: number) {
  if (v >= 80) return 'var(--color-compliance-good)';
  if (v >= 60) return 'var(--color-compliance-warn)';
  return 'var(--color-compliance-bad)';
}

interface PlantLayoutWidgetProps {
  onZoneClick?: (zoneId: string) => void;
  readonly?: boolean;
}

export default function PlantLayoutWidget({ onZoneClick, readonly = false }: PlantLayoutWidgetProps) {
  const [statuses, setStatuses] = useState<Record<string, number>>(() =>
    Object.fromEntries(ZONES.map(z => [z.id, 78]))
  );

  useEffect(() => {
    function handler(e: WsEvent) {
      if (e.type !== 'zone_compliance_update') return;
      const p = e.payload as { zoneId: string; compliancePercent: number };
      setStatuses(prev => ({ ...prev, [p.zoneId]: p.compliancePercent }));
    }
    mockWsService.onMessage(handler);
    return () => { mockWsService.removeAllHandlers(); };
  }, []);

  return (
    <div className="bg-panel border border-border-soft rounded-xl p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-text-muted mb-4">Plant Layout</p>

      <svg viewBox="0 0 500 260" className="w-full" aria-label="Plant zone heatmap" role="img">
        {ZONES.map(z => {
          if (!z.svgCoordinates) return null;
          const { x, y, w, h } = z.svgCoordinates;
          const compliance = statuses[z.id] ?? 78;
          const color = zoneColor(compliance);
          const clickable = !readonly && !!onZoneClick;

          return (
            <g key={z.id}
              onClick={() => clickable && onZoneClick?.(z.id)}
              style={{ cursor: clickable ? 'pointer' : 'default' }}
              aria-label={`${z.name} — ${compliance}% compliant`}
              role={clickable ? 'button' : undefined}
              tabIndex={clickable ? 0 : undefined}
              onKeyDown={e => { if (clickable && (e.key === 'Enter' || e.key === ' ')) onZoneClick?.(z.id); }}
            >
              {/* Background fill */}
              <rect x={x} y={y} width={w} height={h} rx="8"
                fill={color} fillOpacity="0.12"
                stroke={color} strokeWidth="1.5" strokeOpacity="0.6"
              />
              {/* Hover tint (pure SVG can't do hover easily, handled via opacity on click) */}
              {/* Zone name */}
              <text x={x + w / 2} y={y + h / 2 - 8} textAnchor="middle"
                fill="var(--color-text-secondary)" fontSize="11" fontFamily="IBM Plex Sans, sans-serif" fontWeight="500">
                {z.name.split(' ').slice(0, 2).join(' ')}
              </text>
              {/* Compliance % */}
              <text x={x + w / 2} y={y + h / 2 + 10} textAnchor="middle"
                fill={color} fontSize="13" fontFamily="IBM Plex Mono, monospace" fontWeight="700">
                {compliance}%
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-5 mt-3">
        {[
          ['var(--color-compliance-good)', '≥ 80%  Compliant'],
          ['var(--color-compliance-warn)', '60–79%'],
          ['var(--color-compliance-bad)',  '< 60%  At risk'],
        ].map(([c, l]) => (
          <span key={l} className="flex items-center gap-1.5 text-xs text-text-muted">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: c }} />
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}
