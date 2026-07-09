import { Toaster } from 'react-hot-toast';

export default function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: 'var(--color-panel)',
          color: 'var(--color-text-primary)',
          border: '1px solid var(--color-border)',
          borderRadius: '8px',
          fontSize: '14px',
        },
        success: { iconTheme: { primary: 'var(--color-status-ok)', secondary: 'var(--color-panel)' } },
        error:   { iconTheme: { primary: 'var(--color-status-danger)', secondary: 'var(--color-panel)' } },
      }}
    />
  );
}
