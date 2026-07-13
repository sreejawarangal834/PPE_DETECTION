import type { ReactNode } from 'react';

/**
 * PageShell — wraps every feature page.
 *
 * Guarantees:
 * - The page content fills the available main area (flex-1)
 * - Content scrolls INSIDE this container only — no browser-level scroll
 * - Padding is applied consistently (p-6)
 * - No min-h-screen, no overflow that escapes to the browser
 *
 * Usage:
 *   <PageShell>
 *     <PageHeader ... />
 *     <div className="space-y-6">...</div>
 *   </PageShell>
 *
 * For pages that manage their own internal layout (e.g. Monitoring with a
 * right side panel), pass noPadding and handle padding inside.
 */
interface PageShellProps {
  children: ReactNode;
  /** Skip the default p-6 padding (for pages with custom internal layout) */
  noPadding?: boolean;
  className?: string;
}

export default function PageShell({ children, noPadding = false, className = '' }: PageShellProps) {
  return (
    <div
      className={`
        h-full w-full overflow-y-auto overflow-x-hidden
        ${noPadding ? '' : 'p-6'}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
