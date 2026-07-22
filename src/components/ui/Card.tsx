import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  header?: ReactNode;
  footer?: ReactNode;
  padding?: boolean;
}

export default function Card({ children, className = '', header, footer, padding = true }: CardProps) {
  return (
    <div className={`bg-panel border border-border-soft rounded-xl overflow-hidden ${className}`}>
      {header && (
        <div className="px-6 py-4 border-b border-border-soft text-sm text-text-secondary font-medium">
          {header}
        </div>
      )}
      <div className={padding ? 'p-6' : ''}>{children}</div>
      {footer && (
        <div className="px-6 py-4 border-t border-border-soft text-sm text-text-muted">
          {footer}
        </div>
      )}
    </div>
  );
}
