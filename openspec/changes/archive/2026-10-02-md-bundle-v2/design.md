## Context

- v1（`md-bundle-web`）已全量上线并归档：单页签 + 分屏预览 + 右栏资源 + mdpkg sandbox iframe 预览 + 内容驱动「保存」=下载。
- 生态：格式 `mdpkg`（`jianxi-dev/mdpkg`，上游 vendored `apps/web/vendor/mdpkg-web.js`，**零改动**）；桌面 **Clairis**（`lqtdys/clairis`，`feat/p0-improvements` 分支 v0.4.0）为渲染管线与编辑装饰的**只读参考源**；网页产品 MD-Bundle 与二者同属 渐晰(Jianxi) 品牌，域名 `bundle.jianxi.me`。
- 当前仓库：pnpm monorepo（`apps/web` Vite+React18+TS strict + `packages/editor` CM6 共享库）；GitHub Pages + Vercel 双部署；CI 全绿。
- 完整决策链 #18–#52 见 `.omo/decisions.md`，定稿计划 `.omo/plans/md-bundle-v2.md`（29 todos × 6 waves + F1–F4）为实施细节的权威来源；本 design 是其 OpenSpec 侧压缩。

## Goals / Non-Goals

**Goals:**
- 编辑所见即所得：Typora 式「活的源码」——CM6 装饰（标题/加粗斜体/列表/引用/行内码/行内图/callout），底层永远 Markdown 源码，光标进入露回源码，IME 合成不闪断。
- 渲染管线统一为共享 `@md-bundle/renderer`：.md 实时预览 / HTML 导出 / PNG 长图同一渲染源；DOMPurify 为唯一消毒 SSOT；渲染链路收敛为两条（renderer + vendored mdpkg 仅导出保真）。
- 信息架构 v2：三模式整窗工作区 + 可折叠左栏 [文件|资源] + 工作区右上毛玻璃大纲浮层 + 整窗拖放直达（无遮罩）+ 顶栏 ghost 图标动作区 + 单一保存/下载主按钮。
- 多页签会话：IndexedDB 自动保存 + 刷新全量恢复 + 无上限 + 脏点 + 关闭确认三分支 + 最近文档。
- FSA 文件夹工作区（仅 Chromium，渐进增强）＋ 三层保存模型；无 FSA = v1 等价体验全程可用。
- 主题三态 + 营销面（落地页重设计、精选作品、SEO 示例页）+ 分享=网站（邀请链接 + 4 型邀请卡 + 文档复制卡归位）。

**Non-Goals:**
- 标题折叠、块拖拽重排（大纲只导航）、分屏、Milkdown/TipTap 块模型、clairis 阅读器镀铬（皮肤/缩放/宽度滑杆/墨线）、PDF/视频/HTML 预览、编辑态表格即时渲染。
- 常设资源右栏；预置系统目录（浏览器禁止枚举桌面/下载/文档）；页签上限软提醒；拖拽遮罩/中间态 UI。
- 分享内容带文档 payload 或任何服务端存储；第三方分析/后端/账号；修改 vendored 引擎、mdpkg manifest schema、向 `.mdpkg` 字节注入品牌。

## Decisions

