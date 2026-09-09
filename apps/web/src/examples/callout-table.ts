// 示例 2：Callout 提示框 + 表格演示。
// 展示 MD-Bundle 对富文本排版的支持能力。
import type { ExampleDoc } from './formula-mermaid';

export const calloutTableExample: ExampleDoc = {
  id: 'callout-table',
  title: '提示框与表格',
  summary: '展示 Callout 提示框和数据表格排版，体现 MD-Bundle 对结构化内容的呈现。',
  format: 'md',
  content: `# 提示框与表格

MD-Bundle 支持多种 Callout 样式和精美的表格排版。

## 提示框

> [!tip] 实用提示
> Markdown 是最通用的文档格式，几乎所有平台都支持。

> [!warning] 注意事项
> 打包为 .mdpkg 时，图片会内嵌到文件中，确保分享时不裂图。

> [!info] 你知道吗？
> MD-Bundle 完全在浏览器端运行，文件不会上传到任何服务器。

## 功能对比

| 功能 | .md 文件 | .mdpkg 包 |
|------|----------|-----------|
| 纯文本编辑 | ✅ | ✅ |
| 图片内嵌 | ❌ | ✅ |
| 跨平台分享 | ⚠️ 可能裂图 | ✅ 不裂图 |
| 文件大小 | 小 | 稍大 |
| 离线查看 | ✅ | ✅ |

## 列表

- **打开**：支持 .md 和 .mdpkg 两种格式
- **编辑**：所见即所得的 Markdown 编辑器
- **导出**：.md / .mdpkg / HTML / PNG 四种格式
- **分享**：一个文件，带走全部图文

> MD-Bundle —— 一个文件，带走全部图文。
`,
};
