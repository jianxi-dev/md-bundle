## Why

md-bundle 当前定位是"Markdown 编辑器"，在编辑器红海中与 Typora/Obsidian/豆包竞争，无法形成差异化。真正的产品是 `.mdpkg` — 可运行的文档工件。同时代码库存在安全硬伤（DOMPurify 允许任意 style/id、全仓无 CSP），必须先修复。

## What Changes

- **安全底座修复**：DOMPurify 移除 style/id、开 ALLOW_DATA_ATTR + SANITIZE_NAMED_PROPS、CSP headers、API key 仅存内存、CSS 隔离
- **`.mdpkg` 即应用**：包内自带渲染器 + CSS，双击打开即成品，零安装离线
- **Diff-native AI**：选中 → 改写 → 行内 diff → Tab/Esc 逐 hunk 审阅
- **结构体检**：Lezer AST 规则诊断（论点无证据/章节无结论/层级跳跃），零 LLM 离线
- **章节重组**：拖拽章节重排 + 导出子树
- **语义编辑态**：非活动块完全渲染、活动块语义化揭示
- **富表现力**：Callout 12+ 类型、视觉模板库、HTML 块安全嵌入、CSS-only 组件
- **流式编辑**：打字即渲染、选择即操作

## Capabilities

### New Capabilities
- `security-hardening`：DOMPurify 修复 + CSP + API key 安全存储 + CSS 隔离
- `mdpkg-viewer`：.mdpkg 包内自带渲染器，双击打开即成品
- `diff-native-ai`：AI 修改为行内 diff 提案，逐 hunk 审阅
- `structure-linter`：基于 AST 的文档结构诊断
- `semantic-editing`：渐进式语法揭示编辑态
- `rich-templates`：视觉模板库 + HTML 块嵌入 + CSS-only 组件

### Modified Capabilities
- `md-bundle-web`：编辑态从"源码编辑"升级为"语义编辑态"，新增多种工作模式

## Impact

- `packages/renderer/src/markdown.ts`：DOMPurify 配置修改
- `packages/editor/src/decorations/`：正则 → Lezer AST 迁移，新增语义揭示装饰
- `apps/web/src/lib/exportMdpkg.ts`：包格式升级
- `apps/web/src/lib/exportHtml.ts`：渲染器内联
- `vercel.json`：CSP headers
- 新增：AI Provider 接口、结构诊断引擎、语义画布组件
