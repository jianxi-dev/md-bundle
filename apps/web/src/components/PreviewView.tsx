// 预览视图（任务 1.5）—— 使用 @md-bundle/renderer 的 renderMarkdown + hydrateLazyFeatures。
// 渲染链：renderMarkdown(markdown) → 同步 sanitized HTML → 客户端 hydrateLazyFeatures
// （KaTeX/mermaid/highlight）。CSS 由 readerCssText 提供（双主题），通过 index.css 引入。
import { useEffect, useRef } from 'react';
import { renderMarkdown, hydrateLazyFeatures, readerCssText } from '@md-bundle/renderer';
import type { ThemeName } from '@md-bundle/editor';

export interface PreviewViewProps {
  markdown: string;
  theme?: ThemeName;
}

// readerCssText 在模块加载时注入一次（全局副作用，零重复）。
let cssInjected = false;
function ensureReaderCss(): void {
  if (cssInjected) return;
  if (typeof document === 'undefined') return; // SSR guard
  const style = document.createElement('style');
  style.textContent = readerCssText;
  document.head.appendChild(style);
  cssInjected = true;
}

/**
 * 预览视图：renderMarkdown → 同步 HTML → hydrateLazyFeatures（异步）。
 * 渲染结果包裹在 `.preview-content` div 内（readerCss 选择器要求），
 * 并设置 `data-theme` 属性以激活双主题 CSS 变量。
 */
export function PreviewView({ markdown, theme = 'dark' }: PreviewViewProps): JSX.Element {
  const rootRef = useRef<HTMLDivElement>(null);

  // 同步渲染 markdown → HTML。
  const html = renderMarkdown(markdown);

  // hydrateLazyFeatures（KaTeX/mermaid/highlight）在 DOM 就绪后异步执行。
  useEffect(() => {
    ensureReaderCss();
    if (rootRef.current) {
      void hydrateLazyFeatures(rootRef.current, theme);
    }
  }, [html, theme]);

  return (
    <div
      ref={rootRef}
      className="preview-content"
      data-theme={theme}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
