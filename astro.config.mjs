import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { lineprinterLight, phosphorDark } from './src/styles/shiki-themes.mjs';

// CHANGE ME: your real domain. Everything else derives from this.
// It is exposed to components as import.meta.env.SITE.
const SITE = 'https://tianbowen.net';

export default defineConfig({
  site: SITE,
  trailingSlash: 'ignore',

  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'zh'],
    routing: {
      // English lives at /, Chinese at /zh/
      prefixDefaultLocale: false,
    },
  },

  integrations: [
    mdx(),
    sitemap({
      i18n: { defaultLocale: 'en', locales: { en: 'en', zh: 'zh-CN' } },
      // The human-readable site map is a real page; keep it out of the XML one.
      filter: (page) => !page.includes('/sitemap'),
    }),
  ],

  markdown: {
    // Astro 7 moved plugin config off `markdown.remarkPlugins` / `rehypePlugins`
    // and onto an explicit processor.
    processor: unified({
      remarkPlugins: [remarkMath],
      rehypePlugins: [[rehypeKatex, { strict: false, throwOnError: false }]],
    }),
    shikiConfig: {
      // Hand-written rather than bundled: min-light rendered everything black
      // (no visible highlighting) and min-dark's pinks and purples fought the
      // amber phosphor. See src/styles/shiki-themes.mjs.
      themes: { light: lineprinterLight, dark: phosphorDark },
      // Emit both themes as CSS variables so global.css can switch on .dark
      // instead of relying on prefers-color-scheme media queries.
      defaultColor: false,
      wrap: false,
    },
  },

  build: {
    // Keep asset URLs boring and stable.
    assets: 'assets',
  },

  vite: {
    plugins: [
      {
        // Vite's dev server serves public/ but does no directory-index
        // resolution, so /admin/ 404s locally even though Caddy's try_files
        // handles it in production. Without this the CMS looks broken in dev.
        name: 'public-dir-index',
        apply: 'serve',
        configureServer(server) {
          server.middlewares.use((req, _res, next) => {
            if (req.url?.startsWith('/admin/') && req.url.endsWith('/')) {
              req.url += 'index.html';
            }
            next();
          });
        },
      },
    ],
  },
});
