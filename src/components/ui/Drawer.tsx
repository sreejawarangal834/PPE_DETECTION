import { useEffect, type ReactNode } from 'react';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  side?: 'right' | 'left';
  width?: string;
  'aria-label'?: string;
}

export default function Drawer({ open, onClose, title, children, side = 'right', width = 'w-[420px]', 'aria-label': ariaLabel }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <div className={`fixed inset-0 z-50 flex ${side === 'right' ? 'justify-end' : 'justify-start'} transition-opacity ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      role="dialog" aria-modal="true" aria-label={ariaLabel ?? title}>
      <div className="absolute inset-0 bg-bg/70 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className={`relative bg-panel border-l border-border flex flex-col h-full shadow-2xl transition-transform duration-300 ${width}
        ${open ? 'translate-x-0' : side === 'right' ? 'translate-x-full' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-soft shrink-0">
          <h2 className="text-base font-semibold text-text-primary">{title}</h2>
          <button onClick={onClose} aria-label="Close panel"
            className="text-text-muted hover:text-text-primary p-1 rounded transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
