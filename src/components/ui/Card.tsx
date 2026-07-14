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
    <div className={`bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden ${className}`}>
      {header && (
        <div className="px-6 py-4 border-b border-gray-700 text-sm text-gray-300 font-medium">
          {header}
        </div>
      )}
      <div className={padding ? 'p-6' : ''}>{children}</div>
      {footer && (
        <div className="px-6 py-4 border-t border-gray-700 text-sm text-gray-400">
          {footer}
        </div>
      )}
    </div>
  );
}
