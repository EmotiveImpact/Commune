import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { STORIES } from '../packages/core/src/stories';

/** The opening stories, shared with the web app, by the name the app gives them. */
const stories = resolve(__dirname, '../packages/core/src/stories/index.ts');

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/**
 * A page per story for ads, at /s/<story-id>. The build writes story.html once
 * and copies it to s/<id>/index.html with that story's title, description and
 * photo for link previews, so any static host serves /s/villa as it is. The
 * dev server sends /s/<id> to story.html, which reads the id from the
 * address; the preview server serves the copies.
 */
function storyPages(): Plugin {
  const rewrite = (url = '') => {
    const match = /^\/s\/([a-z]+)\/?(\?.*)?$/.exec(url);
    return match ? `/story.html${match[2] ?? ''}` : url;
  };
  return {
    name: 'story-pages',
    // After Vite has written the HTML pages.
    enforce: 'post',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => { req.url = rewrite(req.url); next(); });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        const match = /^\/s\/([a-z]+)\/?(\?.*)?$/.exec(req.url ?? '');
        if (match) req.url = `/s/${match[1]}/index.html${match[2] ?? ''}`;
        next();
      });
    },
    generateBundle(_options, bundle) {
      const page = Object.values(bundle).find(item => item.type === 'asset' && item.fileName === 'story.html');
      if (!page || page.type !== 'asset') return;
      const html = String(page.source);
      const photo = (name: string) => Object.values(bundle).find(item => item.type === 'asset' && [...(item.names ?? []), item.name].includes(name))?.fileName;
      for (const story of STORIES) {
        const [first, , sorted] = story.beats;
        const title = `${story.title} | Commune`;
        const description = `${first.h} ${sorted.h}`;
        const image = photo(`${first.img}.webp`);
        const head = [
          `<title>${escape(title)}</title>`,
          `<meta name="description" content="${escape(description)}" />`,
          `<meta property="og:title" content="${escape(story.title)}" />`,
          `<meta property="og:description" content="${escape(description)}" />`,
          image ? `<meta property="og:image" content="/${image}" />` : '',
          `<meta property="og:type" content="website" />`,
          `<meta name="twitter:card" content="summary_large_image" />`,
        ].filter(Boolean).join('\n    ');
        this.emitFile({
          type: 'asset',
          fileName: `s/${story.id}/index.html`,
          source: html.replace(/<title>[\s\S]*?<\/title>/, head).replace('data-story=""', `data-story="${story.id}"`),
        });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), storyPages()],
  resolve: { alias: [{ find: /^@commune\/core\/stories$/, replacement: stories }] },
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
        story: resolve(__dirname, 'story.html'),
      mobileApp: resolve(__dirname, 'mobile-app.html'),
      mobileAppV2: resolve(__dirname, 'mobile-app-v2.html'),
      mobileAppV3: resolve(__dirname, 'mobile-app-v3.html'),
      },
    },
  },
});
