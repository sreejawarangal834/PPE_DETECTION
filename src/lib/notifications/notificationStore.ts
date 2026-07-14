import { create } from 'zustand';
import type { NotificationItem } from '../../types';
import { NOTIFICATION_MAX } from '../../constants/app';

interface NotificationState {
  items: NotificationItem[];
  unreadCount: number;
  isDrawerOpen: boolean;
  addItem: (n: Omit<NotificationItem, 'id' | 'read'>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  dismissItem: (id: string) => void;
  openDrawer: () => void;
  closeDrawer: () => void;
}

let _counter = 1;

export const useNotificationStore = create<NotificationState>()((set, get) => ({
  items: [],
  unreadCount: 0,
  isDrawerOpen: false,

  addItem(n) {
    const item: NotificationItem = { ...n, id: `notif-${_counter++}`, read: false };
    set(s => ({
      items: [item, ...s.items].slice(0, 100),
      unreadCount: Math.min(s.unreadCount + 1, NOTIFICATION_MAX),
    }));
  },

  markRead(id) {
    const item = get().items.find(i => i.id === id);
    if (item && !item.read) {
      set(s => ({
        items: s.items.map(i => i.id === id ? { ...i, read: true } : i),
        unreadCount: Math.max(0, s.unreadCount - 1),
      }));
    }
  },

  markAllRead() {
    set(s => ({ items: s.items.map(i => ({ ...i, read: true })), unreadCount: 0 }));
  },

  dismissItem(id) {
    const item = get().items.find(i => i.id === id);
    set(s => ({
      items: s.items.filter(i => i.id !== id),
      unreadCount: item && !item.read ? Math.max(0, s.unreadCount - 1) : s.unreadCount,
    }));
  },

  openDrawer:  () => set({ isDrawerOpen: true }),
  closeDrawer: () => set({ isDrawerOpen: false }),
}));
