import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';

export default defineConfig({
  plugins: [
    TanStackRouterVite({
      routeFileIgnorePattern: '\\.test\\.(ts|tsx)$',
    }),
    react(),
  ],
  build: {
    chunkSizeWarningLimit: 520,
    rollupOptions: {
      output: {
        manualChunks: {
          'mantine-core': ['@mantine/core', '@mantine/hooks'],
          'mantine-form': ['@mantine/form'],
          'mantine-dates': ['@mantine/dates'],
          'mantine-notifications': ['@mantine/notifications'],
          'recharts': ['recharts'],
          'tanstack': ['@tanstack/react-query', '@tanstack/react-router'],
        },
      },
    },
  },
});
