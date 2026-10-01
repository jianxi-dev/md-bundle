## Why

编辑侧的块级操作入口偏弱，与预览侧能力不匹配：`/` 斜杠菜单扁平 8 项，无分组、无二级浮层、无表格网格选择器，且无右/下边界 clamp（靠窗口右下缘会溢出）；块手柄菜单缺「上移/下移」；标题无显式级别控件，Backspace 不能降级/清除。对标豆包编辑器的「三层入口模型」（插入菜单 / 块手柄 / 选区浮条），在已装饰化的 CM6 内核上补齐入口，不改底层 Markdown 语义。

## What Changes

- **斜杠菜单增强**：按分组渲染；「标题」展开 1–6 二级；「Callout」展开样式二级；「表格」用网格选择器插入 GFM 管道表格；菜单加右/下边界 clamp + 溢出滚动。
- **块手柄菜单增强**：在 转换为 / 复制 / 删除 之上增加「上移 / 下移」。
- **标题级别控件**：为标题块提供 H1–H6 显式切换；Backspace 可降级/清除标题。

## Capabilities

### New Capabilities
- `block-editing-entry`：编辑器块级操作入口（插入菜单分组/二级/网格选择器 + 块手柄上下移 + 标题级别控件）

### Modified Capabilities
（无）

## Impact

- Affected specs: `block-editing-entry`（新增）
- Affected code:
  - `packages/editor/src/slash.ts`（菜单模型 + 渲染 + 定位）
  - `packages/editor/src/block-handle.ts` / `block-handle-dom.ts` / `block-handle-ops.ts`（菜单项 + 上下移）
  - `packages/editor/src/decorations/heading.ts`（活动态可编辑/降级）
  - `apps/web/test/*.spec.ts`（e2e）
- **明确不做**：翻译选区 / 统计字数（用户决定）；评论 / 分享 / 复制链接（云文档能力）；分栏 / 颜色 / 缩进对齐（需先改 E-2 规格）。
