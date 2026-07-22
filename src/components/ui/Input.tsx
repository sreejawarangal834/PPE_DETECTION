import { useState, type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
}

export default function Input({ label, error, hint, leftIcon, className = '', id, type, ...rest }: InputProps) {
  const [showPw, setShowPw] = useState(false);
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  const resolvedType = type === 'password' ? (showPw ? 'text' : 'password') : type;

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-text-secondary">
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">{leftIcon}</span>
        )}
        <input
          {...rest}
          id={inputId}
          type={resolvedType}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          aria-invalid={!!error}
          className={`
            w-full bg-panel-alt border rounded-lg px-4 py-2 text-sm text-text-primary
            placeholder-text-muted transition-colors
            focus:outline-none focus:ring-2 focus:ring-accent
            ${error ? 'border-status-danger' : 'border-border'}
            ${leftIcon ? 'pl-10' : ''}
            ${type === 'password' ? 'pr-10' : ''}
          `}
        />
        {type === 'password' && (
          <button
            type="button"
            onClick={() => setShowPw(v => !v)}
            aria-label={showPw ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
          >
            {showPw ? (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.08 10.08 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"/></svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            )}
          </button>
        )}
      </div>
      {error  && <p id={`${inputId}-error`}  className="text-status-danger text-sm mt-1" role="alert">{error}</p>}
      {!error && hint && <p id={`${inputId}-hint`} className="text-text-muted text-sm mt-1">{hint}</p>}
    </div>
  );
}
