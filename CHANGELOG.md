# Changelog

## [1.0.0.0] - 2026-09-10

### Added

- 新增独立的 `@md-bundle/renderer` 渲染引擎：Markdown 渲染、代码高亮、Mermaid 图表、数学公式（KaTeX）、懒加载水合、阅读器样式主题
- 新增 FSA（File System Access）能力层：保存句柄持久化，刷新后不再重复弹出文件选择器
- 新增 IndexedDB 会话存储：软配额（5MB 警告）/ 硬配额（20MB 拒写）保护
- 新增标签页脏点指示器：未保存关闭时弹出确认对话框
- 新增 ESC 键退出全屏功能（关闭 Issue #13）
- 新增主题三态切换：跟随系统 / 深色 / 浅色
- 新增分享菜单：邀请链接（含随机昵称）与 4 款邀请分享卡片
- 新增导入导出格式：DOCX、ZIP、文件夹拖入、相对路径图片引用
- 新增文件树操作：新建 / 重命名 / 删除 / 拖拽排序
- 新增 GitHub Issue 追踪与缺陷工作流（中文缺陷模板、分级标签、域文档）
- 新增事故复盘与恢复流程文档（未提交代码丢失防护、共享工作区安全协议）
- 新增 SEO 示例页面（Vite MPA 架构）

### Changed

- 重构保存模型：主按钮统一为 accent 视觉，移动端复制正文收进"更多"菜单
- 重构预览视图：仅可见时触发懒加载水合（IntersectionObserver），大幅降低首屏开销
- 重构数学公式存储：从全局 Map 改为 DOM 内嵌 `data-math-tex`，消除多标签页公式串扰竞态
- Toolbar / Landing / TabStrip / LeftRail / OutlineMenu 全面恢复精细化 SVG 图标版本
- 升级包版本至 1.0.0.0（MAJOR）：v2 布局里程碑正式发布

### Fixed

- 修复拖拽遮罩红线违约问题（移除遮罩，改用 dragenter + 真实 testid）
- 修复 ValidationPanel 未接线 mdpkg 校验结果的问题
- 修复标签页脏点未渲染的问题
- 修复主题按钮与分享按钮处于 disabled 状态无法点击的问题
- 修复包体积预算回归，确保 bundle 符合限制

### Removed

- 移除拖拽遮罩层（红线违约组件）
