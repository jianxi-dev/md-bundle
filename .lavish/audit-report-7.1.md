# MD-Bundle v2 — 计划符合性审计报告（Task 7.1）

**审计日期**: 2026-09-07  
**审计范围**: tasks.md 29 个 todos (Waves 1-6) + OUT 列表核对  
**审计方法**: 源代码审查 + git commit 历史 + 测试证据 + 构建产物分析  

---

## 一、总体验证结论

| 维度 | 状态 | 说明 |
|------|------|------|
| 29 todos 完成度 | ⚠️ **25/29 完全落地** | 4 项存在缺口 |
| OUT 列表合规 | ✅ **10/10 合规** | 所有限制未被违反 |
| 测试覆盖 | ⚠️ **部分缺失** | 关键证据文件缺失 |
| 文档收口 | ⚠️ **部分缺失** | 主 spec 未同步、glossary 未创建 |

---

## 二、逐 Wave 审计

### Wave 1 — @md-bundle/renderer 抽取与切换 ✅

| Task | 状态 | 验证依据 |
|------|------|----------|
| 1.1 包骨架 | ✅ | `packages/renderer/` 存在，barrel 契约 4 导出 + RenderOptions 类型探针，`public-api.test.ts` 存在 |
| 1.2 核心渲染管线 | ✅ | `markdown.ts` 存在 (marked+DOMPurify+callout 22 键)，`markdown.test.ts` 存在 |
| 1.3 KaTeX+mermaid+highlight | ✅ | `lazy.ts` 动态导入，`math.ts`/`mermaid.ts`/`highlight.ts` 存在，`lazy-features.test.ts` 存在 |
| 1.4 排版双主题 | ✅ | `readerCss.ts` 存在 (37KB)，`theme.test.ts` 存在 |
| 1.5 web 切换 + 旧器下线 | ✅ | `PreviewView.tsx` 使用 `renderMarkdown`+`hydrateLazyFeatures`，grep 零残留 `renderMarkdownToHtml`/`githubMarkdownCssText`/`MarkdownPreview`，`export-lazy.json` 证据存在 |

**Commit 匹配**: ⚠️ 实际 commit 未按 tasks.md 预期消息格式提交（无 `feat(renderer): scaffold` 等），但功能落地完整。

---

### Wave 2 — 布局 v2 信息架构 ⚠️

| Task | 状态 | 验证依据 |
|------|------|----------|
| 2.1 顶栏 v2 | ✅ | `Toolbar.tsx` 有 ghost 图标 + 单一主按钮 (`save-btn`) + `doc-image-btn` 最左 + `theme-btn`/`export-btn`/`share-menu-btn`，`v2-modes.json` 证据 |
| 2.2 单窗三模式 | ✅ | `App.tsx` 使用 CSS display 切换 (不 remount)，`decorationsEnabled={mode === 'edit'}`，`v2-modes.json` 证据 |
| 2.3 资源区重构 | ✅ | `AssetPanel.tsx` 有 `data-testid="asset-list"` + 孤儿标记，`assets.test.ts` 存在 |
| 2.4 左栏+大纲 | ✅ | `LeftRail.tsx` 可收起 [文件|资源]，`OutlineMenu.tsx` 毛玻璃浮层，`v2-outline.json` 证据 |
| 2.5 整窗拖放 | ✅ | `App.tsx` dragover 仅 preventDefault，无 overlay 节点，`v2-dragdrop.json` 证据 (noOverlay: true) |
| 2.6 落地页重设计 | ✅ | `Landing.tsx` 有 nav/hero-slogan/format-line/featured-section/featured-card，`v2-landing.json` 证据 |
| 2.7 移动端适配 | ✅ | `LeftRail.tsx` 有 `mobile-rail-toggle`/`mobile-rail-drawer`，`Toolbar.tsx` 有 `more-menu-btn`，`v2-mobile.json` 证据 |

---

### Wave 3 — 编辑态装饰 ✅

| Task | 状态 | 验证依据 |
|------|------|----------|
| 3.1 五件装饰+IME | ✅ | `decorations/{heading,boldItalic,list,quote,code}.ts` 存在，IME guard (`composing` 标志) 实现，`decorations.test.ts` 存在 |
| 3.2 行内图片装饰 | ✅ | `decorations/image.ts` 存在，`decorations-image.test.ts` 存在 |
| 3.3 callout 卡片 | ✅ | `decorations/callout.ts` 存在，使用 `calloutTypeMap`，`decorations-callout.test.ts` 存在 |
| 3.4 三模式接入 | ✅ | `editor.ts` 使用 Compartment，`decorationsEnabled` 受控，`v2-modes.json` 证据 |

---

### Wave 4 — 多页签 + 页签会话 ⚠️

