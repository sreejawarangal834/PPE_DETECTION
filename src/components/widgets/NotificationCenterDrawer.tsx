import { useState } from 'react';
import { Bell, AlertTriangle, Server, Info, X } from 'lucide-react';
import { useNotificationStore } from '../../lib/notifications/notificationStore';
import Drawer from '../ui/Drawer';
import Button from '../ui/Button';
import { useNavigate } from 'react-router-dom';
import { formatRelative } from '../../lib/utils';
import type { NotificationItem } from '../../types';

type FilterTab = 'all' | 'alert_new' | 'alert_escalated' | 'system_health';
const TABS: { id: FilterTab; label: string }[] = [
  { id: 'all',             label: 'All'       },
  { id: 'alert_new',       label: 'Alerts'    },
  { id: 'alert_escalated', label: 'Escalated' },
  { id: 'system_health',   label: 'System'    },
];

const TYPE_ICON: Record<NotificationItem['type'], React.ReactNode> = {
  alert_new:       <Bell      className="w-4 h-4 text-accent"         aria-hidden="true" />,
  alert_escalated: <AlertTriangle className="w-4 h-4 text-status-danger" aria-hidden="true" />,
  system_health:   <Server    className="w-4 h-4 text-status-warn"    aria-hidden="true" />,
  info:            <Info      className="w-4 h-4 text-text-muted"     aria-hidden="true" />,
};

export default function NotificationCenterDrawer() {
  const { items, unreadCount, isDrawerOpen, closeDrawer, markRead, markAllRead, dismissItem } = useNotificationStore();
  const navigate = useNavigate();
  const [tab, setTab] = useState<FilterTab>('all');

  const filtered = tab === 'all' ? items : items.filter(i => i.type === tab);

  function handleClick(item: NotificationItem) {
    markRead(item.id);
    if (item.linkTo) navigate(item.linkTo);
    closeDrawer();
  }

  return (
    <Drawer open={isDrawerOpen} onClose={closeDrawer} title="Notifications" side="right" width="w-[420px]"
      aria-label="Notification Center">

      {/* Sub-header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border-soft shrink-0 bg-panel">
        <span className="text-xs text-text-muted">
          {unreadCount > 0
            ? <><span className="text-accent font-medium">{unreadCount}</span> unread</>
            : 'All caught up'}
        </span>
        <Button variant="ghost" size="sm" onClick={markAllRead} className="text-xs">
          Mark all read
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex border-b border-border-soft px-1 shrink-0 bg-panel">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`py-2 px-3 text-xs font-medium transition-colors border-b-2 -mb-px
              ${tab === t.id
                ? 'border-accent text-accent'
                : 'border-transparent text-text-muted hover:text-text-secondary'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Bell className="w-10 h-10 text-text-muted opacity-30" aria-hidden="true" />
            <p className="text-sm text-text-muted">No notifications</p>
          </div>
        ) : (
          filtered.map(item => (
            <div
              key={item.id}
              className={`flex items-start gap-3 px-4 py-3.5 border-b border-border-soft hover:bg-panel-hover transition-colors duration-150
                ${!item.read ? 'bg-accent/[0.04]' : ''}`}
            >
              {/* Icon */}
              <div className="mt-0.5 shrink-0 w-7 h-7 rounded-md bg-panel-alt flex items-center justify-center">
                {TYPE_ICON[item.type]}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <button
                  onClick={() => handleClick(item)}
                  className="text-sm font-medium text-text-primary hover:text-accent transition-colors text-left leading-snug w-full truncate block"
                >
                  {item.title}
                </button>
                <p className="text-xs text-text-secondary mt-0.5 leading-relaxed line-clamp-2">{item.body}</p>
                <p className="text-xs text-text-muted mt-1 font-mono">{formatRelative(item.timestamp)}</p>
                {item.linkTo && (
                  <button onClick={() => handleClick(item)} className="text-xs text-accent hover:underline mt-1">
                    View →
                  </button>
                )}
              </div>

              {/* Unread dot + dismiss */}
              <div className="flex flex-col items-center gap-2 shrink-0">
                {!item.read && <span className="w-2 h-2 rounded-full bg-accent mt-1" aria-label="Unread" />}
                <button
                  onClick={() => dismissItem(item.id)}
                  aria-label="Dismiss notification"
                  className="p-0.5 text-text-muted hover:text-text-primary transition-colors rounded"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </Drawer>
  );
}
