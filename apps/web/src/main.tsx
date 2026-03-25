import { StrictMode, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { initSupabase } from '@commune/api';
import { routeTree } from './routeTree.gen';
import { useAuthStore } from './stores/auth';
import { useAuthListener } from './hooks/use-auth-listener';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import './styles.css';

initSupabase(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60,
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    },
  },
});

const router = createRouter({
  routeTree,
  context: {
    queryClient,
    auth: {
      isAuthenticated: false,
      isLoading: true,
      userId: null,
    },
  },
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

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
