import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { EditorView } from '@codemirror/view';
import { createMarkdownEditor } from '../src/editor';
import { commandRegistry, type Command } from '../src/commands';
import {
  closeCommandPalette,
  commandPaletteKeymap,
  openCommandPalette,
  paletteApply,
  paletteClose,
  paletteSelectNext,
  paletteSelectPrev,
} from '../src/command-palette';

// jsdom lacks requestAnimationFrame/ResizeObserver; CodeMirror 6 uses both.
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

const PANEL = '[data-testid="command-palette"]';
const BACKDROP = '[data-testid="command-palette-backdrop"]';
const INPUT = '[data-testid="command-palette-input"]';
const CLOSE = '[data-testid="command-palette-close"]';
const ITEMS = '[data-testid="command-palette-item"]';

function mustEl(selector: string, root: ParentNode = document): HTMLElement {
  const el = root.querySelector(selector);
  if (!(el instanceof HTMLElement)) throw new Error(`missing element: ${selector}`);
  return el;
}

function elements(selector: string): HTMLElement[] {
  return Array.from(document.querySelectorAll(selector)).filter(
    (el): el is HTMLElement => el instanceof HTMLElement,
  );
}

function mustInput(selector: string): HTMLInputElement {
  const el = document.querySelector(selector);
  if (!(el instanceof HTMLInputElement)) throw new Error(`missing input: ${selector}`);
  return el;
}

function key(k: string, extra: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...extra });
}

function mouse(kind: string): MouseEvent {
  return new MouseEvent(kind, { bubbles: true, cancelable: true });
}

let executed: string[] = [];

function registerFixture(cmd: Command): void {
  commandRegistry.register(cmd);
}

