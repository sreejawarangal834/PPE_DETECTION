import { useAlertStore } from '../../lib/alerts/alertStore';
import { useDetectionStore } from '../../state/DetectionStore';
import Badge from '../ui/Badge';
import { ROUTES } from '../../constants/routes';
import { Link, useNavigate } from 'react-router-dom';
import type { Alert } from '../../types';
import { Bell, Zap } from 'lucide-react';
import { formatRelative } from '../../lib/utils';

interface AlertFeedWidgetProps {
  maxItems?: number;
  assignedZones?: string[];
  onAlertClick?: (alert: Alert) => void;
}

export default function AlertFeedWidget({ maxItems = 5, assignedZones, onAlertClick }: AlertFeedWidgetProps) {
  const navigate = useNavigate();

  // Live detection data from YOLO26 backend
  const { liveCamera } = useDetectionStore();
  const isLive = liveCamera !== null && liveCamera.violations.length > 0;

  // Mock / historical alerts fallback
  const mockAlerts = useAlertStore(s => s.alerts);
  const visible    = mockAlerts
    .filter(a => a.status !== 'resolved')
    .filter(a => !assignedZones?.length || assignedZones.includes(a.zoneId))
    .slice(0, maxItems);

  return (
    <div className="bg-panel border border-border-soft rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-soft">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Live Alerts</p>
          {isLive && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-status-danger bg-status-danger/15 border border-status-danger/30 px-1.5 py-0.5 rounded font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-status-danger animate-pulse" />
              YOLO26 LIVE
            </span>
          )}
        </div>
        <Link to={ROUTES.ALERTS} className="text-xs text-accent hover:text-accent-hover transition-colors">
          View all →
        </Link>
      </div>

      {/* ── LIVE YOLO26 violations (when backend is streaming) ── */}
      {isLive && liveCamera && (
        <div className="border-b border-border-soft">
          <div className="px-4 py-2 bg-status-danger/8">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-status-danger flex items-center gap-1.5">
              <Zap className="w-3 h-3" aria-hidden="true" />
              Live Detection · Frame {liveCamera.frameIndex}
            </p>
          </div>
          {liveCamera.violations.slice(0, 4).map((v: string, i: number) => (
            <div key={i}
              className="flex items-center gap-3 px-4 py-2.5 border-b border-border-soft/50 last:border-0 bg-status-danger/5">
              <span className="w-2 h-2 rounded-full shrink-0 bg-status-danger" aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary font-medium truncate">{v}</p>
                <p className="text-xs text-text-muted font-mono mt-0.5">{liveCamera.name} · Now</p>
              </div>
              <Badge variant={liveCamera.severity} />
            </div>
          ))}
        </div>
      )}

      {/* ── Mock / historical alerts (always shown as fallback) ── */}
      {visible.length === 0 && !isLive ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <Bell className="w-7 h-7 text-text-muted opacity-40" aria-hidden="true" />
          <p className="text-xs text-text-muted">No active alerts</p>
        </div>
      ) : (
        <div className="divide-y divide-border-soft">
          {visible.map(a => (
            <button
              key={a.id}
              onClick={() => onAlertClick ? onAlertClick(a) : navigate(ROUTES.ALERTS)}
              className="w-full flex items-start gap-3 px-4 py-3 hover:bg-panel-hover/50 transition-colors duration-150 text-left"
            >
              <span
                className="mt-1 w-2 h-2 rounded-full shrink-0"
                style={{
                  background: a.severity === 'high' ? 'var(--color-severity-high)'
                    : a.severity === 'medium' ? 'var(--color-severity-medium)'
                    : 'var(--color-status-ok)',
                }}
                aria-hidden="true"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary truncate leading-snug">
                  {a.zoneName}
                  <span className="text-text-muted"> · </span>
                  <span className="text-text-secondary text-xs">{a.workerName}</span>
                </p>
                <p className="text-xs text-text-muted font-mono mt-0.5">
                  {formatRelative(a.createdAt)}
                </p>
              </div>
              <Badge variant={a.status} className="shrink-0 mt-0.5" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
