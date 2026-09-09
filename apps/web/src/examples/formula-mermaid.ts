// 示例 1：公式 + Mermaid 流程图演示。
// 展示 MD-Bundle 对数学公式和流程图的支持能力。
export interface ExampleDoc {
  id: string;
  title: string;
  summary: string;
  format: 'md' | 'mdpkg';
  content: string;
  assets?: { name: string; dataUrl: string }[];
}

export const formulaMermaidExample: ExampleDoc = {
  id: 'formula-mermaid',
  title: '公式与流程图',
  summary: '展示数学公式渲染和 Mermaid 流程图，体现 MD-Bundle 对学术和技术文档的支持。',
  format: 'md',
  content: `# 公式与流程图

MD-Bundle 支持 LaTeX 数学公式和 Mermaid 流程图，让技术文档更加生动。

## 数学公式

行内公式：欧拉公式 $e^{i\\pi} + 1 = 0$ 被誉为最美的数学公式。

块级公式——傅里叶变换：

$$
F(\\omega) = \\int_{-\\infty}^{\\infty} f(t) e^{-i\\omega t} dt
$$

## 流程图

\`\`\`mermaid
graph TD
    A[打开 .md 文件] --> B{是否有图片?}
    B -->|是| C[打包为 .mdpkg]
    B -->|否| D[直接导出 .md]
    C --> E[分享给朋友]
    D --> E
    E --> F[朋友打开阅读]
\`\`\`

## 代码高亮

\`\`\`typescript
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
\`\`\`

> MD-Bundle —— 分享 Markdown，不再裂图。
`,
};
