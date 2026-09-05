## Context

- 生态三件套：格式 `mdpkg`（`jianxi-dev/mdpkg`，规范 + CLI）、网页产品 **MD-Bundle**（本仓库，域名 `bundle.jianxi.me`）、桌面 **Clairis**（`lqtdys/clairis`）；三者同属 渐晰(Jianxi) 品牌。
- 已核实：`mdpkg-web` 浏览器端读写两侧均已交付——`openMdpkg`（读）+ `packMdpkg`（写，内部重建 manifest 并重算 sha256）；manifest schema 为 `additionalProperties:false`（封闭，不可本地加字段）；Clairis = Tauri2 + React + CodeMirror 6，编辑器尚未抽库。
- 旧 base64 `@md-bundle` 注释块方案已废弃，不作起点代码。
- 当前仓库仅有 README 与规划文档，无产品代码。

## Goals / Non-Goals

**Goals:**
- 纯前端在线工具：打开 / 编辑 / 导出 `.md` 与 `.mdpkg`；图片粘贴 / 拖拽 / 批量选择零摩擦导入（≤2 步、无向导无弹窗）。
- 保存内容驱动（有图→`.mdpkg`、无图→`.md`、`.mdpkg`→无缝重打包）、导出格式驱动（`.md` / `.mdpkg` / HTML / PNG 长图），HTML 导出图片 data URI 内联、零裂图。
- 首页 hero + SEO 多页静态产物（landing + `/spec` + `/about`），分享传播：Made-with byline + 分享卡「复制为图片」+ localStorage 阶梯徽章。
- 共享编辑器库 `@md-bundle/editor` 抽离，Web 先吃、Clairis 后接。

**Non-Goals:**
- 后端 / 账号 / 云端存储 / 分享链接 / 成就持久化（Phase 2）。
- 纯 WYSIWYG（milkdown/TipTap）、用户投稿 UGC 墙（`/gallery` 只放官方示例）、私有 markdown 语法（结构组件仅 `> [!NOTE]` 等标准降级 callout）、完整 i18n。
- 修改 mdpkg manifest schema（封闭结构）、在 `.mdpkg` 文件本体塞品牌信息、第三方分析脚本。

## Decisions

1. **技术栈：Vite + React 18 + TypeScript strict + Tailwind**（pnpm workspaces：`apps/web` + `packages/editor`；Vitest + Playwright + ESLint/Prettier + GitHub Actions CI）。依据决策 #8。备选（Next.js 静态导出）被否——纯静态多页无 SSR 诉求，Vite 更轻、与上游 ESM 源码契合。
2. **编辑器形态：CodeMirror 6 源码编辑（源文件即真相）+ 美化分屏预览 + 斜杠模板**。备选 milkdown 纯 WYSIWYG 留 Phase 2。预览渲染 marked + github-markdown-css 基座 + 主题 token；图片 `ref:`/路径解析交由上层（apps/web）。
3. **保存 / 导出二分**：「保存」= 内容驱动（含图→`.mdpkg`、无图→`.md`、打开 `.mdpkg`→`.mdpkg`）；「导出」下拉 = 格式驱动（4 格式显式选）；导出 `.md` 含图时先警告「图片将丢失」。依据决策 #16。
4. **`.mdpkg` 写侧复用上游 `packMdpkg(files, manifest)`**，不写本地 zip 垫片。理由：自造 fflate 垫片会重复实现 pack() 的固定 mtime / 路径排序 / STORE 级别，存在与 CLI 字节不一致风险；复用保证「编辑→重打包→再打开」往返等价且与 CLI pack 字节一致。依据决策 #15。
5. **PNG 长图渲染：SVG `foreignObject` 原生文本渲染 + canvas 栅格化**，不使用 html2canvas。理由：规避 CJK/emoji tofu。
6. **SEO：Vite 多页构建（真多页静态产物），非 SPA 客户端路由**（`build.rollupOptions.input: { index, spec, about }`）。理由：解决 SPA vs SEO 矛盾，三页内容静态可爬。robots.txt / sitemap.xml / OG 1200×630 / JSON-LD `SoftwareApplication` / canonical 齐全。
7. **分享 / 徽章**：Made-with byline 只出现在导出 HTML 页脚 + PNG 角落 + 分享卡，`.mdpkg` 文件本体保持干净；主分享动作 = 分享卡「复制为图片」（`navigator.clipboard.write`，失败回退下载）；徽章 = localStorage 阶梯 + 稀有度（Common/Rare/Epic/Legendary），触发于完成瞬间（首次保存 `.mdpkg` / 首次导出 PNG / 第 N 次导出），非注册/进入时。依据决策 #6/#7。
8. **模块 seam**：编辑器 + markdown→HTML 渲染器 + 主题 token 在共享库 `packages/editor`；HTML 文档组装 / PNG 长图 / 分享卡在 `apps/web`（可被 Playwright/单测 stub）。

## Risks / Trade-offs

- [PNG 长图 CJK/emoji 渲染 tofu] → SVG `foreignObject` 原生文本渲染规避，不做 html2canvas；QA 断言像素采样非 tofu。
- [上游 `packMdpkg` 字节一致性漂移] → 直接复用上游实现，不自造 zip；单测断言 pack→open 往返内容等价与路径/sha256/媒体类型一致。
- [SPA vs SEO 矛盾] → Vite 多页静态产物，`/spec` `/about` 真静态 HTML 可爬；Vercel 无需 SPA 重写。
- [HTML 导出裂图] → 图片资源转 data URI 内联；核心断言 fixture `.mdpkg` K 图 → 导出 HTML → K 个 `data:image/...`、零相对路径/`file://`/404。
- [剪贴板 API 可用性差异] → `copyToClipboard(blob)` seam 可 stub；失败回退下载 PNG。

## Migration Plan

- 本变更为新建纯前端代码，无既有系统迁移；上线即 Vercel 静态部署 + 绑定 `bundle.jianxi.me`。
- 回滚：Vercel 回退上一发布即可；无数据面（徽章仅 localStorage，天然无服务端状态）。

## Open Questions

- 无阻塞项。Phase 2 才需决策的（账号 / 云端 / 分享链接 / 多标签）不在本变更范围。
