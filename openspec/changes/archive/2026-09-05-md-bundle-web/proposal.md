## Why

Markdown 分享「裂图」是高频真实痛点：把带图的 `.md` 发给别人，图片必须连带一个 assets 文件夹，路径一变图就全挂。市面上没有形成事实标准，base64 内嵌方案会让文件膨胀、git 失效。

我们要做一个纯前端网站，让用户**在线打开 / 编辑 / 导出**两种文件——原生 `.md` 和自包含包 `.mdpkg`——把「一个文件带走全部图文」做到零门槛，并让使用与分享本身成为传播渠道。上游 `jianxi-dev/mdpkg` 的浏览器端读写两侧（`openMdpkg` / `packMdpkg`）均已交付，因此本变更无外部阻塞。

## What Changes

- 新建纯前端 pnpm monorepo：`apps/web`（网站，Vite 多页）+ `packages/editor`（`@md-bundle/editor` 共享编辑器库，CodeMirror 6 起步，Web 先吃、Clairis 后接）。
- 在线打开：文件选择 + 拖拽，`.md` 进编辑器、`.mdpkg` 走 `openMdpkg`（sandbox iframe 完整预览 + 校验报告）；损坏 / 非格式文件优雅报错，无白屏。
- 编辑：源码编辑器 + 美化分屏预览 + 斜杠模板；图片**粘贴 / 拖拽 / 批量选择**三通道零摩擦导入（≤2 步、无向导无弹窗）+ 资源清单侧栏（删除/替换）。
- 保存 / 导出：**保存**（内容驱动：有图→`.mdpkg`、无图→`.md`、打开 `.mdpkg`→无缝重打包）+ **导出**（格式驱动：`.md` / `.mdpkg` / HTML / PNG 长图；导出 `.md` 含图时丢图警告）。`.mdpkg` 写侧复用上游 `packMdpkg`，保证与 CLI 字节一致。
- 首页 hero（宣传语「分享 Markdown，不再裂图。」/ Logo / 宣传图）+ SEO 多页（landing + `/spec` + `/about` 静态可爬 + robots/sitemap/OG/JSON-LD/canonical）。
- 分享传播：Made-with byline（HTML 页脚 + PNG 角落 + 分享卡）+ 分享卡「复制为图片」+ localStorage 阶梯徽章（Common/Rare/Epic/Legendary，触发于完成瞬间）。
- 部署：Vercel 静态站 + `bundle.jianxi.me`。

## Capabilities

### New Capabilities
- `md-bundle-web`: 在线打开 / 编辑 / 导出 `.md` 与 `.mdpkg` 的纯前端网站能力——含文件打开、编辑器与图片导入、保存/导出、首页 hero、SEO 多页、分享传播、本地徽章与部署。

### Modified Capabilities
<!-- 无既有 spec 变更；本仓库 openspec/specs/ 尚无既有能力。 -->

## Impact

- **无后端 / 无账号**（Phase 1 纯前端，徽章存 localStorage）；账号 / 云端 / 分享链接留 Phase 2。
- **依赖** `jianxi-dev/mdpkg` 的读侧 `openMdpkg` + 写侧 `packMdpkg`（均已交付），在 `apps/web` vendor `mdpkg-web.js`。
- **复用** 桌面产品 Clairis 的 CodeMirror 6 编辑器（抽共享库 `@md-bundle/editor`）。
- 部署目标：Vercel 静态站 + `bundle.jianxi.me`。

完整决策与任务清单见 `.omo/decisions.md` 与 `.omo/plans/md-bundle-web.md`。
