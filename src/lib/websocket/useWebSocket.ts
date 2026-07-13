import { useEffect, useRef } from 'react';
import { mockWsService } from './mockWebSocketService';
import { useWsStore } from './wsStore';
import { useAlertStore } from '../alerts/alertStore';
import { useNotificationStore } from '../notifications/notificationStore';
import type { WsEvent, Alert } from '../../types';
import { ROUTES } from '../../constants/routes';
import toast from 'react-hot-toast';
import { PPE_LABEL } from '../../constants/ppeTypes';

/* ── Alert popup toast (plain HTML string via toast.custom) ─ */
function showAlertToast(alert: Alert) {
  const color = alert.severity === 'high' ? '#C25450' : alert.severity === 'medium' ? '#D9A441' : '#4F9E7C';
  const label = alert.severity.charAt(0).toUpperCase() + alert.severity.slice(1);
  const missing = alert.missingPpe.map(p => PPE_LABEL[p] ?? p).join(', ');
  const duration = alert.severity === 'high' ? 12000 : 8000;

  toast(
    () => null,  // we use the string approach via style override
    {
      id:       `alert-${alert.id}`,
      duration,
      icon:     '⚠',
      style: {
        background:   'var(--color-panel)',
        color:        'var(--color-text-primary)',
        border:       `1px solid ${color}40`,
        borderLeft:   `4px solid ${color}`,
        borderRadius: '12px',
        padding:      '0',
        maxWidth:     '360px',
        boxShadow:    `0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px ${color}10`,
      },
    }
  );

  // Use a separate richer toast right after (dismiss the plain one)
  toast.dismiss(`alert-${alert.id}`);

  // Show the rich version using success/error pattern with custom style
  const toastFn = alert.severity === 'high' ? toast.error : toast;
  toastFn(
    `${label} Alert · ${alert.zoneName}\nMissing: ${missing} · ${alert.workerName}`,
    {
      id:       `alert-${alert.id}`,
      duration,
      position: 'top-right',
      icon:     alert.severity === 'high' ? '🚨' : '⚠️',
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

function showEscalationToast(alertId: string) {
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

export function useWebSocket() {
  const setStatus    = useWsStore(s => s.setStatus);
  const addAlert     = useAlertStore(s => s.addAlert);
  const updateStatus = useAlertStore(s => s.updateStatus);
  const addNotif     = useNotificationStore(s => s.addItem);
  const prevStatus   = useRef<string>('disconnected');

  useEffect(() => {
    function handleMessage(event: WsEvent) {
      switch (event.type) {
        case 'alert_new': {
          const alert = event.payload as Alert;
          addAlert(alert);
          addNotif({
            type:      'alert_new',
            title:     `New Alert — ${alert.severity.toUpperCase()}`,
            body:      `${alert.zoneName} · ${alert.workerName} · Missing: ${alert.missingPpe.join(', ')}`,
            timestamp: Date.now(),
            linkTo:    ROUTES.ALERTS,
          });
          // Show popup toast for high + medium severity
          if (alert.severity === 'high' || alert.severity === 'medium') {
            showAlertToast(alert);
          }
          break;
        }
        case 'alert_status_change': {
          const p = event.payload as { alertId: string; status: string; meta?: Partial<Alert> };
          updateStatus(p.alertId, p.status as never, p.meta);
          if (p.status === 'escalated') {
            addNotif({
              type:      'alert_escalated',
              title:     'Alert Escalated',
              body:      `Alert ${p.alertId} has exceeded response time and requires immediate action.`,
              timestamp: Date.now(),
              linkTo:    ROUTES.ALERTS,
            });
            showEscalationToast(p.alertId);
          }
          break;
        }
        default: break;
      }
    }

    function handleStatus(status: 'connected' | 'reconnecting' | 'disconnected') {
      setStatus(status);
      if (status === 'disconnected' && prevStatus.current === 'connected') {
        toast.error('Live feed disconnected — attempting to reconnect.', {
          id: 'ws-disconnect', duration: Infinity,
        });
      }
      if (status === 'connected' && prevStatus.current !== 'connected') {
        toast.dismiss('ws-disconnect');
        toast.success('Live feed restored.', { id: 'ws-reconnect' });
      }
      prevStatus.current = status;
    }

    mockWsService.onMessage(handleMessage);
    mockWsService.onStatusChange(handleStatus);
    mockWsService.connect();

    return () => {
      mockWsService.removeAllHandlers();
      mockWsService.disconnect();
    };
  }, [setStatus, addAlert, updateStatus, addNotif]);
}
