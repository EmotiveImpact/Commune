import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-plugin/vite';

export default defineConfig({
  plugins: [
    TanStackRouterVite(),
    react(),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'mantine-core': ['@mantine/core', '@mantine/hooks', '@mantine/notifications', '@mantine/dates'],
          'recharts': ['recharts'],
          'tanstack': ['@tanstack/react-query', '@tanstack/react-router'],
        },
      },
    },
  },
});
