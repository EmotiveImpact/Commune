import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: { alias: { '@commune/core/stories': resolve(__dirname, '../packages/core/src/stories/index.ts') } },
  build: { outDir: 'dist-green', emptyOutDir: true, rollupOptions: { input: { green: resolve(__dirname, 'green.html'), how: resolve(__dirname, 'how-it-works-g.html'), life: resolve(__dirname, 'life-together-g.html'), pricing: resolve(__dirname, 'pricing-g.html'), about: resolve(__dirname, 'about-g.html'), journal: resolve(__dirname, 'journal-g.html') } } },
});
