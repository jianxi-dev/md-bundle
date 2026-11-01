/**
 * 从一个「结构化编辑器视图 + 预览容器」组合出 OutlineNavigator（#512）。
 * web 侧与 Clairis 都用它，避免各自重写「按行号滚动 / 按 id 滚动」。
 */
import type { OutlineNavigator } from '../contracts';

/** 大纲组件与导航工厂共用的结构化编辑器视图（不依赖 @codemirror 类型）。 */
export interface OutlineEditorView {
  state: {
    doc: {
      toString(): string;
      lines: number;
      length: number;
      line(n: number): { from: number };
    };
  };
  viewport: { from: number; to: number };
  focus(): void;
  /** CM6 的滚动容器（EditorView.scrollDOM）。 */
  scrollDOM: HTMLElement;
  /** 指定字符偏移处的行块几何（相对文档顶部）。 */
  lineBlockAt(pos: number): { top: number; bottom: number };
}

export interface OutlineNavigatorSources {
  /** 当前编辑器视图（编辑/源码模式）；无则返回 null。 */
  getView(): OutlineEditorView | null;
  /** 预览容器元素（预览模式）；无则返回 null。 */
  getPreview(): HTMLElement | null;
}

export function createOutlineNavigator(sources: OutlineNavigatorSources): OutlineNavigator {
  return {
    scrollToLine(line: number): void {
      const view = sources.getView();
      if (!view) return;
      const doc = view.state.doc;
      if (line >= doc.lines) return;
      const pos = doc.line(line + 1).from;
      try {
        view.scrollDOM.scrollTop = view.lineBlockAt(pos).top;
      } catch {
        // jsdom 无布局 → 忽略
      }
    },
    scrollToHeading(id: string): void {
      // 空 id 守卫：`querySelector('#')` 会抛 SyntaxError，而 renderer 会剥离 id，
      // 未自带锚点的消费方拿到的一定是空串。
      if (!id) return;
      const el = sources.getPreview()?.querySelector(`#${CSS.escape(id)}`);
      el?.scrollIntoView({ behavior: 'instant', block: 'start' });
    },
  };
}
