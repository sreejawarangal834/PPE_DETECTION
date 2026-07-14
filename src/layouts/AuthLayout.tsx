import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-full bg-bg flex flex-col items-center justify-center p-4 overflow-auto">
      {/* Subtle grid background */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(var(--color-text-primary) 1px, transparent 1px), linear-gradient(90deg, var(--color-text-primary) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-md">
        {/* Card */}
        <div className="bg-panel border border-border-soft rounded-2xl shadow-2xl p-8">
          {children}
        </div>
        {/* Footer */}
        <p className="text-center text-xs text-text-muted mt-5">
          PPE Detection &amp; Monitoring System · Innovision Industrial
        </p>
      </div>
    </div>
  );
}
