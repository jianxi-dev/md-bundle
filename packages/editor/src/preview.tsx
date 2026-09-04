import { marked } from 'marked';
import { getThemeColor, type ThemeName } from './theme';

export interface MarkdownPreviewProps {
  markdown: string;
  theme?: ThemeName;
}

/**
 * Renders markdown to sanitized-by-escape HTML inside a `.markdown-body`
 * container (github-markdown-css). Script tags are escaped BEFORE parsing so
 * raw HTML in the input can never execute.
 */
export function MarkdownPreview({
  markdown,
  theme = 'dark',
}: MarkdownPreviewProps) {
  const safe = markdown.replace(/<script/gi, '&lt;script');
  const parsed = marked.parse(safe) as string;
  return (
    <div
      className="markdown-body"
      data-theme={theme}
      style={{
        background: getThemeColor(theme, 'bg'),
        color: getThemeColor(theme, 'text'),
      }}
      dangerouslySetInnerHTML={{ __html: parsed }}
    />
  );
}
