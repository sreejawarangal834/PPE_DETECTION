export const AlertStatus = {
  OPEN:         'open',
  ACKNOWLEDGED: 'acknowledged',
  ESCALATED:    'escalated',
  RESOLVED:     'resolved',
} as const;

export type AlertStatus = typeof AlertStatus[keyof typeof AlertStatus];

export const ALERT_STATUS_LABELS: Record<AlertStatus, string> = {
  open:         'Open',
  acknowledged: 'Acknowledged',
  escalated:    'Escalated',
  resolved:     'Resolved',
};

export const ALERT_STATUS_CLASSES: Record<AlertStatus, string> = {
  open:         'border border-alert-open text-alert-open',
  acknowledged: 'border border-alert-acknowledged text-alert-acknowledged',
  escalated:    'bg-alert-escalated text-white font-bold',
  resolved:     'border border-alert-resolved text-alert-resolved',
};
