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
| `src/styles/global.css` | 颜色与布局的 CSS 变量（深浅主题 × 四季配色） |
| `public/` | favicon、分享图等静态资源 |

## 主题：明暗 × 四季

配色分两层，互相正交，一共 8 套：

- **明暗**由页头的「对比度」按钮切换（圆圈右半实心那个），首次访问跟随系统偏好，选择存在 `localStorage`。
- **四季**按**节气**自动切换 —— 太阳到达黄经 315°/45°/135°/225°（立春 / 立夏 / 立秋 / 立冬）的那一刻换季，不是按固定月份。页头的季节按钮可以手动锁定某一季，选「跟随节气」恢复自动。图标依次是嫩芽 / 太阳 / 叶 / 雪花；太阳归夏季，所以明暗按钮换成了对比度图标，免得两个按钮的图标撞在一起。
- 地址栏加 `?season=spring|summer|autumn|winter` 可以预览某一季（不写入本地存储），方便截图和排配色。
- 南半球季节整体相反，按浏览器时区自动对调；时区判断覆盖不到时，可以在 `src/config.ts` 里把 `season.hemisphere` 设成 `'north'` / `'south'`；整个四季主题也能用 `season.enabled: false` 关掉。

交节时刻是**现算**的，没有预生成的节气表：`src/lib/season-core.js` 用 Meeus《Astronomical Algorithms》第 25 章的低精度太阳位置公式解出那一刻。和紫金山天文台公布的官方时刻逐条比对 2020–2100 年共 324 个样本，偏差中位 3 分钟、最大 11 分钟，且日期从不出错（2026 年立春官方 04:01:51，这里算出 04:02:08）。好处是站点就算很久不重新构建，也不会拿着一份过期的节气表。

代价是这段公式必须在首屏绘制之前算完，所以它会被**原样内联进 `<head>`**（约 6.7 KB，gzip 后约 3.5 KB）。静态站点构建时烘进 HTML 的季节会过期，内联脚本会在绘制前把 `data-season` 定成正确的值，因此不会先闪一下默认配色。

同一个 `season-core.js` 也会被打包模块 import（换季重判和手动切换要用），源码只有一份，不会漂移。注意这份文件的大小会连带影响打包：Astro 会把「无 import 且小于 `assetsInlineLimit`（默认 4 KB）」的脚本直接内联进每个 HTML，而内联的脚本每翻一页都要重传。目前这个 chunk 是 6 KB，留在可缓存的独立文件里，多页浏览更划算；要是把公式删掉、chunk 掉到 4 KB 以下，反而会被内联进每一页，总体传输反而变多。

| 位置 | 用途 |
| --- | --- |
| `src/lib/season-core.js` | 季节判定（节气公式 + 南半球推断）。会被原样内联，所以不写类型、注释从简 |
| `src/lib/season.ts` | 上面那份的类型化封装，原理与精度说明也在这里 |
| `src/components/Header.astro` | 页头的季节按钮与菜单 |
| `src/scripts/theme.ts` | 明暗与季节的切换、持久化、菜单交互 |

8 套配色的前景 / 背景组合都逐对验过 WCAG AA（4.5:1）。改完配色请跑 `pnpm test`：`tests/season.spec.ts` 会用 axe 在真实浏览器里把 4 季 × 明暗 × 两个页面重查一遍，并用 `page.clock` 把时间冻在交节前后，验证换季时机。

## 部署

`pnpm build` 生成纯静态 `dist/`，再由 `wrangler.jsonc` 作为 Cloudflare Workers 的静态资源（Static Assets）发布 —— 没有 Worker 脚本，也没有数据库或服务器适配器。

- 本地发布：`pnpm build && pnpm exec wrangler deploy`；只想验证打包可以用 `pnpm exec wrangler deploy --dry-run`。
- Workers Builds（dashboard）里的设置：
  - Build command：`pnpm run build`
  - Deploy command：`npx wrangler deploy` —— 仓库里有 `wrangler.jsonc`，不会再触发自动配置向导；`wrangler` 已固定在 devDependencies，npx 会用本地那一份
  - Environment variables：`SITE_URL=https://你的域名`（不设会退回 `astro.config.mjs` 里的占位域名，canonical / RSS / sitemap 都会写错）
- 分支预览：非生产分支的构建会跑 Preview 命令（默认 `npx wrangler preview`），它只创建/更新一个 Preview、不会发布到生产；`wrangler.jsonc` 里那个空的 `previews: {}` 块就是它要求的（没有单独设置也要留着）。
- 运行时版本：Node 由 `.node-version`（24.19.0）决定，pnpm 由 `packageManager` + `pnpm-lock.yaml` 决定。
- 日志：`wrangler.jsonc` 开了 Workers Logs（`observability.logs`），可在 dashboard → 该 Worker → Observability 查看。注意这台 Worker 没有脚本，命中静态文件的请求不会执行 Worker 代码，所以日志会很安静；要真正的请求日志得加一个最小 Worker 脚本（`main` + `ASSETS` 绑定）。
- `pnpm-workspace.yaml` 里的 `allowBuilds` 是 pnpm 11 的构建脚本白名单：wrangler 依赖的 esbuild / workerd 需要跑安装脚本，否则会以 `ERR_PNPM_IGNORED_BUILDS` 失败。
- 换到其他静态托管（Netlify、Vercel 等）：构建命令 `pnpm build`，输出目录 `dist`。
