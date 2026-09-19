// 结构体检面板测试（缺陷 #170）。
//
// editorView 对象身份在挂载后稳定（App 只在 onMount 设置一次），因此面板的
// useMemo 必须以 documentText 为依赖驱动重算，否则编辑后永远显示首次诊断。
// 用真实 CodeMirror EditorView（经公开 API createMarkdownEditor 构造），
// 因为 lintStructure 依赖 Lezer 语法树，mock 对象无法满足。
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createMarkdownEditor, type MarkdownEditorHandle } from '@md-bundle/editor';
import { LeftRail } from '../src/components/LeftRail';

function installPolyfills(): void {
  if (typeof globalThis.requestAnimationFrame !== 'function') {
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 16)) as unknown as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = ((id: number) =>
      clearTimeout(id)) as unknown as typeof cancelAnimationFrame;
  }
  if (typeof globalThis.ResizeObserver !== 'function') {
    globalThis.ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver;
  }
}

/** 无诊断：已验证 lintStructure 返回空。 */
const DOC_CLEAN = '# 标题\n\n这是正文段落内容。\n';
/** 有诊断：H1 → H3 层级跳跃。 */
const DOC_JUMP = '# 标题\n\n正文内容。\n\n### 小节\n\n小节正文。\n';
/** 修好层级后的同一文档：H1 → H2，无跳跃。 */
const DOC_FIXED = '# 标题\n\n正文内容。\n\n## 小节\n\n小节正文。\n';

let handle: MarkdownEditorHandle | null = null;
let host: HTMLDivElement | null = null;

function mountEditor(doc: string): MarkdownEditorHandle {
  host = document.createElement('div');
  document.body.appendChild(host);
  handle = createMarkdownEditor(host, { value: doc, theme: 'dark' });
  return handle;
}

const baseProps = {
  assets: [],
  onDelete: () => {},
  onReplace: () => {},
  onOpenFile: () => {},
  activeTabName: null,
  recentDocs: [],
  onOpenRecentDoc: () => {},
  open: true,
  onToggle: () => {},
};

function openStructureTab(): void {
  fireEvent.click(screen.getByTestId('left-rail-tab-structure'));
}

describe('StructurePanel', () => {
  beforeEach(() => {
    installPolyfills();
  });
  afterEach(() => {
    cleanup();
    handle?.destroy();
    handle = null;
    host?.remove();
    host = null;
  });

  it('renders empty state when no diagnostics', () => {
    const v = mountEditor(DOC_CLEAN);
    render(<LeftRail {...baseProps} documentText={DOC_CLEAN} editorView={v.view} />);
    openStructureTab();
    expect(screen.getByTestId('structure-panel-empty')).toBeTruthy();
    expect(screen.queryByTestId('structure-panel')).toBeNull();
  });

  it('shows diagnostics when doc has structural issues', () => {
    const v = mountEditor(DOC_JUMP);
    render(<LeftRail {...baseProps} documentText={DOC_JUMP} editorView={v.view} />);
    openStructureTab();
    expect(screen.getByTestId('structure-panel').textContent).toContain('标题层级跳跃');
  });

  it('recomputes diagnostics when documentText changes (reactivity)', () => {
    const v = mountEditor(DOC_JUMP);
    const { rerender } = render(
      <LeftRail {...baseProps} documentText={DOC_JUMP} editorView={v.view} />,
    );
    openStructureTab();
    expect(screen.getByTestId('structure-panel').textContent).toContain('标题层级跳跃');

    // 修正文档：层级跳跃消失，面板必须随之刷新（editorView 身份未变）。
    // docKey 变化驱动 useMemo 重算 → 面板从「有诊断」切到「空态」。
    v.setValue(DOC_FIXED);
    rerender(<LeftRail {...baseProps} documentText={DOC_FIXED} editorView={v.view} />);
    expect(screen.queryByTestId('structure-panel')).toBeNull();
    expect(screen.getByTestId('structure-panel-empty')).toBeTruthy();
  });

  it('calls onScrollToPosition when a diagnostic row is clicked', () => {
    const v = mountEditor(DOC_JUMP);
    let scrolled: number | null = null;
    render(
      <LeftRail
        {...baseProps}
        documentText={DOC_JUMP}
        editorView={v.view}
        onScrollToPosition={(pos) => {
          scrolled = pos;
        }}
      />,
    );
    openStructureTab();
    const row = screen.getByTestId('structure-diagnostic-0');
    fireEvent.click(row);
    expect(scrolled).not.toBeNull();
  });
});
