# mori. — 一个缓慢生长的数字花园

使用 Astro 7、TypeScript 和原生 CSS 构建的静态博客。中文内容与纸感排版参考 Astro Cactus，生成式图形和文章实验受到 Maxime Heckel 启发；图形与示例内容为本项目原创。

## 本地运行

需要 Node.js 22.12+。

```sh
npm install
npm run dev
```

打开 http://localhost:4321。

```sh
npm run check      # Astro / TypeScript 检查
npm run build      # 生成 dist/
npm run preview    # 预览生产构建
npm test           # 浏览器与无障碍回归测试
npm run update-holidays   # 拉取最新的法定节假日安排（写入 src/data/holidays.json）
```

## 功能

- 首页、按年份归档、分类与标签筛选（URL 可分享）、作品与工具、关于、404
- 作品卡片支持站内页面与外部链接；首页精选预览，独立作品页展示
- 作品列表内容区采用最大 1800px 的宽版画廊，随屏幕宽度自动增加列数；全站页头、页脚与文章阅读栏统一最大 640px
- Markdown / MDX 内容集合、类型校验、草稿过滤、自动阅读时间
- 文章目录高亮、阅读进度、代码复制、分享链接与底部标签筛选
- 搜索标题 / 摘要 / 标签，⌘K / Ctrl+K、方向键、Enter、Escape
- 深浅主题持久化，首次遵循系统偏好，加载前设置主题以避免闪烁
- 原创三叶结 Canvas 图形；离开视口或切换标签页时暂停，支持手动暂停及减少动态效果偏好
- MDX 内嵌交互地形实验
- 全年日历工具：年度进度、农历 / 节气 / 假期 / 调休月历（全年与当月两种视图），以及可自定义的发薪日与假期倒计时
- 自托管字体，无第三方追踪，无运行时 CDN 依赖
- RSS、sitemap、robots、canonical、Open Graph、文章 JSON-LD
- 响应式布局、键盘焦点、跳到正文链接、打印样式

## 换成你自己的博客

1. 编辑 `src/config.ts` 中的站名、作者、简介、邮箱和 GitHub。
2. 编辑首页、`src/pages/about.astro` 中的自我介绍。示例作者与邮箱均为占位内容。
3. 在项目根目录创建 `.env`（可复制 `.env.example`），设置真实域名：
   ```env
   SITE_URL=https://your-domain.com
   ```
   构建时也可通过环境变量传入。请务必在发布前替换默认的 `fieldnotes.example`，RSS、站点地图、canonical 和分享元数据会使用此域名。
4. 替换 `public/favicon.svg` 与 `public/og.png`（分享图片建议 1200×630）。`public/og.svg` 保留可编辑源文件。
5. 颜色与布局在 `src/styles/global.css` 中，首部的 CSS 变量同时定义深浅主题。

## 添加文章

在 `src/content/posts/` 新建 `.md` 或 `.mdx`。文件名自动成为文章 URL。

```yaml
---
title: 我的新文章
description: 一句话摘要
date: 2026-10-10
tags: [Astro, 前端开发]
category: 开发       # 开发 / 设计
cover: terrain       # terrain / orbit / grid / gradient
featured: false      # 首页展示最多两篇精选
draft: false         # true 时不出现在页面、搜索与 RSS 中
---
```

MDX 可导入 Astro 组件，例如：

```mdx
import ShaderPlayground from '../../components/ShaderPlayground.astro';

<ShaderPlayground />
```

## 添加作品与工具

在 `src/data/projects.ts` 的 `projects` 数组里添加一项：

```ts
{
  id: 'my-tool',
  title: '我的小工具',
  description: '简短介绍它能做什么。',
  href: 'https://your-tool.example.com/',
  kind: '工具',          // 工具 / 展示页 / 实验
  tags: ['TypeScript'],
  cover: 'grid',          // terrain / orbit / grid / gradient
  featured: true,
}
```

- 站内展示页：`href` 写成 `/projects/my-tool/`，并在 `src/pages/projects/my-tool.astro` 创建对应页面。
- 外部项目：使用完整的 HTTP / HTTPS 链接，自动在新标签页打开并设置安全的 `rel` 属性。
- 首页默认展示前两项；`featured: false` 仅从首页隐藏，独立作品页仍会展示。
- 内置三个可运行的站内示例：全年日历、噪声地形实验室与生成式三叶结。可从数组中移除，换成自己的作品；示例页面也可以自行删除。
- `src/layouts/ProjectLayout.astro` 提供居中的窄版展示页布局，可复用来放自己的组件或嵌入页面。

原来的随记与随想示例已保留为草稿，放在 `src/content/archive/`。它们不属于当前内容集合，不会生成公开页面，也不会进入搜索、RSS 或站点地图。

## 全年日历的数据

`/projects/year-calendar/` 是终端工具 [fished](https://github.com/mortyhuang/fished) 的网页版：年度进度、农历 / 节气 / 假期 / 调休月历（全年与当月两种视图），以及发薪与假期倒计时。

- 放假与调休安排来自国务院办公厅公告（via [china-holiday-calender](https://github.com/lanceliao/china-holiday-calender)），存放在 `src/data/holidays.json`，随站点一起构建，页面不会请求第三方接口。
- 农历、节气与节日由 `lunar-javascript` 在构建时计算；切换到当月视图或换年份时，同一个模块会在浏览器里按需加载。
- 发薪日由访问者自己设置（存进 localStorage），默认只显示 10 号。
- 相关代码：`src/lib/holidays.ts`（纯逻辑）、`src/lib/calendar-view.ts`（HTML 片段）、`src/lib/lunar-calendar.ts`（农历月历）、`src/components/HolidayCalendar.astro`（组件与样式）。
- 运行 `npm run update-holidays` 拉取最新公告，重新构建即可更新假期数据。

## 部署

`npm run build` 生成纯静态 `dist/`，可部署到 Netlify、Vercel、Cloudflare Pages 或任意静态服务器，无需数据库或服务器适配器。

- 构建命令：`npm run build`
- 输出目录：`dist`
- 环境变量：`SITE_URL`
- 平台 Node 版本：22.12 或更新

默认按站点根路径部署；若需部署到子目录，请同时调整 Astro `base` 配置与站内链接。

## 测试

测试默认使用 Playwright Chromium：

```sh
npx playwright install chromium
npm test
```

也可指定现有 Chrome 路径：
```sh
PLAYWRIGHT_CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm test
```
