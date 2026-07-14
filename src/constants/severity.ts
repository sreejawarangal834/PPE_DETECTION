export const Severity = {
  HIGH:   'high',
  MEDIUM: 'medium',
  LOW:    'low',
  INFO:   'info',
} as const;

export type Severity = typeof Severity[keyof typeof Severity];

export const SEVERITY_LABELS: Record<Severity, string> = {
  high:   'High',
  medium: 'Medium',
  low:    'Low',
  info:   'Info',
};

export const SEVERITY_CLASSES: Record<Severity, string> = {
  high:   'bg-severity-high/20 text-severity-high',
  medium: 'bg-severity-medium/20 text-severity-medium',
  low:    'bg-severity-low/20 text-severity-low',
  info:   'bg-severity-info/20 text-severity-info',
};
