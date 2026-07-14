interface DateRange { from: string; to: string; }

interface DateRangePickerProps {
  label?: string; value: DateRange;
  onChange: (v: DateRange) => void; className?: string;
}

export default function DateRangePicker({ label, value, onChange, className = '' }: DateRangePickerProps) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && <span className="text-sm text-text-secondary font-medium">{label}</span>}
      <div className="flex items-center gap-2">
        <input type="date" value={value.from} onChange={e => onChange({ ...value, from: e.target.value })}
          aria-label="Date from"
          className="bg-panel-alt border border-border rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent" />
        <span className="text-text-muted text-sm">to</span>
        <input type="date" value={value.to} onChange={e => onChange({ ...value, to: e.target.value })}
          aria-label="Date to"
          className="bg-panel-alt border border-border rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent" />
      </div>
    </div>
  );
}
