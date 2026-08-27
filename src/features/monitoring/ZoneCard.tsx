interface ZoneCardData { zoneId: string; zoneName: string; compliance: number | null; workers: number; violations: number; }
interface ZoneCardProps { data: ZoneCardData; isSelected: boolean; onClick: (zoneId: string) => void; }

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

/**
 * Real per-zone stats (GET /api/analytics/live-stats, fetched by the parent ZoneGrid and
 * refetched periodically) — previously overwritten every few seconds by a fabricated
 * zone_compliance_update event from mockWebSocketService.ts. `compliance: null` means no
 * tracked sessions in this zone within the current window; rendered as an honest "No data"
 * label rather than a fake percentage.
 */
export default function ZoneCard({ data, isSelected, onClick }: ZoneCardProps) {
  const hasData = data.compliance !== null;
  const color = hasData ? complianceColor(data.compliance!) : 'var(--color-text-muted)';

  return (
    <button
      onClick={() => onClick(data.zoneId)}
      aria-pressed={isSelected}
      aria-label={hasData ? `${data.zoneName}: ${data.compliance}% compliant` : `${data.zoneName}: no data`}
      className={`
        bg-panel border border-border-soft rounded-xl p-4 text-left flex flex-col gap-2 cursor-pointer transition-all duration-200 hover:border-border
        ${isSelected ? 'border-accent ring-1 ring-accent ring-inset' : 'border-border-soft'}
        ${hasData && data.compliance! < 60 ? 'zone-violation-pulse' : ''}
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

      {/* Row 2: compliance % (or an honest "no data" state) */}
      {hasData ? (
        <p className={`text-2xl font-bold leading-none ${complianceTextClass(data.compliance!)}`}>
          {data.compliance}%
        </p>
      ) : (
        <p className="text-2xl font-bold leading-none text-text-muted">—</p>
      )}

      {/* Row 3: progress bar */}
      <div className="h-1 bg-panel-alt rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${hasData ? data.compliance : 0}%`, background: color }}
        />
      </div>

      {/* Row 4: workers */}
      <p className="text-xs text-text-muted font-mono">
        {hasData
          ? `${data.workers} worker${data.workers !== 1 ? 's' : ''} tracked (last hour)`
          : 'No tracked activity in the last hour'}
      </p>
    </button>
  );
}
