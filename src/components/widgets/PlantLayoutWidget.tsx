import { useQuery } from '@tanstack/react-query';
import { ZONES } from '../../data/zones';
import { getLiveStats } from '../../api/analyticsApi';

function zoneColor(v: number | null) {
  if (v === null) return 'var(--color-text-muted)';
  if (v >= 80) return 'var(--color-compliance-good)';
  if (v >= 60) return 'var(--color-compliance-warn)';
  return 'var(--color-compliance-bad)';
}

interface PlantLayoutWidgetProps {
  onZoneClick?: (zoneId: string) => void;
  readonly?: boolean;
}

/**
 * `ZONES` here supplies only the SVG layout geometry (`svgCoordinates` — x/y/w/h per zone),
 * which has no backend equivalent yet and is genuinely just presentation data, not a live
 * data source (the distinction the Task 2 audit draws — see src/data/zones.ts). The
 * compliance percentages painted onto it are real (GET /api/analytics/live-stats), replacing
 * a fabricated zone_compliance_update stream that used to drive this same map.
 */
export default function PlantLayoutWidget({ onZoneClick, readonly = false }: PlantLayoutWidgetProps) {
  const { data } = useQuery({
    queryKey: ['analytics', 'live-stats'],
    queryFn: () => getLiveStats(60),
    refetchInterval: 20_000,
    staleTime: 15_000,
  });
  const statsByZone = new Map((data?.zoneStats ?? []).map(s => [s.zoneId, s]));

  return (
    <div className="bg-panel border border-border-soft rounded-xl p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-text-muted mb-4">Plant Layout</p>

      <svg viewBox="0 0 500 260" className="w-full" aria-label="Plant zone heatmap" role="img">
        {ZONES.map(z => {
          if (!z.svgCoordinates) return null;
          const { x, y, w, h } = z.svgCoordinates;
          const compliance = statsByZone.get(z.id)?.compliancePercent ?? null;
          const color = zoneColor(compliance);
          const clickable = !readonly && !!onZoneClick;

          return (
            <g key={z.id}
              onClick={() => clickable && onZoneClick?.(z.id)}
              style={{ cursor: clickable ? 'pointer' : 'default' }}
              aria-label={compliance !== null ? `${z.name} — ${compliance}% compliant` : `${z.name} — no data`}
              role={clickable ? 'button' : undefined}
              tabIndex={clickable ? 0 : undefined}
              onKeyDown={e => { if (clickable && (e.key === 'Enter' || e.key === ' ')) onZoneClick?.(z.id); }}
            >
              {/* Background fill */}
              <rect x={x} y={y} width={w} height={h} rx="8"
                fill={color} fillOpacity="0.12"
                stroke={color} strokeWidth="1.5" strokeOpacity="0.6"
              />
              {/* Zone name */}
              <text x={x + w / 2} y={y + h / 2 - 8} textAnchor="middle"
                fill="var(--color-text-secondary)" fontSize="11" fontFamily="IBM Plex Sans, sans-serif" fontWeight="500">
                {z.name.split(' ').slice(0, 2).join(' ')}
              </text>
              {/* Compliance % (or an honest "no data" dash) */}
              <text x={x + w / 2} y={y + h / 2 + 10} textAnchor="middle"
                fill={color} fontSize="13" fontFamily="IBM Plex Mono, monospace" fontWeight="700">
                {compliance !== null ? `${compliance}%` : '—'}
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
