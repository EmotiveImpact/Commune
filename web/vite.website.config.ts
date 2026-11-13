import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import legacy from './vite.config';
// Reuse story generation so all existing /s/<id> links remain valid.
export default defineConfig({
  plugins: legacy.plugins,
  resolve: legacy.resolve,
  base: '/',
  build: {
    outDir: 'dist', emptyOutDir: true,
    rollupOptions: { input: Object.fromEntries(
      ['index', 'how-it-works', 'life-together', 'pricing', 'about', 'journal', 'story']
        .map(name => [name, resolve(__dirname, `${name}.html`)])
    ) }
  }
});
