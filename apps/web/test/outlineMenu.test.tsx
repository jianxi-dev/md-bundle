// 大纲浮层多页签测试（任务：修复 #73 大纲串扰 + 点击无跳转）。
// 覆盖：(a) 切换 documentText 后大纲条目更新；(b) 点击标题触发正确滚动定位；
// (c) 高亮不跨文档泄漏；(d) 预览模式 DOM 滚动。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { OutlineMenu } from '../src/components/OutlineMenu';
import type { EditorMode } from '../src/components/Toolbar';

// jsdom 缺少 requestAnimationFrame / ResizeObserver；CM6 使用两者。
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

const DOC_A = `# 标题一\n\n内容一\n\n## 子标题 A\n\n更多内容`;
const DOC_B = `# 文档二\n\n完全不同\n\n## 二级 B\n\n### 三级`;

// 构造一个最小 CM6ViewLike mock（依赖边界：不引入 @codemirror/view）。
// lineBlockAt 返回确定性坐标：行高 20px，top = 行号 * 20。
function makeMockView(opts: {
  docText: string;
  viewportFrom?: number;
  lineHeight?: number;
}) {
  const lines = opts.docText.split('\n');
  const lineHeight = opts.lineHeight ?? 20;
  const scrollDom = { scrollTop: 0 };
  const doc = {
    toString: () => opts.docText,
    lines: lines.length,
    length: opts.docText.length,
    line(n: number) {
      let from = 0;
      for (let i = 0; i < n - 1 && i < lines.length; i++) {
        from += lines[i].length + 1;
      }
      return { from };
    },
  };
  return {
    state: { doc },
    viewport: { from: opts.viewportFrom ?? 0, to: opts.docText.length },
    focus: vi.fn(),
    scrollDOM: scrollDom,
    // 根据字符偏移推算行号，返回 top = 行号 * lineHeight
    lineBlockAt(pos: number): { top: number; bottom: number } {
      const textBefore = opts.docText.slice(0, pos);
      const lineNum = textBefore.split('\n').length - 1;
      return { top: lineNum * lineHeight, bottom: (lineNum + 1) * lineHeight };
    },
  };
}