| Task | 状态 | 验证依据 |
|------|------|----------|
| 4.1 页签模型 | ✅ | `tabs.ts` 有完整字段 (id/kind/name/source/assets/mdpkgFiles/manifest/mode/scrollPos/dirty/diskHandle)，`tabs.test.ts` 存在，`v2-tabs.json` 证据 |
| 4.2 IndexedDB 会话 | ✅ | `sessionStore.ts` 存在，`sessionStore.test.ts` 存在 (QuotaExceeded 降级)，`sessionStore.json` 证据 |
| 4.3 页签条 UI | ⚠️ **部分** | `TabStrip.tsx` 基础实现存在，但**脏点指示器缺失**、**关闭确认三按钮 (save/discard/cancel) 未实现** |
| 4.4 最近文档 | ⚠️ **未接线** | `sessionStore.recentDocs` 数据层存在，但 `Landing.tsx` 最近文档 section 为**占位注释**（"4.4 接线时填充此 section，当前隐藏"） |

**关键缺口**: 
- 关闭脏页签确认框三按钮 (`tab-close-save`/`tab-close-discard`/`tab-close-cancel`) **未实现**
- 最近文档 UI **未接线**（数据层有，UI 层无）

---

### Wave 5 — FSA + 保存模型 ✅

| Task | 状态 | 验证依据 |
|------|------|----------|
| 5.1 FSA 能力层 | ✅ | `fsa.ts` 有 `isFsaAvailable`/`grantWorkspaceFolder`/`requestReGrant`，`fsa.test.ts` 存在 (17 测试)，`fsa.json` 证据 |
| 5.2 文件树 UI | ✅ | `FileTree.tsx` 存在 (递归读取/懒展开/refresh/高亮/空态/授权 CTA)，`v2-fsa-tree` 功能在 `FileTree.tsx` 中 |
| 5.3 树内操作 | ✅ | `FileTree.tsx` 有新建/重命名/删除确认/拖入复制，`delete-confirm-dialog`/`rename-dialog`/`new-item-dialog` |
| 5.4 保存模型 | ✅ | `save.ts` 有 `SaveResult` 契约 (handle/save-as/download + cancelled)，`save.test.ts` 存在，`save.json` 证据 |

---

### Wave 6 — 主题 + 分享 + 文档收口 + 回归 ⚠️

| Task | 状态 | 验证依据 |
|------|------|----------|
| 6.1 主题三态 | ✅ | `themePreference.ts` 有 matchMedia + localStorage，`themePreference.test.ts` 存在，`themes.json` 证据 |
| 6.2 邀请链接 | ✅ | `shareLink.ts` 有 `?ref=invite&by=<昵称>` (仅两参数)，`nicknames.ts` 有 `randomNickname(rng?)`，`shareLink.test.ts` 存在，`share-card.json` 证据 |
| 6.3 分享卡重构 | ✅ | `inviteShareCards.ts` 有 4 型 (横版/竖版/宣传/名片)，`pickTemplate(rng?)` 注入缝，`shareCard.test.ts` 存在，`share-templates.json` 证据 |
| 6.4 文档收口 | ⚠️ **部分** | 见下方详细分析 |
| 6.5 端到端回归 | ⚠️ **部分** | 见下方详细分析 |

#### 6.4 文档收口详细分析

| 子项 | 状态 | 验证依据 |
|------|------|----------|
| ADR-0002 移 docs/adr/ | ✅ | `docs/adr/0002-editing-paradigm-and-shared-renderer.md` 存在 |
| glossary→CONTEXT.md | ❌ **未创建** | `CONTEXT.md` 不存在，glossary 文件不存在 |
| delta spec 补齐 | ✅ | `openspec/changes/md-bundle-v2/specs/md-bundle-web/spec.md` 存在 (MODIFIED + ADDED) |
| `openspec validate --strict` 退出码 0 | ✅ | `test-results/openspec-validate.txt` 显示 "Change 'md-bundle-v2' is valid" |
| 归档同步主 spec | ❌ **未同步** | 主 spec (`openspec/specs/md-bundle-web/spec.md`) 仍为 v1 内容，无 v2 需求 (living-source/three-mode/multi-tab/FSA 等) |
| AGENTS.md 更新 | ✅ | AGENTS.md 已更新 (SSOT 条款/结构/新红线) |
| README 更新 | ✅ | README.md 已更新 (v2 新特性完整列出) |
| SEO 示例页 | ✅ | `vite.config.ts` 有 `examples/*.html` 入口，`dist/examples/` 有构建产物，`seo-crawl.json` 证据 |

#### 6.5 端到端回归详细分析

