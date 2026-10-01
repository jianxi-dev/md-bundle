## 1. 安全底座修复（Phase 0）

- [x] 1.1 DOMPurify 修复：移除 style/id，开 ALLOW_DATA_ATTR + SANITIZE_NAMED_PROPS
- [x] 1.2 CSP headers：Vercel vercel.json（index.html meta 已移除，避免 e2e 失败）
- [x] 1.3 API key 仅存内存：定义 Provider 接口，key 不入 localStorage
- [x] 1.4 CSS 隔离：编辑器侧 contain（@scope/Shadow DOM 后续 Phase）
- [x] 1.5 安全测试：每个净化向量一条自动化测试

## 2. 基础设施（Phase 0）

- [x] 2.1 块模型定义：Lezer AST 顶层节点 → 块边界规则 + 编辑后重划分
- [x] 2.2 Lezer AST 迁移：正则扫描 → 语法树遍历（block-model.ts）
- [x] 2.3 统一命令注册表：CommandRegistry 接口 + 现有 slash/Toolbar 迁移
- [x] 2.4 3 个风险 spike：PNG 栅格化安全子集 / 块拖拽 / 中文 IME

## 3. .mdpkg 即应用（Phase 1）

- [x] 3.1 包格式升级：renderer/ + styles/ 目录
- [x] 3.2 viewer.html：双击打开只读渲染
- [x] 3.3 导出 HTML 像素级一致验证

## 4. Diff-native AI（Phase 2）

- [x] 4.1 AI Provider 接口：Local/BYOKey/Disabled
- [x] 4.2 选中 → 改写 → 行内 diff 渲染
- [x] 4.3 Tab/Esc 逐 hunk 审阅
- [x] 4.4 Privacy Ledger UI

## 5. 结构体检 + 章节重组（Phase 3）

- [x] 5.1 AST 规则诊断引擎（论点无证据/章节无结论/层级跳跃）
- [x] 5.2 诊断结果行内 decoration 渲染
- [x] 5.3 文档结构可视化（树形大纲）
- [x] 5.4 拖拽章节重排 + undo
- [x] 5.5 导出子树

## 6. 语义编辑态（Phase 4）

- [x] 6.1 渐进式语法揭示装饰引擎
- [x] 6.2 ghost marker + 冻结机制
- [x] 6.3 三种工作模式切换
- [x] 6.4 上下文感知工具栏
- [x] 6.5 智能输入（快捷输入 + 智能 Enter/Backspace + 自动配对）

## 7. 富表现力增强（Phase 5）

- [x] 7.1 Callout 12+ 类型
- [x] 7.2 视觉模板库（Hero/Card/Timeline/CTA）
- [x] 7.3 HTML 块安全嵌入
- [x] 7.4 CSS-only 组件

## 8. 流式编辑（Phase 6）

- [x] 8.1 打字即渲染
- [x] 8.2 选择即操作
- [x] 8.3 命令面板智能排序