describe('command palette', () => {
  let parent: HTMLElement;
  let view: EditorView;
  let viewDestroyed = false;

  beforeAll(() => {
    registerFixture({
      id: 'fmt-bold',
      label: '加粗',
      icon: 'B',
      group: '格式',
      keyBinding: 'Mod-b',
      execute: () => executed.push('fmt-bold'),
    });
    registerFixture({
      id: 'fmt-italic',
      label: '斜体',
      group: '格式',
      execute: () => executed.push('fmt-italic'),
    });
    registerFixture({
      id: 'blk-quote',
      label: '引用',
      group: '块',
      execute: () => executed.push('blk-quote'),
    });
    registerFixture({
      id: 'view-source',
      label: '源码模式',
      group: '视图',
      execute: () => {},
    });
    registerFixture({
      id: 'misc-one',
      label: '无分组命令',
      execute: () => {},
    });
  });

  beforeEach(() => {
    installPolyfills();
    executed = [];
    parent = document.createElement('div');
    document.body.appendChild(parent);
    view = createMarkdownEditor(parent, { extensions: [commandPaletteKeymap()] }).view;
  });

  afterEach(() => {
    if (!viewDestroyed) view.destroy();
    viewDestroyed = false;
    elements(`${PANEL}, ${BACKDROP}`).forEach((el) => el.remove());
    parent.remove();
  });

  it('opens a full-viewport backdrop and a viewport-centered panel on document.body', () => {
    expect(openCommandPalette(view)).toBe(true);

    const panel = mustEl(PANEL);
    const backdrop = mustEl(BACKDROP);

    expect(panel.classList.contains('mdb-command-palette')).toBe(true);
    expect(panel.style.position).toBe('fixed');
    expect(panel.style.left).toBe('50%');
    expect(panel.style.top).toBe('50%');
    expect(panel.style.transform).toContain('translate(-50%');

    expect(backdrop.classList.contains('mdb-palette-backdrop')).toBe(true);
    expect(backdrop.style.position).toBe('fixed');
    expect(backdrop.style.top).toBe('0px');
    expect(backdrop.style.left).toBe('0px');
    expect(backdrop.style.background).toBe('rgba(0, 0, 0, 0.45)');

    // Appended to document.body, never nested inside the editor DOM.
    expect(view.dom.contains(panel)).toBe(false);
    expect(panel.parentElement).toBe(document.body);
    expect(backdrop.parentElement).toBe(document.body);
  });

  it('renders a Chinese search input and an explicit close button', () => {
    openCommandPalette(view);
    const input = mustEl(INPUT);
    const close = mustEl(CLOSE);

    expect(input.getAttribute('placeholder')).toBe('输入命令…（支持拼音首字母，如 jc = 加粗）');
    expect(close.tagName).toBe('BUTTON');
    expect(close.getAttribute('aria-label')).toBe('关闭');
    expect(close.textContent).toBe('×');
  });

  it('groups commands by group and shows a kbd chip when a key binding exists', () => {
    openCommandPalette(view);

    const groupNames = elements('.mdb-palette-group').map((el) => el.textContent);
    expect(groupNames).toContain('格式');
    expect(groupNames).toContain('块');
    expect(groupNames).toContain('视图');
    expect(groupNames).toContain('其他');

    const boldRow = elements(ITEMS).find((el) => el.textContent?.includes('加粗'));
    expect(boldRow).toBeDefined();
    expect(boldRow?.querySelector('kbd')?.textContent).toBe('Mod-b');
  });

  it('renders one header per group with its rows contiguous, in canonical order', () => {
    openCommandPalette(view);
    const list = document.querySelector('.mdb-palette-list');
    if (!(list instanceof HTMLElement)) throw new Error('missing palette list');

    // Walk the list DOM in order and bucket rows under the header that owns
    // them: a row belongs to the most recently emitted header.
    const blocks: { group: string; labels: string[] }[] = [];
    for (const child of Array.from(list.children)) {
      if (!(child instanceof HTMLElement)) continue;
      if (child.classList.contains('mdb-palette-group')) {
        blocks.push({ group: child.textContent ?? '', labels: [] });
      } else if (child.classList.contains('mdb-palette-item')) {
        const label = child.children[1]?.textContent ?? '';
        blocks[blocks.length - 1]?.labels.push(label);
      }
    }

    expect(blocks.map((b) => b.group)).toEqual(['格式', '块', '插入', '视图', '体检', '其他']);

    // Exactly one 插入 header, and its rows are exactly the 插入-group
    // commands, in registry order.
    const insertBlocks = blocks.filter((b) => b.group === '插入');
    expect(insertBlocks).toHaveLength(1);
    expect(insertBlocks[0].labels).toEqual([
      '插入链接',
      '插入表格',
      '插入标注',
      '插入 HTML',
      '插入 CSS',
    ]);

    // No 插入-group row may leak under any other group's header.
    for (const block of blocks) {
      if (block.group === '插入') continue;
      for (const label of block.labels) {
        expect(label.startsWith('插入'), `${label} leaked under ${block.group}`).toBe(false);
      }
    }
  });

  it('Escape pressed in the search input closes the palette', () => {
    openCommandPalette(view);
    mustEl(INPUT).dispatchEvent(key('Escape'));

    expect(document.querySelector(PANEL)).toBeNull();
    expect(document.querySelector(BACKDROP)).toBeNull();
  });

  it('mousedown on the backdrop closes the palette', () => {
    openCommandPalette(view);
    mustEl(BACKDROP).dispatchEvent(mouse('mousedown'));

    expect(document.querySelector(PANEL)).toBeNull();
  });

  it('clicking the close button closes the palette', () => {
    openCommandPalette(view);
    mustEl(CLOSE).dispatchEvent(mouse('click'));

    expect(document.querySelector(PANEL)).toBeNull();
    expect(document.querySelector(BACKDROP)).toBeNull();
  });

  it('ArrowDown / ArrowUp move the selection from the input', () => {
    openCommandPalette(view);
    expect(elements(ITEMS)[0].getAttribute('data-selected')).toBe('true');

    mustEl(INPUT).dispatchEvent(key('ArrowDown'));
    expect(elements(ITEMS)[1].getAttribute('data-selected')).toBe('true');
    expect(elements(ITEMS)[0].getAttribute('data-selected')).toBeNull();

    mustEl(INPUT).dispatchEvent(key('ArrowUp'));
    expect(elements(ITEMS)[0].getAttribute('data-selected')).toBe('true');
    expect(elements(ITEMS)[1].getAttribute('data-selected')).toBeNull();
  });

  it('filters with pinyin initials and applies the selection on Enter', () => {
    openCommandPalette(view);
    const input = mustInput(INPUT);
    input.value = 'jc'; // 加粗 -> jia cu
    input.dispatchEvent(new Event('input', { bubbles: true }));

    // Both the canonical 加粗 and the same-labelled fixture match: the palette
    // must return every match, not collapse them (no label-keyed de-dup).
    const rows = elements(ITEMS);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.textContent?.includes('加粗'))).toBe(true);
    expect(rows[0].getAttribute('data-selected')).toBe('true');

    mustEl(INPUT).dispatchEvent(key('Enter'));
    // The first match (toggle-bold, built-in) is selected by default; its execute
    // wraps the empty document with ** → **** and places the caret at position 2.
    expect(view.state.doc.toString()).toBe('****');
    expect(view.state.selection.main.head).toBe(2);
    expect(document.querySelector(PANEL)).toBeNull();
  });

  it('renders the Chinese empty state when nothing matches', () => {
    openCommandPalette(view);
    const input = mustInput(INPUT);
    input.value = 'zzzzz';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    expect(elements(ITEMS)).toHaveLength(0);
    expect(document.body.textContent).toContain('未找到匹配命令');
  });

  it('auto-closes on doc change and removes both nodes on view destroy', () => {
    openCommandPalette(view);
    view.dispatch({ changes: { from: 0, insert: 'x' } });
    expect(document.querySelector(PANEL)).toBeNull();
    expect(document.querySelector(BACKDROP)).toBeNull();

    openCommandPalette(view);
    view.destroy();
    viewDestroyed = true;
    expect(document.querySelector(PANEL)).toBeNull();
    expect(document.querySelector(BACKDROP)).toBeNull();
  });

  it('Mod-k toggles the palette from the editor content DOM', () => {
    // CM6 resolves `Mod-` to Meta on macOS and Ctrl elsewhere (jsdom reports an
    // empty platform), so the synthetic event must carry the same modifier.
    const mod = /Mac/.test(navigator.platform) ? { metaKey: true } : { ctrlKey: true };
    view.contentDOM.dispatchEvent(key('k', mod));
    const panel = document.querySelector(PANEL);
    expect(panel).not.toBeNull();

    view.contentDOM.dispatchEvent(key('k', mod));
    expect(document.querySelector(PANEL)).toBeNull();
  });

  it('command functions return false while the palette is closed', () => {
    expect(paletteApply(view)).toBe(false);
    expect(paletteSelectNext(view)).toBe(false);
    expect(paletteSelectPrev(view)).toBe(false);
    expect(paletteClose(view)).toBe(false);
    expect(closeCommandPalette(view)).toBe(false);
  });

  it('returns every matching command, even when two share a label', () => {
    registerFixture({
      id: 'keep-first',
      label: '保留测试项',
      group: '格式',
      execute: () => executed.push('keep-first'),
    });
    registerFixture({
      id: 'keep-second',
      label: '保留测试项',
      group: '格式',
      keyBinding: 'Mod-d',
      execute: () => executed.push('keep-second'),
    });

    openCommandPalette(view);
    const input = mustInput(INPUT);
    input.value = '保留测试项';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    const rows = elements(ITEMS);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.children[1]?.textContent === '保留测试项')).toBe(true);
  });
});
