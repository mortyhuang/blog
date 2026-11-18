import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://calendar.themori.space',
  integrations: [sitemap()],
  trailingSlash: 'always',
  devToolbar: { enabled: false },
  vite: {
    optimizeDeps: {
      // 日历的农历库只在切换视图 / 换年份时动态 import。不预打包的话，dev
      // 里首次加载会命中 504（Outdated Optimize Dep），当月视图渲染不出来。
      include: ['lunar-javascript'],
    },
  },
});
