# TODOS

## Completed

### Wave 1 — @md-bundle/renderer 抽取与切换

**What:** 新建 `packages/renderer` 包，核心渲染管线移植，KaTeX + mermaid + lezer 高亮懒加载，排版双主题，apps/web 切换共享渲染器。

**Why:** 渲染逻辑从 apps/web 解耦，供编辑器预览与 web 预览共用，消除重复实现。

**Context:** 1.1–1.5 全部完成：barrel 契约、marked+DOMPurify 管线、懒加载水合、readerCssText 双主题、apps/web 切换并下线旧渲染器。

**Completed:** v1.0.0.0 (2026-09-10)

### Wave 2 — 布局 v2 信息架构

**What:** 顶栏 v2、单窗三模式工作区、资源区重构、左栏+大纲、整窗拖放、落地页重设计、移动端适配。

**Why:** 从单栏编辑器升级为多窗格、多页签、移动友好的现代 IDE 布局。

**Context:** 2.1–2.7 全部完成：ghost 图标顶栏、三模式切换、左栏文件/资源页签、OutlineMenu 悬停弹层、无遮罩拖放、Landing 重设计、移动端抽屉适配。

**Completed:** v1.0.0.0 (2026-09-10)

### Wave 3 — 编辑态装饰（活的源码）

**What:** clairis 五件装饰移植 + IME 守卫、行内图片装饰、callout 卡片装饰、三模式接入。

**Why:** 编辑模式下实时渲染标题/粗斜体/列表/引用/代码/图片/callout，光标进入露源码。

**Context:** 3.1–3.4 全部完成：decorations 五件套、image widget、callout 色调对齐 renderer、Compartment 三模式切换。

**Completed:** v1.0.0.0 (2026-09-10)

### Wave 4 — 多页签 + 页签会话

**What:** 页签模型重构、IndexedDB 会话持久化、页签条 UI（脏点/关闭确认）、最近文档接线。

**Why:** 支持多文档并行编辑，刷新后恢复工作状态。

**Context:** 4.1–4.4 全部完成：lib/tabs.ts 模型、sessionStore 配额保护、TabStrip 脏点+三分支关闭确认、Landing 最近文档。

**Completed:** v1.0.0.0 (2026-09-10)

### Wave 5 — FSA 文件工作区 + 保存模型

**What:** FSA 能力层、文件树 UI、树内操作、保存模型重构（单一主按钮三态）。

**Why:** 授权文件夹后直接读写本地文件，保存/另存为/下载三路径统一。

**Context:** 5.1–5.4 全部完成：lib/fsa.ts 能力层、FileTree 递归读取、新建/重命名/删除/拖放、save.ts 统一 SaveResult。

**Completed:** v1.0.0.0 (2026-09-10)

### Wave 6 — 主题 + 分享 + 文档收口 + 回归

**What:** 主题三态、邀请链接、分享卡重构、文档收端（ADR/spec/AGENTS/SEO 示例页）、端到端回归。

**Why:** 完整的用户可见功能闭环与交付硬门槛。

**Context:** 6.1–6.5 全部完成：themePreference、shareLink+nicknames、4 型分享卡、ADR-0002+openspec+SEO 示例页、全量回归证据。

**Completed:** v1.0.0.0 (2026-09-10)

### Final verification wave (partial)

**What:** 计划符合性审计、代码质量、真机手动 QA、范围忠实度。

**Why:** 发布前最终把关。

**Context:** 7.1 计划符合性审计（29 todos 逐条落地，OUT 清单核对）、7.2 代码质量（typecheck/lint 0、无 as any）、7.4 范围忠实度（vendor 零改动、降级验证）已完成。7.3 真机手动 QA 由 orchestrator 另行委派。

**Completed:** v1.0.0.0 (2026-09-10)
