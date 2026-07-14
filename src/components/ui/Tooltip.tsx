import { useState, type ReactNode } from 'react';

interface TooltipProps { children: ReactNode; content: string; className?: string; }

export default function Tooltip({ children, content, className = '' }: TooltipProps) {
  const [show, setShow] = useState(false);
  return (
    <span className={`relative inline-flex ${className}`}
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)} onBlur={() => setShow(false)}>
      {children}
      {show && (
        <span role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-panel border border-border rounded text-xs text-text-secondary whitespace-nowrap z-50 pointer-events-none shadow-lg">
          {content}
        </span>
      )}
    </span>
  );
}
