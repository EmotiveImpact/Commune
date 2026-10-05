import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  server: { port: 3003, host: '0.0.0.0' },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        businessMock: resolve(__dirname, 'business-mock.html'),
        combined: resolve(__dirname, 'combined.html'),
        allTogether: resolve(__dirname, 'all-together.html'),
        everyday: resolve(__dirname, 'everyday.html'),
        clearView: resolve(__dirname, 'clear-view.html'),
        editorial: resolve(__dirname, 'editorial.html'),
        howItWorks: resolve(__dirname, 'how-it-works.html'),
        lifeTogether: resolve(__dirname, 'life-together.html'),
        pricing: resolve(__dirname, 'pricing.html'),
        journal: resolve(__dirname, 'journal.html'),
        about: resolve(__dirname, 'about.html'),
      mobileApp: resolve(__dirname, 'mobile-app.html'),
      mobileAppV2: resolve(__dirname, 'mobile-app-v2.html'),
      mobileAppV3: resolve(__dirname, 'mobile-app-v3.html'),
      },
    },
  },
});
