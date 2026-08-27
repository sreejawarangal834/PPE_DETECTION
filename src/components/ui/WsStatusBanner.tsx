import { useWsStore } from '../../lib/websocket/wsStore';
import { retryAlertLiveFeed } from '../../lib/alerts/alertStore';
import Spinner from './Spinner';

/**
 * Reflects the real /ws/alerts connection (see src/lib/alerts/alertStore.ts) — previously
 * driven by mockWebSocketService.ts's own fabricated disconnect/reconnect timer, which had
 * no relationship to whether anything was actually connected.
 */
export default function WsStatusBanner() {
  const status = useWsStore(s => s.status);

  const cfg = {
    connected:    { dot: 'bg-status-ok',     text: 'text-status-ok',     label: 'Live'          },
    reconnecting: { dot: 'bg-status-warn',   text: 'text-status-warn',   label: 'Reconnecting…' },
    disconnected: { dot: 'bg-status-danger', text: 'text-status-danger', label: 'Disconnected'  },
  }[status];

  return (
    <div
      className="flex items-center gap-1.5"
      role="status"
      aria-live="polite"
      aria-label={`Live feed status: ${cfg.label}`}
    >
      {status === 'reconnecting' ? (
        <Spinner size="sm" className="text-status-warn" />
      ) : (
        <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} aria-hidden="true" />
      )}
      <span className={`text-xs font-mono ${cfg.text}`}>{cfg.label}</span>
      {status === 'disconnected' && (
        <button
          onClick={retryAlertLiveFeed}
          className="text-xs text-accent hover:underline ml-1"
          aria-label="Retry connection"
        >
          Retry
        </button>
      )}
    </div>
  );
}
