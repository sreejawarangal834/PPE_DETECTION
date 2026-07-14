interface SliderProps {
  label?: string; min?: number; max?: number; step?: number;
  value: number; onChange: (v: number) => void; className?: string;
  formatValue?: (v: number) => string;
}

export default function Slider({ label, min = 0, max = 1, step = 0.01, value, onChange, className = '', formatValue }: SliderProps) {
  const display = formatValue ? formatValue(value) : value.toFixed(2);
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {label && (
        <div className="flex justify-between items-center">
          <label className="text-sm text-text-secondary font-medium">{label}</label>
          <span className="text-sm font-mono text-accent">{display}</span>
        </div>
      )}
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-full bg-border accent-accent cursor-pointer"
        aria-label={label} aria-valuenow={value} aria-valuemin={min} aria-valuemax={max}
      />
    </div>
  );
}
