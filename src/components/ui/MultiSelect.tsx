import { useState, useRef, useEffect } from 'react';

interface Option { value: string; label: string; }

interface MultiSelectProps {
  label?: string;
  options: Option[];
  value: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  error?: string;
  className?: string;
}

export default function MultiSelect({ label, options, value, onChange, placeholder = 'Select…', error, className = '' }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function toggle(v: string) {
    onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v]);
  }

  const selected = options.filter(o => value.includes(o.value));

  return (
    <div className={`flex flex-col gap-1 ${className}`} ref={ref}>
      {label && <label className="text-sm text-text-secondary font-medium">{label}</label>}
      <div
        role="combobox" aria-expanded={open} aria-haspopup="listbox" tabIndex={0}
        onClick={() => setOpen(v => !v)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setOpen(v => !v); }}
        className={`
          min-h-[36px] flex flex-wrap gap-1 items-center bg-panel-alt border rounded-md px-2 py-1 cursor-pointer
          ${error ? 'border-status-danger' : 'border-border'}
          focus:outline-none focus:ring-2 focus:ring-accent
        `}
      >
        {selected.length === 0 && <span className="text-sm text-text-muted px-1">{placeholder}</span>}
        {selected.map(o => (
          <span key={o.value} className="flex items-center gap-1 bg-accent/20 text-accent text-xs px-2 py-0.5 rounded">
            {o.label}
            <button
              type="button" aria-label={`Remove ${o.label}`}
              onClick={e => { e.stopPropagation(); toggle(o.value); }}
              className="hover:text-white"
            >×</button>
          </span>
        ))}
      </div>
      {open && (
        <ul role="listbox" aria-multiselectable="true"
          className="absolute z-50 mt-1 max-h-52 overflow-y-auto bg-panel border border-border rounded-md shadow-lg"
        >
          {options.map(o => (
            <li
              key={o.value} role="option" aria-selected={value.includes(o.value)}
              onClick={() => toggle(o.value)}
              onKeyDown={e => { if (e.key === 'Enter') toggle(o.value); }}
              tabIndex={0}
              className="flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-panel-alt cursor-pointer"
            >
              <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${value.includes(o.value) ? 'bg-accent border-accent' : 'border-border'}`}>
                {value.includes(o.value) && <svg viewBox="0 0 10 10" fill="white" className="w-2.5 h-2.5"><path d="M2 5l2.5 2.5L8 3"/></svg>}
              </span>
              {o.label}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-xs text-status-danger" role="alert">{error}</p>}
    </div>
  );
}
