import toast from 'react-hot-toast';
import { PPE_LABEL } from '../../constants/ppeTypes';

/**
 * Toast popups for real /ws/alerts events (backend/notifications/notifier.py's broadcast
 * payload — {alertId, personLabel, zoneName, ppeType, severity, cameraCode, description}).
 * Extracted from the old src/lib/websocket/useWebSocket.ts, which drove the same toasts from
 * mockWebSocketService.ts's fabricated alert_new events — deleted along with the mock service
 * (see the fake-frontend audit); the toast UI itself was always real, only its trigger was
 * fake, so it's kept here wired to the real trigger instead.
 */

export interface AlertNewPayload {
  alertId: string;
  personLabel?: string;
  zoneName?: string;
  ppeType?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  cameraCode?: string;
  description?: string;
}

export function showAlertToast(alert: AlertNewPayload): void {
  const color = alert.severity === 'critical' || alert.severity === 'high' ? '#C25450'
    : alert.severity === 'medium' ? '#D9A441' : '#4F9E7C';
  const label = alert.severity.charAt(0).toUpperCase() + alert.severity.slice(1);
  const missing = alert.ppeType ? (PPE_LABEL[alert.ppeType as keyof typeof PPE_LABEL] ?? alert.ppeType) : 'PPE';
  const duration = (alert.severity === 'high' || alert.severity === 'critical') ? 12000 : 8000;
  const toastFn = (alert.severity === 'high' || alert.severity === 'critical') ? toast.error : toast;

  toastFn(
    `${label} Alert · ${alert.zoneName ?? 'Unknown zone'}\nMissing: ${missing} · ${alert.personLabel ?? 'Unknown worker'}`,
    {
      id:       `alert-${alert.alertId}`,
      duration,
      position: 'top-right',
      icon:     (alert.severity === 'high' || alert.severity === 'critical') ? '🚨' : '⚠️',
      style: {
        background:   'var(--color-panel)',
        color:        'var(--color-text-primary)',
        border:       `1px solid ${color}50`,
        borderLeft:   `4px solid ${color}`,
        borderRadius: '12px',
        padding:      '14px 16px',
        maxWidth:     '380px',
        fontSize:     '14px',
        lineHeight:   '1.5',
        boxShadow:    `0 8px 32px rgba(0,0,0,0.5)`,
        cursor:       'pointer',
      },
    }
  );
}

export function showEscalationToast(alertId: string): void {
  toast.error(
    `ESCALATED · Alert ${alertId}\nExceeded response time — immediate action required`,
    {
      id:       `esc-${alertId}`,
      duration: 15000,
      position: 'top-right',
      icon:     '🔴',
      style: {
        background:   '#C25450',
        color:        '#fff',
        border:       '1px solid rgba(255,255,255,0.2)',
        borderRadius: '12px',
        padding:      '14px 16px',
        maxWidth:     '380px',
        fontSize:     '14px',
        lineHeight:   '1.5',
        fontWeight:   '600',
        boxShadow:    '0 8px 32px rgba(194,84,80,0.5)',
      },
    }
  );
}
