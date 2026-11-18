import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://themori.space',
  integrations: [mdx(), sitemap()],
  trailingSlash: 'always',
  // Static builds emit fallback redirect pages; Cloudflare uses public/_redirects for HTTP 301s.
  redirects: {
    '/about/': '/',
    '/projects/': '/toys/',
    '/projects/year-calendar/': '/toys/calendar/',
    '/toys/year-calendar/': '/toys/calendar/',
    '/projects/scratch-card/': '/toys/scratch-card/',
  },
  devToolbar: { enabled: false },
  markdown: {
    shikiConfig: { themes: { light: 'github-light-high-contrast', dark: 'github-dark' }, wrap: true },
  },
  vite: {
    optimizeDeps: {
      // 日历的农历库只在切换视图 / 换年份时动态 import。不预打包的话，dev
      // 里首次加载会命中 504（Outdated Optimize Dep），当月视图渲染不出来。
      include: ['lunar-javascript'],
    },
  },
});