1. **渲染管线抽取为 `packages/renderer`**（clairis `renderers/*` + `reader.css` 移植）。Barrel 契约四运行时导出 + 编译期类型探针：`renderMarkdown(md, opts?)`（纯函数永不抛，单特征降级）、`readerCssText`（`[data-theme]` 深/浅双块）、`calloutTypeMap`（22 键快照钉住 clairis 源——实施核实 clairis `CALLOUT_LABELS` 实为 22 键，早前文档「23 键」为错误计数，以源为准）、`hydrateLazyFeatures(root, theme)`（永远 resolve）。`{error}` 结果对象仅用于异步/IO 边界。编辑态装饰依赖此包（`workspace:*`）。替代 editor `renderMarkdownToHtml` / `githubMarkdownCssText` / `MarkdownPreview`（preview.tsx 下线、barrel 收缩、依赖移除）。
2. **导出异步水合路径**：buildHtmlDocument/exportPng 构建为 async——`renderMarkdown` → 游离 DOM 根 → `await hydrateLazyFeatures` → 序列化；KaTeX 字体条件内联（woff2 子集，无公式零体积）；foreignObject 降级兜底（QA 强制断言）。导出与预览同源。
3. **编辑范式 = 活的源码（CM6 Compartment）**：`editorDecorations()` 聚合五件 + `decorations/image.ts` + `decorations/callout.ts`；clairis `composition.ts` 是 TODO 空壳**不移植**——各 ViewPlugin 在 `view.composing===true` 时跳过重算、compositionend 追平；App 模式状态机 → compartment reconfigure（编辑=开/源码=关），切换不 remount、undo 保留。
4. **布局 v2 铬框**：顶栏 48px 动作区排序定稿（右起：主题◐ 最右 → 分享 → 导出▾ → 保存单主按钮 → 复制正文为图片最左）；模式切换 ghost 图标（铅笔/代码/眼睛）；大纲不在顶栏（工作区内容面板右上，三模式可见，手机端同位不压页签条）；页签条 36px；左栏 260px [文件|资源] 默认收起（资源孤儿徽标点）。撤常设右栏（`AssetList.tsx` → 左栏 `AssetPanel.tsx`，容器兼容 `data-testid="asset-list"`）。
5. **保存模型三层 + 单一主按钮**（唯一规则无歧义）：自动保存（IndexedDB 草稿，静默）→ ①页签持 diskHandle → 「保存」=`createWritable` 真写回 + toast + 清脏；②无句柄有 FSA → 「保存」=`showSaveFilePicker` 另存为（扩展名内容驱动）+ 记句柄；③无 FSA → **同一主按钮位显示「下载」**。「下载副本」菜单项只进导出▾。用户取消另存为 = 静默 `{ok:false,error:'cancelled'}` 不弹错、脏点保持。脏点=未保存到磁盘。统一 `SaveResult` 契约，IO 边界永不向上抛。
6. **FSA 能力层**：`isFsaAvailable()` 需三项 picker 同时存在（`showDirectoryPicker`/`showSaveFilePicker`/`showOpenFilePicker`）；句柄 structured-clone 存 IndexedDB；续权 `requestPermission` 拒权 → `{error:'permission-denied'}` + 树隐藏 + 提示；不预置系统目录。无 FSA 环境能力检测为假即整体隐藏。Playwright 一律 `addInitScript` 注入/删除三项 picker fake handle，**filechooser 拦截仅用于真实 `<input type=file>`**（打开文件/导入图片）。
7. **整窗拖放直达（无遮罩）**：全窗口（含落地页）drop 分流——.md/.mdpkg → 立即新页签；编辑器 DOM 内图片 → 既有导入；编辑器外无活动页签拖图 → 提示先开文档；文件树文件夹 drop → 复制。`dragover` 仅 preventDefault，不渲染任何覆盖 UI。
8. **分享对象 = 网站（推翻 #36/#37 文档分享语义）**：邀请链接 `?ref=invite&by=<随机昵称>`——无文档 payload（lz-string/6KB/解码全废弃）；昵称于复制动作发生时由 `randomNickname(rng?)` 生成并写入 URL（链接内持久=邀请署名；服务端零存储）。落地页检测 `ref=invite` → InviteView（昵称为视觉主角 + 卖点 + 产品图 + CTA 预载演示文档 + **显著展示 `bundle.jianxi.me`**）。坏参数 → 忽略回普通落地页。
9. **分享卡两模块拆分**：`inviteShareCards.ts`（4 种构图本质不同的邀请卡型——横版作品卡/竖版金句卡/网站宣传卡/极简名片卡；统一数据源=网站邀请文案+随机昵称+固定静态资产，不经 renderer、不读当前文档；每型 ≥2 底色方案；`pickTemplate(rng?)` 随机卡型+底色；含网站 URL 文本 + 渐晰品牌）与 `docShareCard.ts`（文档「复制正文为图片」——消费当前文档经 renderer、byline 含 URL+品牌、ClipboardItem/下载回退、**无文档禁用**、归位顶栏最左图标按钮）。分享菜单 = [复制邀请链接 / 邀请卡▾（当前卡型名 + 换一款）]。
10. **渲染链路两条**：renderer（预览/HTML/PNG/正文复制卡）+ vendored mdpkg 包渲染（仅导出保真）。editor 自写消毒器下线；「复制正文为图片」保留 v1 原链路语义。
11. **多页签会话**：tabs store（含 mode/scrollPos/dirty/diskHandle）；IndexedDB 防抖 500ms 自动写；启动静默恢复；配额失败降级内存 + toast 不崩。关闭脏页签确认框三按钮（`tab-close-save`/`tab-close-discard`/`tab-close-cancel`，文案「草稿留在最近文档」）。
12. **SEO 示例页**：示例内容以 `examples/*.ts` 源数据存在，Vite `rollupOptions.input` 增 `examples/*.html`；正文静态渲染（KaTeX 预渲染内联、mermaid 不进静态正文 → 「在编辑器打开」CTA）；并入 sitemap。
13. **主题三态**：`matchMedia` + localStorage `md-bundle.theme`（坏值回退 system）；reader 深/浅双套；正文对比度 ≥4.5:1；分享卡/导出取当前主题。视觉皮留 MD-Bundle（深色 + #165DFF），哲学借 clairis（最少干扰、减法优先、操作即结果、破坏性操作可逆）。
14. **移动端**：<768px 左栏 → 底部抽屉（横放鸡蛋形小图标钮）；大纲同位不压页签条；窄屏开文档默认 preview；动作区折叠入 more 溢出菜单（排序同桌面右起）。

