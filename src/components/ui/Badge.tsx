import type { ReactNode } from 'react';
import { ALERT_STATUS_CLASSES, ALERT_STATUS_LABELS } from '../../constants/alertStatus';
import { SEVERITY_CLASSES, SEVERITY_LABELS } from '../../constants/severity';

type BadgeVariant =
  | 'high' | 'medium' | 'low' | 'info'
  | 'open' | 'acknowledged' | 'escalated' | 'resolved'
  | 'online' | 'offline' | 'error' | 'degraded'
  | 'active' | 'inactive'
  | 'compliant' | 'non_compliant' | 'partial';

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  ...SEVERITY_CLASSES,
  ...ALERT_STATUS_CLASSES,
  online:       'bg-status-ok/20 text-status-ok',
  offline:      'bg-status-danger/20 text-status-danger',
  error:        'bg-status-warn/20 text-status-warn',
  degraded:     'bg-status-warn/20 text-status-warn',
  active:       'bg-status-ok/20 text-status-ok',
  inactive:     'bg-status-danger/20 text-status-danger',
  compliant:    'bg-status-ok/20 text-status-ok',
  non_compliant:'bg-status-danger/20 text-status-danger',
  partial:      'bg-status-warn/20 text-status-warn',
};

const VARIANT_LABELS: Record<BadgeVariant, string> = {
  ...SEVERITY_LABELS,
  ...ALERT_STATUS_LABELS,
  online: 'Online', offline: 'Offline', error: 'Error', degraded: 'Degraded',
  active: 'Active', inactive: 'Inactive',
  compliant: 'Compliant', non_compliant: 'Non-Compliant', partial: 'Partial',
};

interface BadgeProps {
  variant: BadgeVariant;
  label?: string;
  className?: string;
  icon?: ReactNode;
}

export default function Badge({ variant, label, className = '', icon }: BadgeProps) {
  const cls = VARIANT_CLASSES[variant] ?? 'bg-panel text-text-secondary';
  const displayLabel = label ?? VARIANT_LABELS[variant] ?? variant;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${cls} ${className}`}>
      {icon}
      <span className="sr-only">{displayLabel} — </span>
      {displayLabel}
    </span>
  );
}
