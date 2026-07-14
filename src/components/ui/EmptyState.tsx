import type { ReactNode } from 'react';
import Button from './Button';

interface EmptyStateProps {
  icon?: ReactNode;
  heading: string;
  message?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

const DefaultIcon = () => (
  <svg className="w-10 h-10 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
    <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
  </svg>
);

export default function EmptyState({ icon, heading, message, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}>
      <div className="mb-4 opacity-60">{icon ?? <DefaultIcon />}</div>
      <h3 className="text-lg font-medium text-text-secondary mb-1">{heading}</h3>
      {message && <p className="text-sm text-text-muted max-w-sm">{message}</p>}
      {action && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
