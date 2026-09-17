## Why

预览态表格当前使用 `width: max-content` 渲染，导致表格不会占满纸面可用宽度，且长内容（长 URL、连续字符）不会自动换行而是撑出横向滚动条。用户期望复用 clairis 预览态的表格能力：表格满屏显示、长内容自动换行。

## What Changes

- 将 `table { width: max-content; min-width: 100% }` 改为 `table { width: 100% }`——表格始终占满容器宽度
- 为 `th, td` 添加 `overflow-wrap: anywhere`——长内容在单元格内强制换行
- 保留 `.table-wrap { overflow-x: auto }` 作为极端不可断内容的兜底
- 不修改 HTML 结构、marked 渲染器或导出管线

## Capabilities

### New Capabilities

- `table-width-adaptation`: 预览态表格宽度自适应与长内容换行能力——表格占满可用宽度、单元格内容自动换行、极端内容横向滚动兜底

### Modified Capabilities

（无已有 capability 的 requirement 变更——这是纯 CSS 视觉层调整，不改变 spec 语义）

## Impact

- `packages/renderer/src/readerCss.ts`：light 和 dark 两个主题的表格 CSS 规则修改
- `packages/renderer/test/`：新增 CSS 规则断言测试
- 导出 HTML/PNG 复用 readerCssText，自动继承新样式（无需额外修改）
- 编辑态（CM6）不受影响
