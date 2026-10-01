## Context

选区浮条 = `packages/editor/src/floating-toolbar.ts`（CM6 `ViewPlugin`，硬编码 4 命令、纯字符串包裹、**不切换**）。渲染 SSOT = `@md-bundle/renderer` 的 `renderMarkdown` + `readerCssText`（预览 / HTML 导出 / PNG 导出同源）。消毒器 `SANITIZE_CONFIG` **允许 `class` 与 `data-columns`，剥离 `style`/`id`**（security-hardening 规格钉死）。

参考产品（豆包）选区浮条：`字体▾ | 对齐▾ | B | S | I | U | 🔗 | </> | A▾ | 分栏 | 复制`。其中 4 项（字体 / 对齐 / 颜色 / 分栏）在标准 Markdown 中无原位表达——本设计解决其**无损编码**。

## Goals / Non-Goals

- Goals：补齐浮条控件；为字体/颜色/对齐/分栏提供**不削弱安全规格**的编码；预览与三类导出保真；活源码可编辑。
- Non-Goals：AI / 评论 / 分享 / 复制链接；消毒器 class 白名单；自由取色 / 任意字体（仅预置集合）。

## Decisions

**决策（经 Oracle 裁定）：class 语义 HTML（内联）+ Pandoc fenced div（块级）；不改消毒器。**

| 选项 | 结论 | 原因 |
|---|---|---|
| 内联 `style` | ❌ | 安全规格剥离 `style`（防 CSS 注入） |
| **class 语义 HTML** | ✅ 选用 | `class` 已允许；匹配 callout 先例；无新攻击面 |
| 扩展 MD 语法（`==x==`/`::align::`） | ❌ | 违反「无私有语法」 |
| 放弃 4 控件 | ❌ | 不满足目标 |

### 编码表

| 控件 | 形态 | 源码 | 渲染类 |
|---|---|---|---|
| 字体 | 内联 | `<span class="mdb-font-serif">` | `.mdb-font-{sans,serif,mono}` |
| 颜色 | 内联 | `<span class="mdb-color-red">` | `.mdb-color-{red,blue,green,orange,purple}` |
| 对齐 | 块级 | `::: {.align-center}` … `:::` | `.layout-align-{left,center,right}` |
| 分栏 | 块级 | `::: {.col-2}` / `::: {.col-3}` | `.layout-col-2/3`（**已支持解析**） |

- 内联前缀 `mdb-*` 沿用编辑器既有命名（`mdb-floating-toolbar`）；块级 `layout-*` 沿用 `fencedDivExtension` 既有前缀。
- 对齐/分栏**无需改 `resolveWrapper`**：未知类已回退 `layout-{name}`（`::: {.align-center}` → `layout-align-center`）。
- 消毒器**零改动**：`class`/`data-columns` 已在白名单。

### 渲染侧现状缺口（须补）

`readerCssText` **没有任何 `layout-*` 样式** → 现存的 `{.col-2}`/`{.col-3}`/`{.card-grid}` 渲染出来是无样式的 `<div>`。本 change 补齐 `layout-col-2/3`、`layout-card-grid[data-columns]`、`layout-align-*`、`mdb-font-*`、`mdb-color-*`（深/浅两套）。

### 活源码与切换

- 内联：活动态用 `Decoration.replace` 隐藏 `<span class="mdb-*">`/`</span>` 标签、对内容施样式；光标进入露回源码（沿用 `decorations/boldItalic.ts` 模式）。
- 块级：活动态用 `Decoration.line` 呈现对齐/分栏提示。
- **切换语义**：再次点击同一样式 = 移除包裹；点击另一种 = 替换。检测用**轻量字符串/正则**（不做完整 HTML 解析）。
- 单次 `dispatch`，undo 一步回退。

## Risks / Trade-offs

| 风险 | 级别 | 缓解 |
|---|---|---|
| class 冲突 | 低 | `mdb-*` / `layout-*` 命名空间隔离 |
| fenced div 嵌套 | 中 | 对齐/分栏 div 不嵌套；命令检测已包裹即切换而非再包 |
| 切换解析复杂度 | 中 | 仅正则/字符串匹配，不做 HTML 解析器 |
| 导出保真 | 低 | CSS 入 `readerCssText`（三导出同源） |
| 既有内容 | 低 | 只增类与样式，不改既有 `layout-*` 解析行为 |

## Migration Plan

无数据迁移。4 张纵向切片票逐票交付；每票含 e2e，合 main 后独立可演示。

## 未来考虑（不在本次范围）

- **消毒器 class 白名单钩子**：独立安全工单。若做，允许 `mdb-*`、`layout-*`、`callout`、`tok-*`、`code-*`、`mermaid-*`、`md-*`、`cjk-pad`、`katex*`，剥离其余。
