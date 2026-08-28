import { createRouter } from '@tanstack/react-router';
import { routeTree } from '../routeTree.gen';
import { queryClient } from './query-client';

export const router = createRouter({
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
