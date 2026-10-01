## Why

编辑器已从豆包三层入口模型补齐 L1（斜杠菜单）与 L2（块手柄），但 **L3 选区浮条**仍是最弱的一环：只有 4 个键（加粗 / 斜体 / 行内代码 / 插入链接），缺删除线、下划线、字体、对齐、颜色、分栏、复制，明显弱于参考产品。

本 change 把选区浮条补齐为**数据驱动的一排控件**，并首次引入「非 Markdown 但可无损表达」的样式能力：内联用语义 HTML `class`（`<span class="mdb-*">`），块级用 Pandoc fenced div（`::: {.align-center}` → `layout-*`）。**不新增私有语法、不修改消毒器**（`class` 与 `data-columns` 已在 `ALLOWED_ATTR`；`style` 仍被安全规格剥离）。

## What Changes

- **选区浮条数据驱动化**：`floating-toolbar.ts` 从 `commandRegistry` 渲染（不再硬编码 4 项），支持「按钮 + 下拉」两种控件形态，保留 #233 的单一选区工具条契约（`context-toolbar` 的 `text-selected` 仍返回 `[]`）。
- **基础内联格式补齐**：加粗 / 斜体 / **删除线（`~~`）** / **下划线（`<u>`）** / 行内代码 / 链接 / **复制**（复用 `code-copy`）。
- **内联样式（class）**：字体（`mdb-font-sans` / `serif` / `mono`）、颜色（`mdb-color-red|blue|green|orange|purple`）—— `<span class="mdb-*">`。
- **块级样式（fenced div）**：对齐（`{.align-left|center|right}`）、分栏（`{.col-2}` / `{.col-3}`）。
- **渲染侧补齐**：`readerCssText` 增加 `mdb-font-*` / `mdb-color-*` / `layout-align-*` / `layout-col-*` / `layout-card-grid` 的样式（**现状：`layout-*` 完全没有 CSS**）。
- **活源码装饰**：活动态隐藏 class 标签、按样式呈现（沿用 `boldItalic` 的 replace 模式）；**切换语义**（再次点击同一样式 = 移除）。

## Capabilities

### New Capabilities
- `selection-toolbar`：选区浮条的控件集、样式编码（class / fenced div）与活源码呈现

### Modified Capabilities
（无）

## Impact

- Affected specs: `selection-toolbar`（新增）
- Affected code:
  - `packages/editor/src/floating-toolbar.ts`（数据驱动 + 下拉控件）
  - `packages/editor/src/commands.ts`（新增 `toggle-underline` 等样式命令 + 切换语义）
  - `packages/editor/src/decorations/`（内联 class / 块级 fenced div 的活动态装饰）
  - `packages/renderer/src/readerCss.ts`（`mdb-*` / `layout-*` 样式）
  - `apps/web/src/App.tsx`（若需传入工具栏命令集）
  - `apps/web/test/*.spec.ts`（e2e）
- **明确不做**：AI（问问豆包）/ 评论 / 分享 / 复制链接（用户范围外）；消毒器 class 白名单钩子（另立安全工单，见 design.md「未来考虑」）。
