import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { EditorView } from '@codemirror/view';
import { createMarkdownEditor } from '../src/editor';
import { commandRegistry, type Command } from '../src/commands';
import { formatKeyChord } from '../src/keybindings';
import { markUsed } from '../src/command-palette-search';
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
const GROUPS = '.mdb-palette-group';
const CHIPS = '[data-testid="command-palette-chip"]';
const FOOTER = '[data-testid="command-palette-footer"]';
const EMPTY = '[data-testid="command-palette-empty"]';
const SUGGESTION = '[data-testid="command-palette-suggestion"]';
const ACCENT = '[data-testid="command-palette-accent"]';
const DESC = '[data-testid="command-palette-desc"]';

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

/** Type into the palette search box and let the synchronous re-render settle. */
function typeQuery(text: string): void {
  const input = mustInput(INPUT);
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
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

    const groupNames = elements(GROUPS).map((el) => el.textContent);
    expect(groupNames).toContain('格式');
    expect(groupNames).toContain('块');
    expect(groupNames).toContain('视图');
    expect(groupNames).toContain('其他');

    const boldRow = elements(ITEMS).find((el) => el.textContent?.includes('加粗'));
    expect(boldRow).toBeDefined();
    // jsdom has empty platform → non-mac formatting
    expect(boldRow?.querySelector('kbd')?.textContent).toBe(formatKeyChord('Mod-b', false));
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

    // A leading 最近 section may exist if a prior test executed a command; the
    // canonical group sequence must still follow in order.
    const groupSequence = blocks.map((b) => b.group).filter((g) => g !== '最近');
    expect(groupSequence).toEqual(['格式', '块', '插入', '视图', '体检', '其他']);

    const insertBlocks = blocks.filter((b) => b.group === '插入');
    expect(insertBlocks).toHaveLength(1);
    expect(insertBlocks[0].labels).toEqual([
      '插入链接',
      '插入表格',
      '插入标注',
      '插入 HTML',
      '插入 CSS',
    ]);

    for (const block of blocks) {
      if (block.group === '插入') continue;
      for (const label of block.labels) {
        expect(label.startsWith('插入'), `${label} leaked under ${block.group}`).toBe(false);
      }
    }
  });

  it('renders the results list as a single vertical flex column, not a grid', () => {
    openCommandPalette(view);
    const list = mustEl('.mdb-palette-list');

    expect(list.style.display).toBe('flex');
    expect(list.style.flexDirection).toBe('column');
    // The previous grid baked in `repeat(auto-fill, minmax(190px,1fr))` — it must be gone.
    expect(list.style.gridTemplateColumns).toBe('');

    const rows = elements(ITEMS);
    expect(rows.length).toBeGreaterThan(1);
    for (const row of rows) expect(row.parentElement).toBe(list);
  });

  it('renders sticky group headers', () => {
    openCommandPalette(view);
    const header = mustEl(GROUPS);
    expect(header.style.position).toBe('sticky');
    expect(header.style.top).toBe('0px');
  });

  it('renders a one-line description column for built-in commands', () => {
    openCommandPalette(view);
    const described = elements(ITEMS).find(
      (el) => (el.querySelector(DESC)?.textContent ?? '').length > 0,
    );
    expect(described).toBeDefined();
    expect(described?.textContent).toContain('加粗');
    expect(described?.querySelector(DESC)?.textContent).toBe('将选中文本设为加粗');
  });

  it('wraps the matched characters of a pinyin hit in <b>', () => {
    openCommandPalette(view);
    typeQuery('jc'); // 加粗 -> jia cu

    const row = elements(ITEMS).find((el) => el.textContent?.includes('加粗'));
    expect(row).toBeDefined();
    const marks = row?.querySelectorAll('.mdb-palette-label b');
    expect(marks?.length).toBe(2);
    expect(Array.from(marks ?? []).map((m) => m.textContent).join('')).toBe('加粗');
  });

  it('marks the selected row with a class, data attribute, and 2px accent bar', () => {
    openCommandPalette(view);
    const rows = elements(ITEMS);

    expect(rows[0].classList.contains('mdb-palette-item--selected')).toBe(true);
    expect(rows[0].getAttribute('data-selected')).toBe('true');
    const accent = rows[0].querySelector(ACCENT);
    expect(accent).not.toBeNull();
    expect((accent as HTMLElement).style.width).toBe('2px');
    expect((accent as HTMLElement).style.background).toContain('var(--mdb-primary)');
    expect(rows[1].querySelector(ACCENT)).toBeNull();
  });

  it('shows a footer shortcut-hint bar', () => {
    openCommandPalette(view);
    const footer = mustEl(FOOTER);
    expect(footer.textContent).toContain('选择');
    expect(footer.textContent).toContain('执行');
    expect(footer.textContent).toContain('关闭');
  });

  it('renders category chips and filters the list by group', () => {
    openCommandPalette(view);
    const chips = elements(CHIPS);
    expect(chips.map((c) => c.textContent)).toEqual(['全部', '格式', '块', '插入', '视图', '体检']);

    chips.find((c) => c.textContent === '体检')?.dispatchEvent(mouse('click'));

    // Clicking re-renders the chip bar, so re-query rather than inspecting the
    // now-detached original chip.
    const activeChip = elements(CHIPS).find((c) => c.textContent === '体检');
    expect(activeChip?.classList.contains('mdb-palette-chip--active')).toBe(true);
    expect(elements(ITEMS).some((el) => el.textContent?.includes('结构体检'))).toBe(true);
    expect(elements(ITEMS).some((el) => el.textContent?.includes('加粗'))).toBe(false);
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
    typeQuery('jc'); // 加粗 -> jia cu

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

  it('renders the Chinese empty state with dismissible suggestion chips', () => {
    openCommandPalette(view);
    typeQuery('zzzzz');

    expect(elements(ITEMS)).toHaveLength(0);
    expect(mustEl(EMPTY).textContent).toContain('未找到匹配命令');

    const suggestions = elements(SUGGESTION);
    expect(suggestions.length).toBeGreaterThanOrEqual(3);
    expect(suggestions.map((s) => s.textContent)).toEqual(['表格', 'jc', '标题']);

    // Clicking a suggestion prefills the query and re-runs the search.
    suggestions.find((s) => s.textContent === '表格')?.dispatchEvent(mouse('click'));
    expect(mustInput(INPUT).value).toBe('表格');
    expect(elements(ITEMS).some((el) => el.textContent?.includes('插入表格'))).toBe(true);

    // A fresh nonsense query is dismissible via Escape.
    typeQuery('zzzzz');
    mustEl(INPUT).dispatchEvent(key('Escape'));
    expect(document.querySelector(PANEL)).toBeNull();
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
    typeQuery('保留测试项');

    const rows = elements(ITEMS);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.children[1]?.textContent === '保留测试项')).toBe(true);
  });

  it('hoists a 最近 section to the top for an unfiltered browse', () => {
    markUsed('fmt-bold');
    openCommandPalette(view);

    const groupNames = elements(GROUPS).map((el) => el.textContent);
    expect(groupNames[0]).toBe('最近');

    const recentHeader = elements(GROUPS)[0];
    const recentRow = recentHeader.nextElementSibling as HTMLElement | null;
    expect(recentRow?.textContent).toContain('加粗');
  });

  it('every built-in command carries a one-line description', () => {
    const described = commandRegistry.all().filter((c) => c.description);
    expect(described.length).toBeGreaterThanOrEqual(50);
    expect(commandRegistry.all().find((c) => c.id === 'toggle-bold')?.description).toBe(
      '将选中文本设为加粗',
    );
    expect(commandRegistry.all().find((c) => c.id === 'insert-table')?.description).toBe(
      '插入表格',
    );
  });
});
