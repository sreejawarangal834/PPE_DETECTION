import { useState, useRef, useEffect, memo } from 'react';
import { ListFilter, ChevronDown } from 'lucide-react';
import { DETECTION_CLASSES, type DetectionCategory } from '../../constants/detectionClasses';

const CATEGORY_LABEL: Record<DetectionCategory, string> = {
  ppe:   'PPE Equipment',
  body:  'Body Parts',
  other: 'Other',
};

const CATEGORY_ORDER: DetectionCategory[] = ['ppe', 'body', 'other'];

interface Props {
  /** Currently visible class ids */
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  className?: string;
}

/**
 * Popover control listing every detectable class with a color swatch and
 * checkbox. Unchecking a class hides its boxes/label from the live feed
 * and detection list without affecting what the backend actually detects.
 */
function DetectionClassFilter({ selected, onChange, className = '' }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(next);
  }

  function selectAll() {
    onChange(new Set(DETECTION_CLASSES.map(c => c.id)));
  }

  function selectNone() {
    onChange(new Set());
  }

  const activeCount = selected.size;
  const totalCount = DETECTION_CLASSES.length;

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-semibold border
          bg-panel-alt border-border text-text-secondary hover:text-text-primary hover:border-accent/50
          hover:bg-panel-hover transition-all duration-200"
      >
        <ListFilter className="w-3.5 h-3.5" aria-hidden="true" />
        Detections
        <span className="text-xs font-mono text-text-muted">{activeCount}/{totalCount}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute z-50 mt-2 w-72 max-h-96 overflow-y-auto bg-panel border border-border
            rounded-xl shadow-lg p-3 space-y-3"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Show on feed</p>
            <div className="flex items-center gap-2 text-xs font-medium">
              <button type="button" onClick={selectAll} className="text-accent hover:text-accent-hover">All</button>
              <span className="text-border">·</span>
              <button type="button" onClick={selectNone} className="text-text-muted hover:text-text-secondary">None</button>
            </div>
          </div>

          {CATEGORY_ORDER.map(category => {
            const classes = DETECTION_CLASSES.filter(c => c.category === category);
            if (classes.length === 0) return null;
            return (
              <div key={category}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1.5">
                  {CATEGORY_LABEL[category]}
                </p>
                <div className="space-y-0.5">
                  {classes.map(c => {
                    const checked = selected.has(c.id);
                    return (
                      <label
                        key={c.id}
                        className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer
                          hover:bg-panel-alt transition-colors duration-100"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(c.id)}
                          className="sr-only"
                        />
                        <span
                          className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                            checked ? 'border-transparent' : 'border-border'
                          }`}
                          style={checked ? { backgroundColor: c.color } : {}}
                        >
                          {checked && (
                            <svg viewBox="0 0 10 10" fill="#12151A" className="w-2.5 h-2.5">
                              <path d="M2 5l2.5 2.5L8 3" stroke="#12151A" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </span>
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} aria-hidden="true" />
                        <span className={`text-sm truncate ${checked ? 'text-text-primary' : 'text-text-muted'}`}>
                          {c.label}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default memo(DetectionClassFilter);
