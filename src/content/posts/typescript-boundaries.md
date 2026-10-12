---
title: "TypeScript 的边界：类型之外的真实世界"
description: "当 API 数据进入应用，类型断言并不能替我们保证安全。"
date: 2026-08-12
tags: ["TypeScript", "前端开发"]
cover: "grid"
---

TypeScript 帮我们发现了很多错误。但有一类问题，它只能提醒我们存在，却无法独自解决：来自应用之外的数据，是否真的符合我们期望的形状？

## 断言不是验证

这段代码看起来类型完整，但 `as User` 不会检查服务器的实际返回值。

```ts
type User = {
  name: string;
  email: string;
};

const user = await response.json() as User;
```

如果服务器返回的是错误信息，类型系统不会在运行时帮我们拦下来。

## 让不确定性停在边界

一种简单的方式，是先把外部数据视为 `unknown`，再明确验证我们需要的字段。

```ts
function isUser(value: unknown): value is User {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return (
    'name' in value &&
    typeof value.name === 'string' &&
    'email' in value &&
    typeof value.email === 'string'
  );
}
```

复杂的数据可以使用 Zod 等校验工具。关键不是选择哪个库，而是保持一个约定：**外部数据进入核心逻辑之前，先经过检查。**

## 为失败留出清晰的出口

校验失败不应该只变成控制台里的一行红色文字。页面需要一个能解释发生了什么、并告诉用户下一步可以做什么的状态。

搜索索引加载失败时，显示重试提示；内容为空时，提供返回文章列表的入口。这些状态与“成功状态”同样属于产品。

## 类型是一份诚实的说明

一个好的类型系统，不应该帮我们掩盖不确定性，而应该让它变得可见。

从 `unknown` 开始并不意味着麻烦。恰恰相反，它提醒我们：这里是真实世界进入代码的地方，需要多一点认真。