// 辅助：渲染 OutlineMenu 并钉住（pinned=true）以显示浮层。
function renderPinned(props: {
  mode: EditorMode;
  documentText: string;
  editorView?: ReturnType<typeof makeMockView> | null;
  previewRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const result = render(
    <OutlineMenu
      mode={props.mode}
      documentText={props.documentText}
      editorView={props.editorView ?? null}
      previewRef={props.previewRef ?? { current: null }}
    />,
  );
  const btn = screen.getByTestId('outline-btn');
  fireEvent.click(btn);
  return result;
}

describe('OutlineMenu 多页签', () => {
  beforeEach(() => {
    installPolyfills();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('hover 能力设备：mouseover 弹出、mouseout 收起（桌面行为保持）', () => {
    render(
      <OutlineMenu
        mode="edit"
        documentText={DOC_A}
        editorView={makeMockView({ docText: DOC_A }) as never}
        previewRef={{ current: null }}
      />,
    );

    const wrap = screen.getByTestId('outline-wrap');
    fireEvent.mouseOver(wrap, { relatedTarget: document.body });
    expect(screen.getByTestId('outline-menu')).toBeTruthy();

    fireEvent.mouseOut(wrap, { relatedTarget: document.body });
    expect(screen.queryByTestId('outline-menu')).toBeNull();
  });

  it('钉住后点击浮层外部（pointerdown）即收起', () => {
    const view = makeMockView({ docText: DOC_A });
    renderPinned({ mode: 'edit', documentText: DOC_A, editorView: view as never });
    expect(screen.getByTestId('outline-menu')).toBeTruthy();

    // 外部 pointerdown（鼠标/触屏统一）→ 无论 pinned 与否都应关闭
    fireEvent.pointerDown(document.body);
    expect(screen.queryByTestId('outline-menu')).toBeNull();
  });

  it('在触发钮上 pointerdown 不触发外部关闭（toggle 交给 onClick）', () => {
    const view = makeMockView({ docText: DOC_A });
    renderPinned({ mode: 'edit', documentText: DOC_A, editorView: view as never });

    fireEvent.pointerDown(screen.getByTestId('outline-btn'));
    // 未被外部关闭逻辑误关，菜单保持打开；随后 onClick toggle 才能正常收起
    expect(screen.getByTestId('outline-menu')).toBeTruthy();

    fireEvent.click(screen.getByTestId('outline-btn'));
    expect(screen.queryByTestId('outline-menu')).toBeNull();
  });

  it('无 hover 设备：触屏合成的 mouseenter/mouseover 不弹出，点外部关闭', () => {
    // 模拟触屏设备：matchMedia('(hover: none)') → matches
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('hover: none'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }));

    render(
      <OutlineMenu
        mode="edit"
        documentText={DOC_A}
        editorView={makeMockView({ docText: DOC_A }) as never}
        previewRef={{ current: null }}
      />,
    );

    const wrap = screen.getByTestId('outline-wrap');
    // 触屏 tap 会合成 mouseover/mouseenter —— 无 hover 设备上不应弹出（不再卡 hover 态）
    fireEvent.mouseOver(wrap, { relatedTarget: document.body });
    fireEvent.mouseEnter(wrap);
    expect(screen.queryByTestId('outline-menu')).toBeNull();

    // 点触发钮 → 弹出（纯 pinned 模式）
    fireEvent.click(screen.getByTestId('outline-btn'));
    expect(screen.getByTestId('outline-menu')).toBeTruthy();

    // 点外部 → 关闭
    fireEvent.pointerDown(document.body);
    expect(screen.queryByTestId('outline-menu')).toBeNull();
  });

  it('切换 documentText 后大纲条目反映新文档', () => {
    const view = makeMockView({ docText: DOC_A });
    const { rerender } = renderPinned({
      mode: 'edit',
      documentText: DOC_A,
      editorView: view as never,
    });

    const menu = screen.getByTestId('outline-menu');
    let items = within(menu).getAllByRole('menuitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('标题一');
    expect(items[1]).toHaveTextContent('子标题 A');

    rerender(
      <OutlineMenu
        mode="edit"
        documentText={DOC_B}
        editorView={view as never}
        previewRef={{ current: null }}
      />,
    );

    items = within(screen.getByTestId('outline-menu')).getAllByRole('menuitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('文档二');
    expect(items[1]).toHaveTextContent('二级 B');
    expect(items[2]).toHaveTextContent('三级');
  });

  it('点击标题滚动到正确行（scrollTop === lineBlockAt.top）', () => {
    // DOC_A: line 0 = "# 标题一", line 4 = "## 子标题 A"
    const view = makeMockView({ docText: DOC_A, lineHeight: 20 });
    renderPinned({
      mode: 'edit',
      documentText: DOC_A,
      editorView: view as never,
    });

    const menu = screen.getByTestId('outline-menu');
    const items = within(menu).getAllByRole('menuitem');

    // 点击第二个标题（子标题 A，位于行 4）
    fireEvent.click(items[1]);

    // lineBlockAt(line 4) → top = 4 * 20 = 80
    expect(view.scrollDOM.scrollTop).toBe(80);
    expect(view.focus).toHaveBeenCalled();
  });

  it('文档切换后高亮不泄漏：旧文档的当前项不会出现在新文档中', () => {
    // 用两个长度不同的文档，确保 guard 触发
    const viewA = makeMockView({ docText: DOC_A });
    const { rerender } = renderPinned({
      mode: 'edit',
      documentText: DOC_A,
      editorView: viewA as never,
    });

    // 点击第一个标题 → activeIndex = 0
    const items = within(screen.getByTestId('outline-menu')).getAllByRole('menuitem');
    fireEvent.click(items[0]);
    const currentAfterClick = screen.getByTestId('outline-current');
    expect(currentAfterClick).toHaveTextContent('标题一');

    // 切换到文档 B（view.state.doc.length 与 DOC_B 相同 → guard 不触发，正常计算高亮）
    const viewB = makeMockView({ docText: DOC_B });
    rerender(
      <OutlineMenu
        mode="edit"
        documentText={DOC_B}
        editorView={viewB as never}
        previewRef={{ current: null }}
      />,
    );

    // 切换后：activeIndex 被 useEffect 重置为 -1，currentIndex 基于 DOC_B 的 viewport 计算。
    // findCurrentHeadingIndex 从末尾反向查找 pos >= vp.from 的标题，vp.from=0 → 返回最后一个。
    // 关键是：outline-current 绝不包含 DOC_A 的「标题一」。
    const newCurrent = screen.getByTestId('outline-current');
    expect(newCurrent).not.toHaveTextContent('标题一');
    expect(newCurrent).toHaveTextContent('三级');
  });

  it('共享 view 文档未同步时不高亮（guard 路径）', () => {
    // view 持有 DOC_A，但 documentText 已是 DOC_B → doc.length 不同 → 返回 -1
    const viewA = makeMockView({ docText: DOC_A });
    renderPinned({
      mode: 'edit',
      documentText: DOC_B, // 外部已切到新文档
      editorView: viewA as never, // 但 view 仍是旧文档
    });

    // findCurrentHeadingIndex 应返回 -1（guard 触发），无高亮
    // 但 headings 来自 DOC_B（extractHeadings(documentText)），所以列表是 DOC_B 的
    const items = within(screen.getByTestId('outline-menu')).getAllByRole('menuitem');
    expect(items[0]).toHaveTextContent('文档二');

    // 不应有 outline-current（guard 返回 -1，无高亮）
    expect(screen.queryByTestId('outline-current')).toBeNull();
  });

  it('预览模式下点击标题滚动到对应 DOM 元素', () => {
    const container = document.createElement('div');
    const h1 = document.createElement('h1');
    h1.textContent = '预览标题';
    const h2 = document.createElement('h2');
    h2.textContent = '二级';
    container.appendChild(h1);
    container.appendChild(h2);
    document.body.appendChild(container);

    const previewRef = { current: container };

    renderPinned({
      mode: 'preview',
      documentText: '',
      editorView: null,
      previewRef,
    });

    const menu = screen.getByTestId('outline-menu');
    const items = within(menu).getAllByRole('menuitem');
    expect(items).toHaveLength(2);

    const scrollSpy = vi.fn();
    h2.scrollIntoView = scrollSpy;

    fireEvent.click(items[1]);
    expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'instant', block: 'start' });

    document.body.removeChild(container);
  });
});
