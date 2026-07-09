import { create } from 'zustand';
import type { Alert } from '../../types';
import type { AlertStatus } from '../../constants/alertStatus';
import { ALERTS } from '../../data/mockData';
import { getEscalationDelayMs } from '../../data/alertConfig';
import { appendAuditLog } from '../audit/auditLog';
import { updateAlertStatus } from '../../api/alertsApi';

interface AlertState {
  alerts: Alert[];
  unreadCount: number;
  addAlert: (a: Alert) => void;
  updateStatus: (id: string, status: AlertStatus, meta?: Partial<Alert>) => void;
  markRead: (id: string) => void;
  clearUnread: () => void;
  runEscalationCheck: () => string[]; // returns IDs escalated
  seedAlerts: () => void;
}

let _escalationInterval: ReturnType<typeof setInterval> | null = null;

export const useAlertStore = create<AlertState>()((set, get) => ({
  alerts: [...ALERTS],
  unreadCount: ALERTS.filter(a => a.status !== 'resolved').length,

  seedAlerts() {
    set({ alerts: [...ALERTS], unreadCount: ALERTS.filter(a => a.status !== 'resolved').length });
  },

  addAlert(alert) {
    set(s => ({
      alerts: [alert, ...s.alerts],
      unreadCount: s.unreadCount + 1,
    }));
  },

  updateStatus(id, status, meta) {
    set(s => ({
      alerts: s.alerts.map(a => a.id === id ? { ...a, status, ...meta } : a),
    }));
    updateAlertStatus(id, status, meta);
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
        updateAlertStatus(a.id, 'escalated', { escalatedAt: new Date().toISOString() });
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
