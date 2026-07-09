import { useEffect, useRef } from 'react';
import { mockWsService } from './mockWebSocketService';
import { useWsStore } from './wsStore';
import { useAlertStore } from '../alerts/alertStore';
import { useNotificationStore } from '../notifications/notificationStore';
import type { WsEvent, Alert } from '../../types';
import { ROUTES } from '../../constants/routes';
import toast from 'react-hot-toast';

export function useWebSocket() {
  const setStatus   = useWsStore(s => s.setStatus);
  const addAlert    = useAlertStore(s => s.addAlert);
  const updateStatus = useAlertStore(s => s.updateStatus);
  const addNotif    = useNotificationStore(s => s.addItem);
  const prevStatus  = useRef<string>('disconnected');

  useEffect(() => {
    function handleMessage(event: WsEvent) {
      switch (event.type) {
        case 'alert_new': {
          const alert = event.payload as Alert;
          addAlert(alert);
          addNotif({
            type: 'alert_new',
            title: `New Alert — ${alert.severity.toUpperCase()}`,
            body: `${alert.zoneName} · ${alert.workerName} · Missing: ${alert.missingPpe.join(', ')}`,
            timestamp: Date.now(),
            linkTo: ROUTES.ALERTS,
          });
          break;
        }
        case 'alert_status_change': {
          const p = event.payload as { alertId: string; status: string; meta?: Partial<Alert> };
          updateStatus(p.alertId, p.status as never, p.meta);
          if (p.status === 'escalated') {
            addNotif({
              type: 'alert_escalated',
              title: 'Alert Escalated',
              body: `Alert ${p.alertId} has exceeded response time and requires immediate action.`,
              timestamp: Date.now(),
              linkTo: ROUTES.ALERTS,
            });
          }
          break;
        }
        // zone, camera, worker, top_zones, system_health events are consumed
        // by individual components/widgets via the store or direct prop drilling
        default: break;
      }
    }

    function handleStatus(status: 'connected' | 'reconnecting' | 'disconnected') {
      setStatus(status);
      if (status === 'disconnected' && prevStatus.current === 'connected') {
        toast.error('Live feed disconnected — attempting to reconnect.', { id: 'ws-disconnect', duration: Infinity });
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
