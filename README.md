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

`pnpm build` 生成纯静态 `dist/`，再由 `wrangler.jsonc` 作为 Cloudflare Workers 的静态资源（Static Assets）发布 —— 没有 Worker 脚本，也没有数据库或服务器适配器。

- 本地发布：`pnpm build && pnpm exec wrangler deploy`；只想验证打包可以用 `pnpm exec wrangler deploy --dry-run`。
- Workers Builds（dashboard）里的设置：
  - Build command：`pnpm run build`
  - Deploy command：`npx wrangler deploy` —— 仓库里有 `wrangler.jsonc`，不会再触发自动配置向导；`wrangler` 已固定在 devDependencies，npx 会用本地那一份
  - Environment variables：`SITE_URL=https://你的域名`（不设会退回 `astro.config.mjs` 里的占位域名，canonical / RSS / sitemap 都会写错）
- 分支预览：非生产分支的构建会跑 Preview 命令（默认 `npx wrangler preview`），它只创建/更新一个 Preview、不会发布到生产；`wrangler.jsonc` 里那个空的 `previews: {}` 块就是它要求的（没有单独设置也要留着）。
- 运行时版本：Node 由 `.node-version`（24.19.0）决定，pnpm 由 `packageManager` + `pnpm-lock.yaml` 决定。
- `pnpm-workspace.yaml` 里的 `allowBuilds` 是 pnpm 11 的构建脚本白名单：wrangler 依赖的 esbuild / workerd 需要跑安装脚本，否则会以 `ERR_PNPM_IGNORED_BUILDS` 失败。
- 换到其他静态托管（Netlify、Vercel 等）：构建命令 `pnpm build`，输出目录 `dist`。