| 子项 | 状态 | 验证依据 |
|------|------|----------|
| 全量 unit test | ✅ | `.last-run.json` 显示 status: passed |
| test:e2e | ⚠️ **部分** | v2 specs 全绿 (6 个证据文件)，但 `final-walkthrough.json` 显示 REJECT (2/11 失败) |
| round-trip 零裂图 | ✅ | `roundtrip-v2.json` 显示 zeroBroken: true |
| mdpkg 保真 | ✅ | `export-roundtrip.test.ts` 存在，`export-png.e2e.spec.ts` 有 CJK/emoji 保真断言 |
| assert-bundle-budget.mjs | ❌ **未创建** | 脚本不存在，且实际构建违反预算 (见下方) |
| 降级矩阵 | ⚠️ **部分覆盖** | FSA 降级 (final-walkthrough) + QuotaExceeded (sessionStore.test) + 坏邀请参数 (shareLink.test) 有测试，但无综合 `degradation.json` 证据 |

**Bundle Budget 实际分析**:
- 入口 `index-BcLK-z8C.js`: **1.2MB** (gzip **391KB**) — ❌ 超出 300KB 预算 30%
- mdpkg-web (749KB) 在主 bundle 中 — ❌ 违反"首屏无 mdpkg-web"
- katex/mermaid 在独立 async chunk 中 — ✅ 符合"首屏无 katex/mermaid"

---

## 三、OUT 列表核对 ✅

| 限制项 | 状态 | 验证依据 |
|--------|------|----------|
| 无折叠 | ✅ | 无 code folding / collapse 实现 |
| 无块拖拽 | ✅ | 无 block drag handle / reorder 实现 |
| 无分屏 | ✅ | 无双窗格 / split pane 实现 |
| 无 Milkdown | ✅ | 无 milkdown/tip-tap/wysiwyg 依赖或代码 |
| 无皮肤 | ✅ | 无 skin/preset 系统，仅有 theme 三态 |
| 无右栏 | ✅ | 仅左栏 (LeftRail)，无 right rail/panel |
| 无系统目录预置 | ✅ | 无 Desktop/Downloads/Documents 枚举 |
| 无文档 payload 分享 | ✅ | `shareLink.ts` 仅含 `ref+by` 两参数，无 lz-string/文档字节 |
| 无遮罩 UI | ✅ | dragover 仅 preventDefault，无 overlay/mask 渲染 |
| 邀请署名仅存于 URL | ✅ | 昵称仅存在于 URL 参数，.mdpkg 包体无 byline (byline.test.ts 验证) |

---

## 四、关键发现汇总

### 🔴 未完成项（4 项）

| # | 缺口 | 严重性 | 说明 |
|---|------|--------|------|
| 1 | **脏页签关闭确认三按钮** | 高 | `tab-close-save`/`tab-close-discard`/`tab-close-cancel` 未实现，关闭脏页签无确认提示 |
| 2 | **最近文档 UI 接线** | 高 | `Landing.tsx` 最近文档 section 为占位注释，`sessionStore.recentDocs` 数据未消费 |
| 3 | **主 spec 未同步 v2 内容** | 中 | `openspec/specs/md-bundle-web/spec.md` 仍为 v1 内容，delta spec 未合并 |
| 4 | **assert-bundle-budget.mjs 未创建** | 中 | 脚本不存在，且实际构建违反预算 (入口 gzip 391KB > 300KB) |

### 🟡 证据缺失（3 项）

| # | 缺失 | 说明 |
|---|------|------|
| 1 | `v2-regression.json` | 综合回归证据未生成 |
| 2 | `bundle-budget.json` | Bundle 预算验证证据未生成 |
| 3 | `degradation.json` | 降级矩阵综合证据未生成（分散在各测试中） |

### 🟢 合规确认

- 29 个 todos 中 **25 个完全落地**
- OUT 列表 **10/10 全部合规**
- 渲染链路两条 (renderer + vendored mdpkg) 正确实现
- 共享渲染器 SSOT 正确建立
- 所有 NEVER 红线 (AGENTS.md) 均未被违反

---

## 五、建议修复优先级

1. **P0**: 实现脏页签关闭确认三按钮 (`tab-close-save`/`tab-close-discard`/`tab-close-cancel`)
2. **P0**: 接线最近文档 UI (Landing.tsx ↔ sessionStore.recentDocs)
3. **P1**: 同步 delta spec 到主 spec (`openspec/specs/md-bundle-web/spec.md`)
4. **P1**: 创建 `CONTEXT.md` 并迁移 glossary
5. **P2**: 创建 `assert-bundle-budget.mjs` 并将 mdpkg-web 移至 async chunk
6. **P2**: 生成综合回归证据文件 (v2-regression.json/bundle-budget.json/degradation.json)

---

*审计人: Sisyphus-Junior (自动化审计)*  
*审计方法: 源代码静态分析 + git 历史审查 + 构建产物验证*
