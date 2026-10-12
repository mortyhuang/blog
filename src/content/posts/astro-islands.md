---
title: "Astro Islands：让网页回归轻盈"
description: "不是每个页面都需要一个完整的应用。从 Islands 架构出发，重新思考内容网站真正需要什么。"
date: 2026-09-20
tags: ["Astro", "前端开发", "性能"]
cover: "orbit"
featured: true
---

当我们打开一篇文章时，真正想得到的通常很简单：文字清晰、加载迅速、阅读不被打断。

但很多网页在展示第一段文字之前，需要先下载一整套运行时，初始化组件，建立状态，再重新计算已经由服务器生成过的内容。

Astro 给出了一种更朴素的选择：**先把内容交给读者，只为需要交互的部分发送 JavaScript。**

## 把 HTML 放回中心

Astro 组件默认在构建时或服务器端渲染为 HTML。没有客户端指令的框架组件，也不会自动把框架运行时发送到浏览器。

```astro
---
import Article from '../components/Article.astro';
import LikeButton from '../components/LikeButton.jsx';
---

<Article />
<LikeButton client:visible />
```

文章本身是静态 HTML。只有点赞按钮进入视口之后，才会加载它需要的交互代码。这些独立的交互区域，就是“岛屿”。

## 选择合适的加载时机

Astro 的客户端指令让我们对交互的成本保持清醒：

| 指令 | 什么时候加载 | 适合的场景 |
| --- | --- | --- |
| `client:load` | 页面加载时 | 首屏需要立即使用的交互 |
| `client:idle` | 浏览器空闲时 | 非关键但需要较早可用的功能 |
| `client:visible` | 进入视口时 | 评论区、图表、交互实验 |
| `client:media` | 匹配媒体查询时 | 仅在特定屏幕尺寸启用的组件 |

需要注意，这些指令用于 React、Vue、Svelte 等客户端框架组件。普通 `.astro` 组件中的原生脚本可以直接用 `<script>` 编写，不需要给它添加客户端指令。

## 内容应该有自己的结构

博客不只是一个页面列表。标题、日期、标签和草稿状态，都属于内容本身。

使用 Content Collections，可以在构建时验证这些信息，并为查询结果提供类型提示：

```ts
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const posts = defineCollection({
  loader: glob({
    pattern: '**/*.{md,mdx}',
    base: './src/content/posts',
  }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { posts };
```

在 Astro 7 中，Zod 从 `astro/zod` 导入。内容查询则仍然使用 `astro:content` 中的 `getCollection()` 和 `render()`。

## 轻盈不是没有交互

静态优先并不意味着放弃有趣的体验。这座花园依然有主题切换、标题与标签搜索、生成式图形和交互实验。

区别在于，每一段 JavaScript 都有一个具体的理由。搜索只在打开时获取索引，图形离开视口后停止绘制，文章正文无需等待任何框架完成初始化。

> 性能不只是分数，也是对读者时间的一种尊重。

## 用适合的工具做适合的事

Astro 很适合内容驱动的项目，但它不是所有项目的答案。如果大部分界面都依赖持续变化的客户端状态，一个应用型框架可能会更直接。

重要的不是选择最流行的工具，而是先问：这个页面到底需要什么？

对一个博客来说，答案往往就是文字、链接，以及一点恰到好处的交互。
