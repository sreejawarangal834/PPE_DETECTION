import { create } from 'zustand';
import toast from 'react-hot-toast';
import type { Alert } from '../../types';
import type { AlertStatus } from '../../constants/alertStatus';
import { getAlerts } from '../../api/alertsApi';
import { useWsStore } from '../websocket/wsStore';
import { useNotificationStore } from '../notifications/notificationStore';
import { showAlertToast, showEscalationToast, type AlertNewPayload } from './alertToasts';
import { ROUTES } from '../../constants/routes';

interface AlertState {
  alerts: Alert[];
  unreadCount: number;
  addAlert: (a: Alert) => void;
  updateStatus: (id: string, status: AlertStatus, meta?: Partial<Alert>) => void;
  markEscalated: (id: string) => void;
  markRead: (id: string) => void;
  clearUnread: () => void;
  /** One-shot fetch from the real backend — used on mount and to recover after a dropped
   * /ws/alerts connection reconnects. No-ops (keeps the last known list) if the backend is
   * unreachable, so a transient failure doesn't blank the UI. */
  loadAlerts: () => Promise<void>;
}

export const useAlertStore = create<AlertState>()((set, get) => ({
  alerts: [],
  unreadCount: 0,

  async loadAlerts() {
    try {
      const { data } = await getAlerts({ pageSize: 200 });
      set({ alerts: data, unreadCount: data.filter(a => a.status !== 'resolved').length });
    } catch {
      // backend unreachable — keep whatever's currently in the store
    }
  },

  addAlert(alert) {
    set(s => ({
      alerts: [alert, ...s.alerts],
      unreadCount: s.unreadCount + 1,
    }));
  },

  updateStatus(id, status, meta) {
    // The caller (AcknowledgeDialog/ResolveDialog) already persisted this
    // via the real acknowledgeAlert/resolveAlert API call — this just
    // reflects it locally before the next /ws/alerts event confirms it.
    set(s => ({
      alerts: s.alerts.map(a => a.id === id ? { ...a, status, ...meta } : a),
    }));
  },

  markEscalated(id) {
    set(s => ({
      alerts: s.alerts.map(a => a.id === id ? { ...a, escalatedAt: new Date().toISOString() } : a),
      unreadCount: s.unreadCount + 1,
    }));
  },

  markRead(id) {
    const { alerts } = get();
    const a = alerts.find(a => a.id === id);
    if (a && a.status !== 'resolved') {
      set(s => ({ unreadCount: Math.max(0, s.unreadCount - 1) }));
    }
  },

  clearUnread() { set({ unreadCount: 0 }); },
}));

// ─── Live feed over /ws/alerts (Phase 4) ─────────────────────────────────────
// Replaces both the old 5s GET /api/alerts poll AND the client-side escalation
// setInterval (IMPLEMENTATION_PLAN.md §7.1 — escalation now runs server-side, see
// backend/escalation.py; this only reacts to the events it broadcasts). Also now the
// source of truth for useWsStore's status (WsStatusBanner.tsx) — that used to reflect
// mockWebSocketService.ts's own fabricated disconnect/reconnect cycle, which had nothing to
// do with whether anything was actually connected.
let _ws: WebSocket | null = null;
let _reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function wsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}/ws/alerts`;
}

function connect(): void {
  if (_ws) return;
  useWsStore.getState().setStatus('reconnecting');
  const ws = new WebSocket(wsUrl());
  _ws = ws;

  ws.onopen = () => {
    useWsStore.getState().setStatus('connected');
    toast.dismiss('ws-disconnect');
    useAlertStore.getState().loadAlerts(); // reconcile full state on (re)connect
  };
  ws.onmessage = (evt) => {
    try {
      const msg = JSON.parse(evt.data);
      if (msg.type === 'alert_new') {
        const payload = msg as AlertNewPayload;
        useAlertStore.getState().loadAlerts(); // reconcile the full list
        useNotificationStore.getState().addItem({
          type:      'alert_new',
          title:     `New Alert — ${payload.severity.toUpperCase()}`,
          body:      `${payload.zoneName ?? 'Unknown zone'} · ${payload.personLabel ?? 'Unknown worker'} · ${payload.description ?? ''}`,
          timestamp: Date.now(),
          linkTo:    ROUTES.ALERTS,
        });
        if (payload.severity === 'high' || payload.severity === 'critical' || payload.severity === 'medium') {
          showAlertToast(payload);
        }
      } else if (msg.type === 'alert_escalated' && msg.alertId) {
        useAlertStore.getState().markEscalated(msg.alertId);
        useNotificationStore.getState().addItem({
          type:      'alert_escalated',
          title:     'Alert Escalated',
          body:      `Alert ${msg.alertId} has exceeded response time and requires immediate action.`,
          timestamp: Date.now(),
          linkTo:    ROUTES.ALERTS,
        });
        showEscalationToast(msg.alertId);
      }
    } catch {
      // ignore malformed frames
    }
  };
  ws.onclose = () => {
    const wasConnected = _ws !== null;
    _ws = null;
    useWsStore.getState().setStatus('reconnecting'); // always retried below — never a
    if (wasConnected) {
      toast.error('Live feed disconnected — attempting to reconnect.', { id: 'ws-disconnect', duration: Infinity });
    }
    if (_reconnectTimer) clearTimeout(_reconnectTimer); // permanent "disconnected" state
    _reconnectTimer = setTimeout(connect, 5000);
  };
  ws.onerror = () => ws.close();
}

export function startAlertLiveFeed(): void {
  useAlertStore.getState().loadAlerts();
  connect();
}

/** Force an immediate reconnect attempt (WsStatusBanner's "Retry" button) instead of waiting
 * out the automatic 5s backoff. */
export function retryAlertLiveFeed(): void {
  if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }
  if (_ws) { _ws.onclose = null; _ws.close(); _ws = null; }
  connect();
}

export function stopAlertLiveFeed(): void {
  if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }
  if (_ws) { _ws.onclose = null; _ws.close(); _ws = null; }
  useWsStore.getState().setStatus('disconnected');
}
