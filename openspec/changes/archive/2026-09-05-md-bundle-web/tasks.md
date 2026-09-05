## 1. 脚手架 + 编辑器库地基（Wave 1）

- [x] 1.1 脚手架 pnpm monorepo（apps/web + packages/editor，Vite+React18+TS strict+Tailwind+Vitest+Playwright+ESLint/Prettier+GitHub Actions CI）
- [x] 1.2 建 packages/editor（@md-bundle/editor 入口 + CodeMirror6 依赖 + 主题 token CSS）
- [x] 1.3 CodeMirror 6 源码编辑器组件（markdown 语言、受控 value、#165DFF 深色主题）
- [x] 1.4 斜杠模板（输入 `/` 弹命令菜单：标题/callout/图片ref/代码块/表格/引用；callout 用 `> [!NOTE]` 降级语法）
- [x] 1.5 markdown→HTML 分屏预览渲染器（marked + github-markdown-css 基座 + 主题 token；`<script>` 转义）
- [x] 1.6 编辑器库单测收口（value round-trip、斜杠插入、预览输出、主题 token 全集）

## 2. mdpkg 读集成 + 文件打开（Wave 2）

- [x] 2.1 vendor mdpkg-web.js 并集成 openMdpkg（files/manifest/validation/html；非 ZIP try/catch 抛错捕获）
- [x] 2.2 文件打开：选择 + 拖拽，`.md`/`.mdpkg` 检测，`.mdpkg` sandbox iframe 预览，损坏文件错误态（无白屏）
- [x] 2.3 校验报告 UI（validation.ok/errors/warnings/externalCount）
- [x] 2.4 集成测试（fixture：合法 mdpkg / 损坏 zip / schema 违规 / 非 mdpkg）

## 3. 图片导入 + 主题 + 导出（Wave 3）

- [x] 3.1 图片导入 + 资源清单管理（粘贴/拖拽/批量选择，≤2 步无向导无弹窗；按文件名自动接线；清单删除/替换）
- [x] 3.2 主题系统（CSS token，dark #165DFF + light）
- [x] 3.3 导出 `.md`（下载源文本；含图时丢图警告，取消则不导出）
- [x] 3.4 导出 HTML（自包含、图片 data URI 内联、Made-with byline 页脚 + `?ref` 链接）
- [x] 3.5 导出 PNG 长图（SVG foreignObject + canvas 栅格化，CJK/emoji 保真，不用 html2canvas）
- [x] 3.6 导出收口测试（round-trip「不再裂图」：K 图→K 个 data URI、0 断裂；缺图 fixture 确定性错误）

## 4. `.mdpkg` 写侧（Wave 4）

- [x] 4.1 `.mdpkg` 导出（复用上游 packMdpkg，不自写 zip）+「保存」主按钮（内容驱动：有图→mdpkg、无图→md、打开 mdpkg→重打包）

## 5. 首页 + SEO 多页（Wave 5）

- [x] 5.1 首页 hero（宣传语/Logo/宣传图，#165DFF 深色）+ tool workspace + 官方示例 gallery section（一键载入编辑器）
- [x] 5.2 静态页 `/spec` + `/about`（Vite 多页构建，真静态产物非 SPA 路由）
- [x] 5.3 SEO meta（robots.txt、sitemap.xml、OG 1200×630、JSON-LD SoftwareApplication、canonical）
- [x] 5.4 SEO/多页浏览器测试（可爬 + meta 存在 + OG 尺寸）

## 6. 分享 + 徽章（Wave 6）

- [x] 6.1 Made-with byline 集成（HTML 页脚 + PNG 角落 + 分享卡；`.mdpkg` 文件本体保持干净）
- [x] 6.2 分享卡「复制为图片」（SVG foreignObject → PNG → clipboard，失败回退下载；无文档数据时禁用）
- [x] 6.3 徽章（localStorage 阶梯 + 稀有度 Common/Rare/Epic/Legendary；触发于完成瞬间：首次保存 .mdpkg / 首次导出 PNG / 第 N 次导出；持久化 + 重复触发去重 + 损坏数据安全降级）
- [x] 6.4 分享/徽章收口测试（PNG magic 字节 + byline 出现 + 状态机触发正确性）

## 7. 部署 + 最终验证（Wave 7）

- [x] 7.1 Vercel 部署 + bundle.jianxi.me + 生产三页冒烟 + 工具可打开示例包（已落地：GitHub Pages 生产上线验证 —— 决策偏差经用户批准；域名绑定待用户 DNS；Vercel 备选路径见 DEPLOY.md）

## 8. 最终验证波（全部 APPROVE 才交付）

- [x] 8.1 计划符合性审计（逐条核对 References/Acceptance/QA/Commit，核对 OUT 守则）
- [x] 8.2 代码质量审查（TS strict 零报错、ESLint/Prettier 零告警、依赖体积：mdpkg-web ESM minify/分包）
- [x] 8.3 真实手动 QA（真实设备浏览器走「打开→编辑→导出 md/HTML/PNG/mdpkg→复制为图片→徽章解锁」完整链路，截图留证）
- [x] 8.4 范围忠实度（无 Phase-2 功能渗入：后端/WYSIWYG/UGC/完整 i18n；无私有语法；`.mdpkg` 本体无品牌信息）
