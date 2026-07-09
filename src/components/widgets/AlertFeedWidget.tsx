import { useAlertStore } from '../../lib/alerts/alertStore';
import Badge from '../ui/Badge';
import { ROUTES } from '../../constants/routes';
import { Link, useNavigate } from 'react-router-dom';
import type { Alert } from '../../types';
import { Bell } from 'lucide-react';

interface AlertFeedWidgetProps {
  maxItems?: number;
  assignedZones?: string[];
  onAlertClick?: (alert: Alert) => void;
}

export default function AlertFeedWidget({ maxItems = 5, assignedZones, onAlertClick }: AlertFeedWidgetProps) {
  const navigate = useNavigate();
  const alerts   = useAlertStore(s => s.alerts);
  const visible  = alerts
    .filter(a => a.status !== 'resolved')
    .filter(a => !assignedZones?.length || assignedZones.includes(a.zoneId))
    .slice(0, maxItems);

  return (
    <div className="bg-panel border border-border-soft rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-soft">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Live Alerts</p>
        <Link to={ROUTES.ALERTS} className="text-xs text-accent hover:underline transition-colors">
          View all →
        </Link>
      </div>

      {visible.length === 0 ? (
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
              className="w-full flex items-start gap-3 px-4 py-3 hover:bg-panel-hover transition-colors duration-150 text-left"
            >
              {/* Severity indicator dot */}
              <span
                className="mt-1 w-2 h-2 rounded-full shrink-0"
                style={{
                  background: a.severity === 'high'
                    ? 'var(--color-severity-high)'
                    : a.severity === 'medium'
                    ? 'var(--color-severity-medium)'
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
                <p className="text-xs text-text-muted font-mono mt-0.5">{a.timestamp}</p>
              </div>
              <Badge variant={a.status} className="shrink-0 mt-0.5" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
