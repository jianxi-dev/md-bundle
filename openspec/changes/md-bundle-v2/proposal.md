## Why

v1（`md-bundle-web`）已全量上线并归档（2026-09-05）。v2 针对四个升级诉求：**编辑所见即所得**（Typora 式「活的源码」——CM6 装饰，底层永远 Markdown 源码）、**预览渲染管线统一**（clairis 渲染管线抽取为共享 `@md-bundle/renderer`，.md 实时预览 / HTML 导出 / PNG 长图同源）、**信息架构与保存模型重构**（三模式工作区 + 多页签会话 + FSA 文件夹工作区 + 三层保存模型）、**营销与分享面升级**（落地页重设计 + 精选作品与 SEO 示例页 + 分享对象=网站的邀请链接与 4 种邀请分享卡）。

## What Changes

- 新建共享渲染包 `packages/renderer`（`@md-bundle/renderer`）：从 clairis 抽取 marked+DOMPurify / KaTeX / mermaid（懒加载）/ lezer 高亮 / 23 键 callout / CJK 间距 / frontmatter / figure 的渲染管线，DOMPurify 成为唯一消毒 SSOT；`.md` 实时预览、HTML 导出、PNG 长图收敛到该管线（编辑态自写消毒器下线）。
- **BREAKING** `.mdpkg` 预览语义变更：sandboxed iframe 参照预览取消，改为共享渲染器实时预览（随编辑刷新）；校验报告面板 → 顶栏横幅 + 左栏资源页签。
- 编辑器「活的源码」装饰：移植 clairis 五件（标题/加粗斜体/列表/引用/行内码）+ 行内图片（悬停替换/删除）+ callout 卡片；光标进入露回源码；IME 合成期不闪断。
- 布局 v2 铬框：顶栏 48px（品牌 + 三模式 ghost 图标 + ghost 图标动作区 + **单一保存/下载主按钮** + 导出▾）+ 页签条 36px + 单窗三模式工作区 + **可折叠左栏 [文件 | 资源]**（默认收起）+ mdpkg 校验横幅 + **工作区右上角大纲毛玻璃浮层**。撤常设资源右栏。
- 整窗拖放直达（无拖拽遮罩）：任意处 drop `.md`/`.mdpkg` = 立即新页签；编辑器内拖图 = 图片导入；文件树拖入 = 复制。
- 多页签 + 会话持久化：IndexedDB 自动保存（防抖 500ms）+ 刷新全量恢复 + 无上限 + 脏点 + 关闭确认三分支 + 最近文档。
- FSA 文件夹工作区（**仅 Chromium 渐进增强**，无 FSA = v1 体验全程可用）：目录授权 + 句柄持久化 + 一键续权 + 文件树（打开/新建/重命名/删除确认/拖入复制）+ 树内打开持写句柄供保存回写。
- 三层保存模型：自动保存（IndexedDB 草稿）→ **顶栏单一主按钮**（持句柄=真写回 / 未另存=另存为 / 无 FSA=同一位显示下载）→ 独立的「下载副本」只进导出▾。格式内容驱动不变。
- 主题三态（跟随系统/深/浅，localStorage）；分享卡配色随主题。
- 分享全面重设计（**分享对象=网站，不是文档**）：网站邀请链接 `?ref=invite&by=<随机昵称>`（无文档 payload、服务端零存储）+ InviteView 落地页变体；**4 种构图本质不同的邀请分享卡**（横版作品卡/竖版金句卡/网站宣传卡/极简名片卡，多底色随机）+ 随机昵称注入缝可测；v1「复制正文为图片」保留并归位顶栏动作区最左独立图标按钮（无文档禁用）。
- 落地页重设计：细导航 + hero（双行 slogan + 格式范围标注行 + 产品实拍式主视觉 + 双 CTA + 三价值徽标）+ 最近文档 + 精选作品（3 个演示文档真渲染缩略卡片）+ 页脚；每示例生成静态可爬 SEO 页。
- 移动端适配（<768px）：左栏底部抽屉（横放鸡蛋形钮）、大纲右上同位不压页签条、窄屏默认预览、溢出菜单。

## Capabilities

### New Capabilities
<!-- 本变更不引入新能力域；所有需求变更归属既有 md-bundle-web 能力。 -->

### Modified Capabilities
- `md-bundle-web`: 六个既有 REQUIREMENT 行为变更（打开/编辑/校验报告/首页 hero/内容驱动保存/byline+复制为图片）+ 十五个新 REQUIREMENT（共享渲染器、活的源码装饰、三模式、多页签会话、最近文档、悬停大纲、左栏资源清单、整窗拖放、FSA 文件夹工作区、三层保存模型、网站邀请链接、邀请分享卡、主题三态、移动端、SEO 示例页）。v1 其余需求（图片三通道导入、格式驱动导出、HTML/PNG 导出、本地徽章、SEO 三页、静态部署）行为不变。

## Impact

- **代码**：`packages/renderer`（新包，barrel 契约 `renderMarkdown`/`readerCssText`/`calloutTypeMap`/`hydrateLazyFeatures` + `RenderOptions`）；`apps/web` 大面积重构（TopBar v2、TabStrip、LeftRail、OutlineMenu、PreviewView、FileTree、lib/{fsa,sessionStore,shareLink,nicknames,inviteShareCards,docShareCard,themePreference}.ts、Landing 重写、examples 源数据、SEO 示例页 Vite 多页入口）；`packages/editor` 增装饰（decorations/{heading,boldItalic,list,quote,code,image,callout}.ts），public-api 收缩（preview.tsx 下线、github-markdown-css 依赖移除）。
- **外部只读参考源**：`/Users/mason/ToHighs/clairis`（remote `lqtdys/clairis`，分支 `feat/p0-improvements`，v0.4.0）——渲染器与装饰逐文件移植对齐，commit body 记来源路径与改动。
- **依赖**：renderer 新增 marked/dompurify/katex/mermaid/@lezer/highlight + @types/dompurify；`@codemirror/lang-*` 复用。vendored `mdpkg-web.js` **零改动**（上游产物，仅导出保真）。
- **部署**：维持 GitHub Pages + Vercel 双部署；无后端、无账号、无服务端存储（邀请链接仅 URL 参数）。
- **红线**：不改 mdpkg manifest schema、不向 `.mdpkg` 字节注入品牌、无第三条渲染链路、无拖拽遮罩中间态 UI、不预置系统目录。
