## 1. Wave 1 — @md-bundle/renderer 抽取与切换

- [x] 1.1 新建 `packages/renderer` 包骨架（barrel 契约：renderMarkdown / readerCssText / calloutTypeMap / hydrateLazyFeatures + RenderOptions 编译期探针；deps marked/dompurify/katex/mermaid/@lezer/highlight）。QA: `pnpm --filter @md-bundle/renderer test` public-api 断言。Commit: `feat(renderer): scaffold @md-bundle/renderer package`
- [x] 1.2 核心渲染管线移植（clairis markdown.ts → renderer；marked+DOMPurify+callout 键快照+CJK+frontmatter+figure）。QA: rich fixture + 注入用例（script/onerror/javascript:/iframe 全剥）。Commit: `feat(renderer): core marked+DOMPurify pipeline`
- [x] 1.3 KaTeX + mermaid + lezer 高亮（懒加载分包，20k FIFO）+ `hydrateLazyFeatures(root, theme)` 永远 resolve。QA: jsdom hydrate；坏输入降级零抛错。Commit: `feat(renderer): KaTeX + mermaid + highlight (lazy)`
- [x] 1.4 排版骨架深/浅双主题（`readerCssText`，`[data-theme]` 双块；对比度 ≥4.5:1 双主题）。QA: theme.test.ts。Commit: `feat(renderer): reader typography (dark/light)`
- [x] 1.5 apps/web 切换共享渲染器 + 旧渲染器下线：`renderMarkdownToHtml`→`renderMarkdown`、`githubMarkdownCssText`→`readerCssText`、MarkdownPreview→PreviewView(+hydrate)；editor preview.tsx 删除/barrel 收缩/deps 移除；分享拆两链路（①正文复制卡保留 v1 链路归位顶栏最左 `doc-image-btn` ②邀请卡不经 renderer）；导出异步水合（render→游离 DOM→hydrate→序列化；KaTeX 字体条件内联；foreignObject 兜底）。QA: grep 零残留 + round-trip/export-lazy 断言（katex/mermaid svg/字体 dataURI）。Commit: `feat: switch web preview/export to @md-bundle/renderer`

## 2. Wave 2 — 布局 v2 信息架构

- [x] 2.1 顶栏 v2：ghost 图标动作区（默认淡/hover 提亮）+ 右起排序定稿 主题◐→分享→导出▾→保存主按钮→复制正文为图片最左 + 三模式 ghost 图标 + 单一主按钮三态 + 按动作分禁用组（无文档：文档类 disabled、邀请类 enabled）。前置硬依赖：本 openspec change 骨架存在。QA: `v2-modes.spec.ts` + save.e2e 更新。Commit: `feat: top chrome bar v2 (ghost icons, single primary save/download)`
- [x] 2.2 单窗三模式工作区（编辑/源码/预览；CSS display 切换不 remount；预览=PreviewView 居中 800px）。QA: `v2-modes.spec.ts`（undo 保留 + 连切 0 pageerror）。Commit: `feat: single-pane three-mode workspace`
- [x] 2.3 资源区重构：撤常设右栏 → 左栏「资源」页签（`AssetPanel.tsx` 容器兼容 `data-testid="asset-list"`；lib/assets.ts 孤儿计算：导入未引用/mdpkg 包内未引用；批量导入；替换/删除复用既有逻辑）。QA: assets 单测 + 既有四 spec 回归。Commit: `feat: asset management to left-rail tab (orphan marking)`
- [x] 2.4 左栏 [文件|资源]（默认收起，资源孤儿徽标）+ 大纲悬停弹层 `OutlineMenu.tsx`（工作区内容面板右上 ghost 按钮 `outline-btn`；毛玻璃浮层 backdrop-blur + 层级竖线 + 当前标题主色左边条；hover 弹/click 钉/Esc 收；code-fence aware 解析；编辑/源码=文本解析、预览=DOM；键盘可达）。QA: `v2-outline.spec.ts`。Commit: `feat: collapsible left rail (files|assets) + hover outline`
- [x] 2.5 整窗拖放直达（无遮罩）：全窗口 drop 分流 .md/.mdpkg→新页签 / 编辑器内图片→导入 / 无文档拖图提示 / 文件树文件夹拖入=复制；dragover 仅 preventDefault。QA: `v2-dragdrop.spec.ts`（四场景 + DOM 无 overlay 节点）。Commit: `feat: whole-window direct drop (no overlay)`
- [x] 2.6 落地页重设计 + 精选作品：Landing.tsx 重写（细导航/双行 hero+格式范围标注行+产品主视觉/双 CTA/三价值徽标/最近文档接线/页脚）+ 3 个示例文档源数据 `examples/*.ts` + 真渲染缩略卡片。QA: `v2-landing.spec.ts` + home.spec 更新。Commit: `feat: landing redesign + featured works (demo content)`
- [x] 2.7 移动端适配：<768px 左栏→底部抽屉（横放鸡蛋形钮）/大纲同位不压页签条/窄屏默认 preview/动作区 more 溢出菜单（排序同桌面右起）。QA: `v2-mobile.spec.ts`（375×812 + 1280 回归）。Commit: `feat: mobile responsive (rail drawer, tap outline, preview-first)`

