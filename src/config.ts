import type { Hemisphere } from './lib/season';

export const site = {
  name: 'Morty',
  title: 'Morty',
  description: '分享文章、创意实验与有趣的玩具，记录想法和探索。',
  author: 'Morty',
  email: 'hello@example.com',
  language: 'zh-CN',
  github: 'https://github.com/mortyhuang/blog',
  since: 2026,
  season: {
    /** 关掉之后不写 data-season、也不渲染季节控件，四季配色整体失效。 */
    enabled: true,
    /**
     * 'auto' 按浏览器时区推断南北半球（南半球季节整体相反）。
     * 推断不到的时区可以强制成 'north' / 'south'。
     * 注意：服务端渲染时拿不到时区，构建出来的 HTML 一律按北半球，
     * 首屏内联脚本会立刻纠正，所以不会闪。
     */
    hemisphere: 'auto' as Hemisphere,
  },
};
