import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://fly.themori.space',
  integrations: [sitemap()],
  trailingSlash: 'always',
  devToolbar: { enabled: false },
});
