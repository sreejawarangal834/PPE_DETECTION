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
    <div className={`bg-panel border border-border-soft rounded-lg overflow-hidden ${className}`}>
      {header && (
        <div className="px-4 py-3 border-b border-border-soft text-sm text-text-muted font-medium">
          {header}
        </div>
      )}
      <div className={padding ? 'p-4' : ''}>{children}</div>
      {footer && (
        <div className="px-4 py-3 border-t border-border-soft text-sm text-text-muted">
          {footer}
        </div>
      )}
    </div>
  );
}
