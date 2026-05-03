import { StrictMode, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { initSupabase } from '@commune/api';
import { useAuthStore } from './stores/auth';
import { useAuthListener } from './hooks/use-auth-listener';
import { createObservedFetch, instrumentQueryClient } from './utils/observability';
import { queryClient } from './lib/query-client';
import { router } from './lib/router';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import './styles.css';

initSupabase(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
  global: {
    fetch: createObservedFetch(window.fetch.bind(window), {
      apiBaseUrl: import.meta.env.VITE_SUPABASE_URL,
    }),
  },
});

instrumentQueryClient(queryClient);

function App() {
  useAuthListener();
  const { isAuthenticated, isLoading, user } = useAuthStore();

  const userId = user?.id ?? null;
  const routerContext = useMemo(
    () => ({
      queryClient,
      auth: { isAuthenticated, isLoading, userId },
    }),
    [isAuthenticated, isLoading, userId],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} context={routerContext} />
    </QueryClientProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
