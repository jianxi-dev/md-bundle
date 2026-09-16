## Context

预览态表格当前在 `packages/renderer/src/readerCss.ts` 中使用 `width: max-content; min-width: 100%` 渲染。这导致：
- 短内容表格不会占满可用宽度，与正文宽度不一致
- 长内容（长 URL、连续字符）不换行，撑出横向滚动条

clairis（参考实现）使用 `width: 100%` + `overflow-wrap: anywhere` + `.table-wrap { overflow-x: auto }` 三层策略解决此问题。md-bundle 已有 `.table-wrap wide` HTML 包裹结构，只需调整 CSS。

## Goals / Non-Goals

**Goals:**
- 表格始终占满 `.table-wrap` 容器宽度（`width: 100%`）
- 单元格长内容自动换行（`overflow-wrap: anywhere`）
- 极端不可断内容由 `.table-wrap` 横向滚动兜底
- light 和 dark 双主题同步修改

**Non-Goals:**
- 不修改编辑态（CM6）表格样式
- 不修改 HTML 结构或 marked 渲染器
- 不修改导出管线（复用 readerCssText 自动继承）
- 不引入 `table-layout: fixed`（均分列宽破坏可读性）

## Decisions

### Decision 1: `width: 100%` 替代 `width: max-content`

**选择**: `table { width: 100% }`，移除 `min-width: 100%`

**理由**: `max-content` 让表格宽度由内容决定，短表格不会拉伸到全宽。`100%` 让表格始终占满容器，列宽仍按内容自动分配（`table-layout: auto` 默认行为）。

**替代方案**: `table-layout: fixed` + `width: 100%`——均分列宽，但会破坏内容可读性（短列浪费空间、长列被截断），不采用。

### Decision 2: `overflow-wrap: anywhere` 替代无换行规则

**选择**: `th, td { overflow-wrap: anywhere }`

**理由**: `anywhere` 参与 min-content 尺寸计算，确保即使没有任何自然断点的长字符串也能强制换行。相比 `word-break: break-all`（过度断行）和 `word-wrap: break-word`（不参与 min-content 计算），`anywhere` 是最优解。

**替代方案**: `word-break: break-all`——会在任意字符间断行，破坏英文单词可读性，不采用。

### Decision 3: 保留 `.table-wrap { overflow-x: auto }` 兜底

**选择**: 保留现有滚动容器样式

**理由**: 极端不可断内容（如 120 字符纯 `a` 重复）即使 `overflow-wrap: anywhere` 也可能需要滚动。`.table-wrap` 提供最终兜底，防止页面布局被撑破。

## Risks / Trade-offs

- **[Risk] 短表格拉伸到全宽可能显得稀疏** → 这是预期行为，与 clairis 一致；短表格全宽显示更符合文档排版惯例
- **[Risk] `overflow-wrap: anywhere` 可能在某些浏览器表现不同** → 现代浏览器（Chromium/Firefox/Safari）均支持，md-bundle 目标浏览器为 Chromium，风险低
- **[Trade-off] 列宽不再由内容完全决定** → `table-layout: auto` 下浏览器会尽量按内容分配列宽，但总宽固定为 100%，极端情况下列宽可能与纯 `max-content` 不同