## Risks / Trade-offs

- [FSA 仅 Chromium] → 降级路线全程可用：无 FSA = 主按钮显示下载 + 无文件树 + 大纲不受影响；Playwright 双矩阵（注入三项/删除三项）断言。
- [导出水合引入异步竞态 / KaTeX 字体] → render→游离 DOM→await hydrate→序列化；字体条件内联（无公式零体积）；foreignObject 降级兜底；QA 断言 `class="katex"` + mermaid svg + 字体 dataURI。
- [IndexedDB 配额] → 写失败 `{error}` + toast，降级内存，永不崩溃。
- [随机昵称/分享卡随机不可测] → `randomNickname(rng?)`/`pickTemplate(rng?)` 注入缝，词库/配色族种子断言。
- [clairis 源漂移] → 逐文件映射移植（commit body 记来源路径与改动），键集合/装饰行为以源实际为准并在 commit 注明偏差；渲染器与装饰 API 与 clairis 同形以便反哺。
- [大重构回归 v1] → 既有 e2e 按新 UI 更新选择器（行为断言不变）、兼容 testid（`asset-list`）保留下多数零改动；round-trip 零裂图 + mdpkg 保真 + bundle 哨兵（首屏无 katex/mermaid/mdpkg chunk、入口 gzip ≤300KB）护航。

## Migration Plan

- 无外部系统迁移；纯前端演进。openspec `changes/md-bundle-v2` 骨架（本目录）为 todo 6 硬前置；`validate --strict` 为 todo 28 交付门槛（delta 场景补齐后归档，同步主 spec）。
- 分 wave 合入：Wave 1 renderer 抽取与切换 → Wave 2 布局 v2 信息架构 → Wave 3 编辑装饰 → Wave 4 多页签会话 → Wave 5 FSA+保存模型 → Wave 6 主题/分享/文档收口/回归。每 todo 一次 atomic commit，wave 结束全绿才 push；证据随 commit。
- 回滚：Vercel/GH Pages 回退上一发布；无服务端数据面（徽章/主题/草稿均在浏览器本地）。

## Open Questions

- 无阻塞项。上线后视数据再议（Phase 2 候选：账号/云端/自动文件树变更监听）均不在本变更范围。