## 3. Wave 3 — 编辑态装饰（活的源码）

- [x] 3.1 clairis 五件装饰移植 + IME 守卫：decorations/{heading,boldItalic,list,quote,code}.ts（composition.ts 空壳不移植 → `view.composing===true` 跳过、compositionend 追平）；`editorDecorations()` 聚合；光标进入露源码；public-api 更新。QA: decorations.test.ts（widget + doc 值不变）。Commit: `feat(editor): living-source decorations (5 + IME guard)`
- [x] 3.2 行内图片装饰 + 悬停操作：decorations/image.ts（ImageWidget + resolver 注入缝：assets→mdpkg files→null 降级文本；替换/删除/在资源页签定位）。QA: decorations-image.test.ts。Commit: `feat(editor): inline image decoration with hover ops`
- [x] 3.3 callout 卡片装饰：decorations/callout.ts（类型色调=renderer calloutTypeMap；非法 [!FOO] 降级普通文本）。QA: decorations-callout.test.ts。Commit: `feat(editor): callout card decoration`
- [x] 3.4 三模式接入装饰（Compartment 切换：createMarkdownEditor decorationsEnabled 受控；编辑=开/源码=关；斜杠/图片三通道回归）。QA: v2-modes 追加 + import.spec 粘贴断言。Commit: `feat: wire decorations via CM6 compartments`

## 4. Wave 4 — 多页签 + 页签会话

- [x] 4.1 页签模型重构 `lib/tabs.ts`（id/kind/name/source/assets/mdpkgFiles?/manifest?/mode/scrollPos/dirty/diskHandle?）；打开=新页签永不静默替换；useDocument 并入。QA: `v2-tabs.spec.ts`。Commit: `feat: multi-tab document model`
- [x] 4.2 IndexedDB 页签会话 `lib/sessionStore.ts`（tabs+activeId+recentDocs+FSA 句柄；编辑防抖 500ms；启动静默恢复；配额失败 `{error}`+toast 降级）。QA: v2-tabs reload 恢复 + sessionStore 单测（round-trip + QuotaExceeded）。Commit: `feat: IndexedDB session persistence`
- [x] 4.3 页签条 UI `TabStrip.tsx`（脏点/关闭确认三按钮 `tab-close-save|discard|cancel`（save 分支 todo 24 前=下载）/溢出滚动/不绑 Cmd+W/T）。QA: v2-tabs（脏点/三分支/20 页签滚动/跨 todo：点 save→mock picker 取消→仍打开）。Commit: `feat: tab strip (dirty, close-confirm w/ save, overflow)`
- [x] 4.4 最近文档接线（Landing ← sessionStore.recentDocs；关闭保留条目；点击恢复；坏条目跳过）。QA: v2-landing + sessionStore 坏条目。Commit: `feat: recent docs restore`

## 5. Wave 5 — FSA 文件工作区 + 保存模型

- [x] 5.1 FSA 能力层 `lib/fsa.ts`：isFsaAvailable（三项 picker 齐备）/grantWorkspaceFolder/句柄 IndexedDB 持久化/requestReGrant 续权（拒权→`{error:'permission-denied'}`）/降级隐藏；全部 `{ok}|{error}` 不抛。QA: fsa.test.ts mock 句柄 + addInitScript 删除三 picker 断言能力为假。Commit: `feat: FSA capability layer (pick/grants/grants persistence)`
- [x] 5.2 文件树 UI `FileTree.tsx`（左栏文件页签填充：递归读取只列 .md/.mdpkg/文件夹、懒展开、refresh 手动重扫、点击新页签持 file handle、当前文档高亮、空态+授权 CTA）。QA: `v2-fsa-tree.spec.ts`（addInitScript 注入三 picker fake handle；不用 filechooser）。Commit: `feat: file tree (left rail, lazy, open-with-handle)`
- [x] 5.3 树内操作：新建（文件/文件夹）/重命名（新名句柄+复制+删旧）/删除确认（不可逆文案，.mdpkg 同）/拖文件入文件夹=复制；失败 `{error}` toast。QA: v2-fsa-tree.spec.ts 各操作 + 确认框分支。Commit: `feat: file-tree ops (new/rename/delete-confirm/copy-drop)`
- [x] 5.4 保存模型落地 `lib/save.ts` 重构：统一 `Promise<SaveResult>`（`{ok:true;kind;via:'handle'|'save-as'|'download'}|{ok:false;error}` 永不抛）；唯一主按钮三路径（写回/另存为/下载）+ 取消=静默 `'cancelled'` + 「下载副本」只进导出▾。QA: `v2-save.spec.ts`（addInitScript 覆写 showSaveFilePicker/file handle/删除三项）+ save.e2e 分流回归。Commit: `feat: single-primary save/download button + export copy`

