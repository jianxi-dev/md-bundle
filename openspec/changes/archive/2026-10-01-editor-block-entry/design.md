## Context

编辑器（`packages/editor`）已是 CM6 + 装饰的「活源码」模型：`slashKeymap()` 提供 `/` 菜单、`blockHandle()` 提供块手柄菜单、`editorDecorations()` 负责活动/非活动块渲染。`apps/web/src/App.tsx` 已把三者装配进 `EDITOR_EXT`。本次只增强入口，不改渲染管线、不改 Markdown 语义（E-2）。

## Goals / Non-Goals

- Goals：补齐块级操作入口（插入分组/二级/网格；块手柄上下移；标题级别）；菜单边界自适应。
- Non-Goals：翻译/字数/评论/分享/复制链接；分栏/颜色/对齐；真实拖拽新 UI；WYSIWYG 化。

## Decisions

- **菜单分组与二级**：在 `slash.ts` 的命令模型上增加 `group` 与可选 `children`，菜单渲染为「分组标题 + 行 + 悬浮二级浮层」。保持单次 `dispatch`（undo 一步回退）。
- **表格网格选择器**：悬浮网格（如 10×10），hover 高亮 N×M，点击插入 GFM 管道表格（表头 + 分隔行 + N 行）。
- **边界 clamp**：复用 `toolbar.ts` 的 clamp 思路，计算 `coordsAtPos` 后对右/下缘取 min，并给菜单容器 `max-height` + `overflow:auto`。
- **块手柄上下移**：复用 `computeBlockMove` + `computeMinimalChange`（#239 已引入最小变更），新增「上移/下移」菜单项。
- **标题级别**：活动标题块的 `# ` 目前被 `Decoration.replace` 成不可编辑 widget（P3）。方案：活动态不再替换该 marker（与 callout/list 一致），并提供块手柄菜单内 H1–H6 切换；Backspace 在标题行首降级一级、到 H1 再清除。

## Risks / Trade-offs

- 菜单从扁平改分组/二级会改动 `slash.ts` 的渲染与键位选择逻辑，需锁现有 `slash.test.ts` / `slash-menu.spec.ts`。
- 标题活动态改为可编辑可能影响 `decorations.test.ts` 的既有断言（届时按新契约更新）。
- 网格选择器/二级浮层为新增 DOM，须走 QG-4 真实路径测试。

## Migration Plan

无数据迁移。逐票纵向切片交付；每票含 e2e，合 main 后可独立演示。
