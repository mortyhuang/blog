# the mori.

用 [Astro](https://astro.build) 7、TypeScript 和原生 CSS 构建的静态博客。中文内容与纸感排版参考 Astro Cactus，生成式图形与文章实验受到 Maxime Heckel 启发；图形与示例内容为本项目原创。

## 本地运行

需要 Node.js 24.19+（版本写在 `.node-version`，fnm 会自动切换），包管理器使用 pnpm。

```sh
pnpm install
pnpm dev       # http://localhost:4321
pnpm build     # 输出静态站点到 dist/
pnpm preview   # 预览生产构建
pnpm check     # Astro / TypeScript 检查
pnpm test      # Playwright 浏览器与无障碍回归测试
pnpm deploy    # 构建并发布到 Cloudflare Workers
```

## 内容在哪里

| 位置 | 用途 |
| --- | --- |
| `src/config.ts` | 站名、作者、简介、邮箱等站点配置 |
| `src/content/posts/` | 文章（Markdown / MDX，文件名即 URL） |
| `src/data/projects.ts` | 作品与工具列表 |
| `src/pages/` | 首页、归档、标签、关于、404 等页面 |
| `src/styles/global.css` | 颜色与布局的 CSS 变量（深浅主题） |
| `public/` | favicon、分享图等静态资源 |

## 部署

`pnpm build` 生成纯静态 `dist/`，无需数据库或服务器适配器。

- **Cloudflare Workers**：`wrangler.jsonc` 把 `dist/` 当作 Workers Static Assets 发布（没有 Worker 脚本），`pnpm deploy` 一步完成构建与发布。CI 里构建与部署分开时，部署命令用 `pnpm exec wrangler deploy`。
- **其他静态托管**（Netlify、Vercel、Cloudflare Pages 等）：构建命令 `pnpm build`，输出目录 `dist`。
- 发布前在 `.env` 里设置真实域名（参考 `.env.example` 的 `SITE_URL`）。
