import { RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { router } from './router';
import { queryClient } from './lib/queryClient';
import ToastProvider from './components/ui/Toast';
import { DetectionStoreProvider } from './state/DetectionStore';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* DetectionStoreProvider wraps the entire app once — no duplicates */}
      <DetectionStoreProvider>
        <RouterProvider router={router} />
        <ToastProvider />
      </DetectionStoreProvider>
    </QueryClientProvider>
  );
}
