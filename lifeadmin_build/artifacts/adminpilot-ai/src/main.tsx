import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';
const App = lazy(() => import.meta.env.VITE_LIFEADMIN_LOCAL === 'true' ? import('./LocalApp') : import('./App'));
import { ErrorBoundary } from '@/components/error-boundary';
import { LoadingSpinner } from './Feedback';

import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<p role="status" aria-busy="true" className="flex min-h-screen items-center justify-center gap-3 bg-slate-50 p-6 font-semibold text-violet-900"><LoadingSpinner />Opening HomeAdmin…</p>}><App /></Suspense>
    </QueryClientProvider>
  </ErrorBoundary>,
);