## 6. Wave 6 — 主题 + 分享 + 文档收口 + 回归

- [x] 6.1 主题三态 `lib/themePreference.ts`（matchMedia + localStorage `md-bundle.theme` 坏值回退）+ shareCard `_theme` 参数 + CARD_COLORS 随主题。QA: `v2-theme.spec.ts`（emulateMedia + reload 保持 + 分享卡双主题像素）。Commit: `feat: theme tri-state incl. share-card theming`
- [x] 6.2 网站邀请链接 `lib/shareLink.ts` + `lib/nicknames.ts`：`?ref=invite&by=<昵称>` 无文档 payload；randomNickname(rng?) 可注入；落地页 InviteView（昵称视觉主角 + 网址显著展示 + CTA 预载演示文档）；坏参数忽略回普通落地页。QA: shareLink.test + `v2-share.spec.ts`。Commit: `feat: website invite link + random invite nickname`
- [x] 6.3 分享卡重构：`inviteShareCards.ts`（4 型构图互异：横版作品卡/竖版金句卡/网站宣传卡/极简名片卡；每型 ≥2 底色方案；pickTemplate(rng?) 随机卡型+底色；含网站 URL+渐晰品牌；无文档可用；连点换款）+ `docShareCard.ts`（顶栏最左按钮；渲染当前正文 + byline URL+品牌 + 无文档禁用）；分享菜单接线（todo 2.1）；静态资产入 public/share-assets。QA: shareCard.test（4 型×PNG magic/种子/构图差异/URL+品牌/底色族/无文档）+ v2-share。Commit: `feat: 4 randomized share-card templates`
- [x] 6.4 文档收口【交付硬门槛】：ADR-0002 移 docs/adr/；glossary→CONTEXT.md；本 change delta 补齐（与 `openspec/specs/md-bundle-web/spec.md` 现有 requirement 标题逐项对应 MODIFIED/ADDED）+ `npx openspec validate md-bundle-v2 --strict` 退出码 0 + 归档同步主 spec；AGENTS.md（SSOT 条款/结构/新红线）/README 更新；SEO 示例页（Vite MPA `rollupOptions.input` 增 `examples/*.html`，正文静态可爬 + 公式 KaTeX 预渲染内联 + mermaid 不进静态正文）。QA: validate 输出存 test-results + `seo-crawl.spec.ts` 扩展。Commit: `docs: ADR-0002 + openspec v2 + agent docs + SEO example pages`
- [x] 6.5 端到端回归：全量 `pnpm --filter @md-bundle/web test` + `test:e2e`（既有 spec 按新 UI 更新选择器，行为断言不变）+ v2 spec 全绿 + round-trip 零裂图 + mdpkg 保真 + `assert-bundle-budget.mjs`（首屏无 katex/mermaid/mdpkg-web、async chunk 在、入口 gzip ≤300KB）+ 降级矩阵（无 FSA / 无 IndexedDB / 坏邀请参数）。QA: v2-regression.json + bundle-budget.json + degradation.json。Commit: `test: v2 regression evidence + bundle budget + degradation`

## 7. Final verification wave

- [ ] 7.1 计划符合性审计：29 todos 逐条 References/Acceptance/QA/Commit 落地；OUT 核对（无折叠/无块拖拽/无分屏/无 Milkdown/无皮肤/无右栏/无系统目录预置/无文档 payload 分享/无遮罩 UI/邀请署名仅存于 URL）。
- [ ] 7.2 代码质量：typecheck/lint 0；无 as any/ts-ignore/TODO；两包 public-api 快照；随机函数注入缝抽查。
- [ ] 7.3 真机手动 QA：开页签→编辑装饰→右上大纲浮层跳转→拖入文件直达新页签→授权文件夹（Chromium）→树内打开→单一主按钮保存写回→刷新恢复→关闭脏页签三分支→邀请链接跨浏览器打开 InviteView 署名 + CTA 预载演示文档→分享卡四种卡型随机→主题切换。截图留证。
- [ ] 7.4 范围忠实度：vendor 零改动；fixture 无品牌串；渲染链路两条；降级验证（Firefox/无 FSA 环境跑主流程 v1 等价 + 全部功能无白屏）。
