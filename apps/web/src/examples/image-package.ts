// 示例 3：图文打包演示。
// 展示 MD-Bundle 的 .mdpkg 图文自包含打包能力。
import type { ExampleDoc } from './formula-mermaid';

export const imagePackageExample: ExampleDoc = {
  id: 'image-package',
  title: '图文打包示例',
  summary: '展示 .mdpkg 图文自包含打包能力，一个文件带走全部图文内容。',
  format: 'md' as const,
  content: `# 图文打包示例

MD-Bundle 的核心能力：把 Markdown 和图片打包成一个 \`.mdpkg\` 文件，分享时不再裂图。

## 工作流程

1. **打开** Markdown 文件
2. **导入** 图片（拖拽、粘贴、选择）
3. **保存** 为 \`.mdpkg\` 自包含包
4. **分享** 给朋友——一个文件搞定

## 为什么选择 .mdpkg？

传统的 Markdown 分享方式有一个痛点：图片是外链的。当你把 \`.md\` 文件发给朋友，图片可能因为以下原因看不到：

- 图片在你的本地电脑上
- 图片链接已过期
- 平台限制外链图片

\`.mdpkg\` 格式把图片**内嵌**到文件中，就像 PDF 一样，打开就能看到完整内容。

## 快速开始

打开 MD-Bundle 网页工具，按照以下步骤操作：

1. 点击「选择或拖入文件」打开你的 Markdown 文档
2. 通过拖拽或粘贴导入图片
3. 点击保存，选择 .mdpkg 格式
4. 把生成的文件分享给朋友

> [!tip] 小技巧
> 你也可以直接把图片拖到编辑器中，MD-Bundle 会自动导入并插入引用。

> MD-Bundle —— 分享 Markdown，不再裂图。一个文件，带走全部图文。
`,
};
