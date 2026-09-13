# MD-Bundle

Markdown 自包含在线工具 —— 把图片、附件打包进一个 `.mdpkg` 文件，分享不再裂图。

> 状态：**v2 实现中**（代码完成，发布验证冲刺中）。纯前端、零后端、零账号。

## v2 新特性

- **编辑所见即所得**：Typora 式「活的源码」——CM6 装饰（标题/加粗斜体/列表/引用/行内码/行内图/callout），底层永远 Markdown 源码，光标进入露回源码
- **共享渲染管线**：`.md` 实时预览 / HTML 导出 / PNG 长图同源渲染（`@md-bundle/renderer`），DOMPurify 唯一消毒 SSOT
- **三模式工作区**：编辑 / 源码 / 预览，ghost 图标切换，undo 历史跨模式保留
- **多页签会话**：IndexedDB 自动保存 + 刷新全量恢复 + 无上限 + 脏点 + 关闭确认三分支 + 最近文档
- **FSA 文件夹工作区**（仅 Chromium，渐进增强）：目录授权 + 句柄持久化 + 一键续权 + 文件树（打开/新建/重命名/删除确认/拖入复制）+ 树内打开持写句柄供保存回写；无 FSA = v1 等价体验全程可用
- **三层保存模型**：自动保存（IndexedDB 草稿）→ 单一主按钮（持句柄=真写回 / 未另存=另存为 / 无 FSA=同一位显示下载）→ 独立的「下载副本」只进导出▾
- **整窗拖放直达**（无遮罩）：任意处 drop `.md`/`.mdpkg` = 立即新页签；编辑器内拖图 = 图片导入；文件树拖入 = 复制
- **可折叠左栏 [文件|资源]**：默认收起，资源孤儿徽标点
- **工作区右上毛玻璃大纲浮层**：hover 弹 / click 钉 / Esc 收；code-fence aware 解析
- **主题三态**：跟随系统 / 深 / 浅，localStorage 持久化
- **分享对象=网站**：邀请链接 `?ref=invite&by=<随机昵称>`（无文档 payload、服务端零存储）+ InviteView 落地页变体；4 种构图本质不同的邀请分享卡（横版作品卡/竖版金句卡/网站宣传卡/极简名片卡，多底色随机）；v1「复制正文为图片」保留并归位顶栏动作区最左独立图标按钮
- **落地页重设计**：细导航 + hero（双行 slogan + 格式范围标注行 + 产品主视觉 + 双 CTA + 三价值徽标）+ 最近文档 + 精选作品（3 个演示文档真渲染缩略卡片）+ 页脚
- **SEO 示例页**：每示例生成静态可爬 HTML（KaTeX 预渲染内联、mermaid 不进静态正文）
- **移动端适配**（<768px）：左栏底部抽屉、大纲右上同位不压页签条、窄屏默认预览、溢出菜单

## 生态

- **mdpkg 格式**：[jianxi-dev/mdpkg](https://github.com/jianxi-dev/mdpkg) — 自包含 Markdown 打包格式（规范 + CLI 参考实现）
- **Clairis（渐晰）**：[lqtdys/clairis](https://github.com/lqtdys/clairis) — 桌面旗舰产品，Markdown 阅读编辑与学习成长伙伴
- **规划域名**：bundle.jianxi.me（待部署）

## 开发流程

- **变更生命周期**：启动/接手/拆票/提交/收尾一律经 `.opencode/skills/change-workflow/`（G0-G4 五 gate，fix-first 自愈回路）
- **拆票与 PR 规范**：1 task = 1 ticket，1 issue = 1 PR（详见 `docs/agents/task-tracking.md`）
- **缺陷流程**：GitHub Issues 唯一事实来源，`[bug]` 票 + triage 状态机流转（详见 `docs/agents/defect-workflow.md`）

## 计划能力

- 网页端编辑与导出：编辑 Markdown + 导入图片 → 下载 `.md` / `.mdpkg`，导出 HTML / PNG 长图 / 分享卡片
- 网页端预览：上传 `.md` / `.mdpkg` → 双模式预览（普通文本 / 完整资源）
- FSA 文件夹工作区（仅 Chromium，渐进增强）：目录授权 + 文件树 + 持句柄保存回写
- 多页签会话：IndexedDB 自动保存 + 刷新恢复 + 最近文档
- 邀请分享：`?ref=invite` 链接与 4 款邀请分享卡片；主题三态
- 开源（MIT）

## 技术栈

- pnpm monorepo, TypeScript + React 18 + Vite + Vitest + Playwright
- `apps/web` — Vite MPA 主应用
- `packages/editor` — CM6 共享编辑器库
- `packages/renderer` — 共享渲染管线（marked + DOMPurify + KaTeX + mermaid + lezer）
- 纯前端，无后端，无 CLI
