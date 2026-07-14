import { useEffect, useRef, type ReactNode } from 'react';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string;
}

export default function Dialog({ open, onClose, title, children, footer, maxWidth = 'max-w-lg' }: DialogProps) {
  const firstFocusRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    firstFocusRef.current?.focus();
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
      <div className="absolute inset-0 bg-bg/80 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className={`relative bg-panel border border-border rounded-xl shadow-2xl w-full ${maxWidth} flex flex-col max-h-[90vh]`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-soft shrink-0">
          <h2 id="dialog-title" className="text-base font-semibold text-text-primary">{title}</h2>
          <button ref={firstFocusRef} onClick={onClose} aria-label="Close dialog"
            className="text-text-muted hover:text-text-primary p-1 rounded transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 flex-1">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-border-soft shrink-0 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
