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
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Live Alerts</p>
        <Link to={ROUTES.ALERTS} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
          View all →
        </Link>
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <Bell className="w-7 h-7 text-gray-500 opacity-40" aria-hidden="true" />
          <p className="text-xs text-gray-400">No active alerts</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-700">
          {visible.map(a => (
            <button
              key={a.id}
              onClick={() => onAlertClick ? onAlertClick(a) : navigate(ROUTES.ALERTS)}
              className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-700/50 transition-colors duration-150 text-left"
            >
              {/* Severity indicator dot */}
              <span
                className="mt-1 w-2 h-2 rounded-full shrink-0"
                style={{
                  background: a.severity === 'high'
                    ? '#ef4444'
                    : a.severity === 'medium'
                    ? '#eab308'
                    : '#22c55e',
                }}
                aria-hidden="true"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate leading-snug">
                  {a.zoneName}
                  <span className="text-gray-500"> · </span>
                  <span className="text-gray-400 text-xs">{a.workerName}</span>
                </p>
                <p className="text-xs text-gray-400 font-mono mt-0.5">{a.timestamp}</p>
              </div>
              <Badge variant={a.status} className="shrink-0 mt-0.5" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
