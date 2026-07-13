import type { SelectHTMLAttributes } from 'react';

interface Option { value: string; label: string; }

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: Option[];
  error?: string;
  placeholder?: string;
}

export default function Select({ label, options, error, placeholder, className = '', id, ...rest }: SelectProps) {
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && <label htmlFor={selectId} className="block text-sm font-medium text-gray-300">{label}</label>}
      <select
        {...rest}
        id={selectId}
        aria-invalid={!!error}
        className={`
          w-full bg-gray-800 border rounded-lg px-4 py-2 text-sm text-white
          focus:outline-none focus:ring-2 focus:ring-blue-500
          ${error ? 'border-red-500' : 'border-gray-600'}
        `}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error && <p className="text-red-400 text-sm mt-1" role="alert">{error}</p>}
    </div>
  );
}
