## Context

md-bundle 是纯前端 Markdown 编辑器 + .mdpkg 打包工具。当前编辑态基于 CodeMirror 6 的源码编辑 + 装饰系统（正则扫描），渲染管线为 marked + DOMPurify。存在安全硬伤和战略定位偏差。

## Goals / Non-Goals

**Goals:**
- 修复安全底座（DOMPurify、CSP、API key、CSS 隔离）
- 将 .mdpkg 升级为"双击即打开的富文档"
- 实现语义编辑态（渐进式语法揭示）
- 实现 Diff-native AI（行内 diff 审阅）
- 实现结构体检（AST 规则诊断）

**Non-Goals:**
- 不做实时协作
- 不做插件系统
- 不做意图引擎（主动 LLM 建议）
- 不做自定义私有语法元素

## Decisions

### D1: 安全修复策略
- 移除 `style`/`id` from ALLOWED_ATTR → 富样式改走 class 白名单
- 开 ALLOW_DATA_ATTR + SANITIZE_NAMED_PROPS → 组件 data-* 保留 + DOM clobbering 防御
- CSP: Vercel headers + GitHub Pages meta fallback
- CSS 隔离: 编辑器侧 @scope（Chromium 118+），降级方案 contain

### D2: .mdpkg 包格式
- 包内新增 renderer/ 和 styles/ 目录
- renderer.js = @md-bundle/renderer 的 UMD bundle
- styles.css = readerCssText 提取
- 打开方式：拖入编辑器 / 双击 viewer.html / 导出 HTML

### D3: 语义编辑态实现
- 基于 Lezer AST（替代现有正则扫描）
- 装饰模式：非活动块 Decoration.replace 隐藏标记，活动块 Decoration.mark 弱化显示
- 行高恒定：CSS class 预设固定行高，标记显隐不改变布局
- 冻结机制：pointerdown 时冻结装饰更新 100ms

### D4: AI 集成
- Provider seam: LocalProvider / BYOKeyProvider / Disabled
- 交互：选中 → 浮动工具栏 AI 按钮 → 行内 diff → Tab/Esc
- API key 仅存内存（页面刷新即需重输）
- 无 AI = 完整产品

### D5: 结构体检
- Lezer AST 遍历 + 纯函数检测器
- 零 LLM、零成本、离线
- 诊断结果以行内 decoration 渲染

### D6: 三轴模型（替代三层增强）
- 作者语法：Pandoc fenced div + Obsidian callout + 标准 HTML
- 呈现：设计令牌 + class 白名单
- 能力：静态(CSS-only) | 沙箱(iframe)

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| PNG 栅格化不支持 light-dark() | 模板只使用栅格化安全子集 |
| @scope 浏览器兼容性 | 降级到 contain + class 前缀 |
| 端侧 AI 能力有限 | 云端为可选增强，默认 Disabled |
| Lezer AST 迁移复杂度 | Phase 0 spike 验证 |
| 正则 → AST 性能回归 | 增量解析 + 装饰缓存 |
