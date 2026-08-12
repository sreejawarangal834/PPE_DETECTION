import { create } from 'zustand';
import type { Alert } from '../../types';
import type { AlertStatus } from '../../constants/alertStatus';
import { getEscalationDelayMs } from '../../data/alertConfig';
import { appendAuditLog } from '../audit/auditLog';
import { getAlerts } from '../../api/alertsApi';

interface AlertState {
  alerts: Alert[];
  unreadCount: number;
  addAlert: (a: Alert) => void;
  updateStatus: (id: string, status: AlertStatus, meta?: Partial<Alert>) => void;
  markRead: (id: string) => void;
  clearUnread: () => void;
  runEscalationCheck: () => string[]; // returns IDs escalated
  /** Refresh from the real zone-compliance backend — no-ops (keeps the last
   * known list) if the backend is unreachable, so a transient poll failure
   * doesn't blank the UI. */
  loadAlerts: () => Promise<void>;
}

let _escalationInterval: ReturnType<typeof setInterval> | null = null;
let _pollInterval: ReturnType<typeof setInterval> | null = null;

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
    // reflects it locally before the next loadAlerts() poll confirms it.
    set(s => ({
      alerts: s.alerts.map(a => a.id === id ? { ...a, status, ...meta } : a),
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

  runEscalationCheck() {
    const { alerts } = get();
    const now = Date.now();
    const escalated: string[] = [];
    const updated = alerts.map(a => {
      if (a.status !== 'open' && a.status !== 'acknowledged') return a;
      const delay = getEscalationDelayMs(a.zoneId);
      if (now - a.createdAt >= delay) {
        escalated.push(a.id);
        appendAuditLog({ actor: 'system', actionType: 'ALERT_ESCALATE', entity: `Alert: ${a.id}`, description: `Auto-escalated alert ${a.id} — response time exceeded`, ipAddress: '—' });
        return { ...a, status: 'escalated' as AlertStatus, escalatedAt: new Date().toISOString() };
      }
      return a;
    });
    if (escalated.length) {
      set(s => ({ alerts: updated, unreadCount: s.unreadCount + escalated.length }));
    }
    return escalated;
  },
}));

export function startEscalationInterval(onEscalate: (ids: string[]) => void): void {
  if (_escalationInterval) clearInterval(_escalationInterval);
  _escalationInterval = setInterval(() => {
    const ids = useAlertStore.getState().runEscalationCheck();
    if (ids.length > 0) onEscalate(ids);
  }, 60_000);
}

export function stopEscalationInterval(): void {
  if (_escalationInterval) { clearInterval(_escalationInterval); _escalationInterval = null; }
}

const ALERT_POLL_INTERVAL_MS = 5000;

/** Keep the Alerts page / sidebar feed / unread badge live without a page
 * reload — same polling cadence as MonitoringPage's backend health check. */
export function startAlertPolling(): void {
  if (_pollInterval) clearInterval(_pollInterval);
  useAlertStore.getState().loadAlerts();
  _pollInterval = setInterval(() => useAlertStore.getState().loadAlerts(), ALERT_POLL_INTERVAL_MS);
}

export function stopAlertPolling(): void {
  if (_pollInterval) { clearInterval(_pollInterval); _pollInterval = null; }
}
