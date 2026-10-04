import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMarkdownEditor } from '../src/editor';
import {
  defaultCommands,
  insertSlashChar,
  slashKeymap,
  slashMenuApply,
  slashMenuClose,
  slashMenuSelectNext,
  slashMenuSelectPrev,
  slashMenuSubmenuBack,
  slashMenuSubmenuEnter,
} from '../src/slash';
import { commandRegistry } from '../src/commands';

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

describe('slash commands', () => {
  let parent: HTMLElement;
  let view: ReturnType<typeof createMarkdownEditor>['view'];

  beforeEach(() => {
    installPolyfills();
    parent = document.createElement('div');
    document.body.appendChild(parent);
    // Wire through the real consumer seam; defaultKeymap is added by
    // createMarkdownEditor, so this also exercises binding precedence.
    view = createMarkdownEditor(parent, {
      extensions: [slashKeymap()],
    }).view;
  });

  afterEach(() => {
    view.destroy();
    parent.remove();
  });

  /** Simulate real typing at the caret: the chars land in the document. */
  function typeText(text: string): void {
    const head = view.state.selection.main.head;
    view.dispatch({
      changes: { from: head, insert: text },
      selection: { anchor: head + text.length },
    });
  }

  /** Simulate backspace at the caret. */
  function backspace(): void {
    const head = view.state.selection.main.head;
    view.dispatch({ changes: { from: head - 1, to: head }, selection: { anchor: head - 1 } });
  }

  /**
   * Caret-driven dismissal is deferred to a microtask (CM6 forbids a dispatch
   * from inside a plugin update), so tests must drain the queue before
   * asserting on the document. Microtasks are FIFO, so one await is enough.
   */
  async function flushDismiss(): Promise<void> {
    await Promise.resolve();
  }

  it('typing "/" inserts the slash and opens the icon-grid menu', () => {
    const inserted = insertSlashChar(view);
    expect(inserted).toBe(true);
    expect(view.state.doc.toString()).toBe('/');
    expect(view.dom.querySelector('.mdb-slash-menu')).not.toBeNull();
    const grid = view.dom.querySelector('.mdb-slash-grid-menu');
    expect(grid).not.toBeNull();
    expect(view.dom.querySelectorAll('.mdb-slash-grid-menu .mdb-slash-item').length).toBe(11)
  });

  it('positions the menu relative to the editor origin, not the viewport (issue #203)', () => {
    // Regression lock for #203: coordsAtPos returns VIEWPORT coordinates, but
    // the menu is an absolutely positioned child of view.dom. Writing viewport
    // coords straight into left/top offsets the menu by the editor's page
    // origin. The bug is invisible unless the two origins differ, so both are
    // stubbed here with deliberately different origins.
    vi.spyOn(view, 'coordsAtPos').mockReturnValue({
      left: 456,
      right: 470,
      top: 370,
      bottom: 399,
    });
    vi.spyOn(view.dom, 'getBoundingClientRect').mockReturnValue(new DOMRect(220, 122, 800, 600));

    insertSlashChar(view);

    const menu = view.dom.querySelector<HTMLElement>('.mdb-slash-menu');
    expect(menu).not.toBeNull();
    // Expected: 456 - 220 = 236; 399 + 4 - 122 = 281.
    expect(menu?.style.left).toBe('236px');
    expect(menu?.style.top).toBe('281px');
  });

  it('applying the heading row opens the H1–H6 flyout beside the root grid, and choosing a level inserts it', () => {
    insertSlashChar(view);
    // Heading is a submenu opener: applying it opens the second level in a
    // flyout while the root grid stays rendered.
    expect(slashMenuApply(view)).toBe(true);
    expect(view.state.doc.toString()).toBe('/');
    expect(view.dom.querySelectorAll('.mdb-slash-grid-menu .mdb-slash-item').length).toBe(11)

    const flyout = view.dom.querySelector('.mdb-slash-flyout');
    expect(flyout).not.toBeNull();
    const flyoutRows = view.dom.querySelectorAll('.mdb-slash-flyout-item');
    expect(flyoutRows.length).toBe(6);
    expect(flyoutRows[0].textContent).toContain('1 级标题');
    expect(flyoutRows[5].textContent).toContain('6 级标题');

    slashMenuSelectNext(view); // H1 -> H2 (flyout selection)
    slashMenuApply(view);
    expect(view.state.doc.toString()).toBe('## ');
    expect(view.dom.querySelector('.mdb-slash-menu')).toBeNull();
    expect(view.dom.querySelector('.mdb-slash-flyout')).toBeNull();
    expect(view.state.selection.main.head).toBe(view.state.doc.length);
  });

  it('applying the callout command opens the type flyout and inserts the chosen type', () => {
    insertSlashChar(view);
    // Rows are grouped; locate 标注 rather than relying on a fixed index.
    const rowIndex = Array.from(view.dom.querySelectorAll<HTMLElement>('.mdb-slash-item')).findIndex(
      (row) => row.textContent?.includes('标注'),
    );
    for (let i = 0; i < rowIndex; i++) slashMenuSelectNext(view);
    slashMenuApply(view);
    // 标注 is a type flyout opener (#288): the first child is 注释 (note).
    expect(view.dom.querySelector('.mdb-slash-flyout')).not.toBeNull();
    expect(slashMenuApply(view)).toBe(true);
    const doc = view.state.doc.toString();
    expect(doc).toContain('> [!NOTE]');
    expect(doc).toMatch(/^> \[!NOTE\]\n> $/);
  });

  it('labels the callout slash command in Chinese', () => {
    const callout = defaultCommands.find((c) => c.id === 'callout');
    expect(callout?.label).toBe('标注');
    expect(callout?.hint).toBe('> [!NOTE]');
  });

  it('the table row opens an N × M grid and inserts a GFM table on pick', () => {
    insertSlashChar(view);
    const rows = Array.from(view.dom.querySelectorAll<HTMLElement>('.mdb-slash-item'));
    const tableIdx = rows.findIndex((row) => row.textContent?.includes('表格'));
    for (let i = 0; i < tableIdx; i++) slashMenuSelectNext(view);
    slashMenuApply(view);

    // The table row opens the grid instead of inserting directly.
    expect(view.state.doc.toString()).toBe('/');
    expect(view.dom.querySelectorAll('.mdb-slash-grid-cell').length).toBe(100);

    const cell = view.dom.querySelector<HTMLElement>('.mdb-slash-grid-cell[data-r="3"][data-c="7"]');
    expect(cell).not.toBeNull();
    cell!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));

    const doc = view.state.doc.toString();
    expect(doc).toContain('| A | B | C | D | E | F | G |');
    expect(doc.split('\n').length).toBe(5); // header + separator + 3 body rows
  });

  it('the table grid keeps the root grid visible and lives inside the flyout layer', () => {
    insertSlashChar(view)
    const rows = Array.from(view.dom.querySelectorAll<HTMLElement>('.mdb-slash-item'))
    const tableIdx = rows.findIndex((row) => row.textContent?.includes('表格'))
    for (let i = 0; i < tableIdx; i++) slashMenuSelectNext(view)
    slashMenuApply(view)

    expect(view.dom.querySelectorAll('.mdb-slash-grid-menu .mdb-slash-item').length).toBe(11)
    const flyout = view.dom.querySelector('.mdb-slash-flyout')
    expect(flyout).not.toBeNull()
    expect(flyout!.querySelectorAll('.mdb-slash-grid-cell').length).toBe(100)
  })

  it('Enter on a hovered table cell inserts that size', () => {
    insertSlashChar(view)
    const rows = Array.from(view.dom.querySelectorAll<HTMLElement>('.mdb-slash-item'))
    const tableIdx = rows.findIndex((row) => row.textContent?.includes('表格'))
    for (let i = 0; i < tableIdx; i++) slashMenuSelectNext(view)
    slashMenuApply(view)

    const cell = view.dom.querySelector<HTMLElement>('.mdb-slash-grid-cell[data-r="3"][data-c="7"]')
    expect(cell).not.toBeNull()
    cell!.dispatchEvent(new MouseEvent('mouseenter'))

    // Enter must apply the hovered size instead of falling through to a newline.
    expect(slashMenuApply(view)).toBe(true)
    const doc = view.state.doc.toString()
    expect(doc).toContain('| A | B | C | D | E | F | G |')
    expect(doc.split('\n').length).toBe(5)
    expect(view.dom.querySelector('.mdb-slash-menu')).toBeNull()
    expect(view.dom.querySelector('.mdb-slash-flyout')).toBeNull()
  })

  it('the 分栏 row opens a five-option flyout that inserts a complete column div', () => {
    insertSlashChar(view)
    const rows = Array.from(view.dom.querySelectorAll<HTMLElement>('.mdb-slash-item'))
    const colIdx = rows.findIndex((row) => row.textContent?.includes('分栏'))
    expect(colIdx).toBeGreaterThanOrEqual(0)
    for (let i = 0; i < colIdx; i++) slashMenuSelectNext(view)
    slashMenuApply(view)

    expect(view.state.doc.toString()).toBe('/')
    expect(view.dom.querySelectorAll('.mdb-slash-grid-menu .mdb-slash-item').length).toBe(11)
    const flyoutRows = view.dom.querySelectorAll('.mdb-slash-flyout-item')
    expect(flyoutRows.length).toBe(5)

    slashMenuSelectNext(view) // 分栏 -> 2 栏
    slashMenuApply(view)

    expect(view.state.doc.toString()).toBe('::: {.col-2}\n\n:::')
    expect(view.dom.querySelector('.mdb-slash-menu')).toBeNull()
    expect(view.dom.querySelector('.mdb-slash-flyout')).toBeNull()
  })

  it('分栏 is reachable by pinyin because 栏 is in the PINYIN map', () => {
    insertSlashChar(view)
    typeText('fenlan')
    const cells = () => view.dom.querySelectorAll('.mdb-slash-grid-menu .mdb-slash-item')
    expect(cells().length).toBe(1)
    expect(cells()[0].textContent).toContain('分栏')
  })

  it('Escape during the table grid clears both layers and the trigger (no residue)', () => {
    insertSlashChar(view)
    const rows = Array.from(view.dom.querySelectorAll<HTMLElement>('.mdb-slash-item'))
    const tableIdx = rows.findIndex((row) => row.textContent?.includes('表格'))
    for (let i = 0; i < tableIdx; i++) slashMenuSelectNext(view)
    slashMenuApply(view)
    expect(view.dom.querySelector('.mdb-slash-flyout')).not.toBeNull()

    expect(slashMenuClose(view)).toBe(true)
    expect(view.dom.querySelector('.mdb-slash-menu')).toBeNull()
    expect(view.dom.querySelector('.mdb-slash-flyout')).toBeNull()
    expect(view.state.doc.toString()).toBe('')
  })

  it('a mousedown outside the menu clears a table grid too (no residue)', () => {
    insertSlashChar(view)
    const rows = Array.from(view.dom.querySelectorAll<HTMLElement>('.mdb-slash-item'))
    const tableIdx = rows.findIndex((row) => row.textContent?.includes('表格'))
    for (let i = 0; i < tableIdx; i++) slashMenuSelectNext(view)
    slashMenuApply(view)

    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(view.dom.querySelector('.mdb-slash-menu')).toBeNull()
    expect(view.dom.querySelector('.mdb-slash-flyout')).toBeNull()
    expect(view.state.doc.toString()).toBe('')
  })

  it('moving the caret away during a table grid clears both layers (no residue)', async () => {
    typeText('before ')
    insertSlashChar(view)
    const rows = Array.from(view.dom.querySelectorAll<HTMLElement>('.mdb-slash-item'))
    const tableIdx = rows.findIndex((row) => row.textContent?.includes('表格'))
    for (let i = 0; i < tableIdx; i++) slashMenuSelectNext(view)
    slashMenuApply(view)
    expect(view.dom.querySelector('.mdb-slash-flyout')).not.toBeNull()

    view.dispatch({ selection: { anchor: 0 } })
    await flushDismiss()
    expect(view.dom.querySelector('.mdb-slash-menu')).toBeNull()
    expect(view.dom.querySelector('.mdb-slash-flyout')).toBeNull()
    expect(view.state.doc.toString()).toBe('before ')
  })

  it('Escape dismisses the menu and takes the trigger with it (no residue)', () => {
    insertSlashChar(view);
    typeText('b');
    const closed = slashMenuClose(view);
    expect(closed).toBe(true);
    expect(view.dom.querySelector('.mdb-slash-menu')).toBeNull();
    expect(view.state.doc.toString()).toBe('');
    expect(view.state.selection.main.head).toBe(0);
  });

  it('Escape returns false and leaves the document alone when no menu is open', () => {
    typeText('plain text');
    expect(slashMenuClose(view)).toBe(false);
    expect(view.state.doc.toString()).toBe('plain text');
  });

  it('a mousedown outside the menu dismisses it and removes the trigger text', () => {
    insertSlashChar(view);
    typeText('b');
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(view.dom.querySelector('.mdb-slash-menu')).toBeNull();
    expect(view.state.doc.toString()).toBe('');
  });

  it('a mousedown on the menu itself keeps it open', () => {
    insertSlashChar(view);
    const item = view.dom.querySelector<HTMLElement>('.mdb-slash-item');
    expect(item).not.toBeNull();
    item!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(view.dom.querySelector('.mdb-slash-menu')).not.toBeNull();
    expect(view.state.doc.toString()).toBe('/');
  });

  it('moving the caret away from the trigger dismisses the menu (no residue)', async () => {
    typeText('before ');
    insertSlashChar(view);
    typeText('b');
    // Assert the menu actually opened: a mid-word "/" would be refused by
    // insertSlashChar, which would make every assertion below vacuous.
    expect(view.dom.querySelector('.mdb-slash-menu')).not.toBeNull();
    view.dispatch({ selection: { anchor: 0 } });
    await flushDismiss();
    expect(view.dom.querySelector('.mdb-slash-menu')).toBeNull();
    expect(view.state.doc.toString()).toBe('before ');
  });

  it('moving the caret to another line takes the trigger but not the surrounding text', async () => {
    typeText('first\n');
    insertSlashChar(view);
    typeText('b');
    expect(view.dom.querySelector('.mdb-slash-menu')).not.toBeNull();
    view.dispatch({ selection: { anchor: 0 } });
    await flushDismiss();
    expect(view.dom.querySelector('.mdb-slash-menu')).toBeNull();
    expect(view.state.doc.toString()).toBe('first\n');
  });

  it('moving the caret past text that predates the trigger never deletes that text', async () => {
    typeText('XY');
    view.dispatch({ selection: { anchor: 0 } });
    insertSlashChar(view);
    typeText('b');
    expect(view.state.doc.toString()).toBe('/bXY');
    view.dispatch({ selection: { anchor: 3 } });
    await flushDismiss();
    expect(view.dom.querySelector('.mdb-slash-menu')).toBeNull();
    expect(view.state.doc.toString()).toBe('XY');
  });

  it('a second consecutive "/" while the menu is open does not double-insert', () => {
    insertSlashChar(view);
    const second = insertSlashChar(view);
    expect(second).toBe(false);
    expect(view.dom.querySelector('.mdb-slash-menu')).toBeNull();
    expect(view.state.doc.toString()).toBe('/');
  });

  it('typing filters the root grid instead of closing the menu', () => {
    insertSlashChar(view);
    const cells = () => view.dom.querySelectorAll('.mdb-slash-grid-menu .mdb-slash-item');

    typeText('b');
    expect(view.state.doc.toString()).toBe('/b');
    expect(view.dom.querySelector('.mdb-slash-menu')).not.toBeNull();
    // 标题 / 表格 / 标注 all match pinyin initial b.
    expect(cells().length).toBe(3);
    expect(Array.from(cells()).map((cell) => cell.textContent?.trim())).toEqual(
      expect.arrayContaining([
        expect.stringContaining('标题'),
        expect.stringContaining('表格'),
        expect.stringContaining('标注'),
      ]),
    );

    typeText('t'); // /bt → only 标题
    expect(cells().length).toBe(1);
    expect(cells()[0].textContent).toContain('标题');

    backspace(); // /b
    expect(cells().length).toBe(3);
    backspace(); // /
    expect(cells().length).toBe(11)
  });

  it('shows an empty state for a filter with no match, and a newline closes the menu', () => {
    insertSlashChar(view);
    typeText('zzz');
    expect(view.dom.querySelector('.mdb-slash-menu')).not.toBeNull();
    expect(view.dom.querySelectorAll('.mdb-slash-grid-menu .mdb-slash-item').length).toBe(0);
    expect(view.dom.querySelector('.mdb-slash-empty')).not.toBeNull();

    typeText('\n');
    expect(view.dom.querySelector('.mdb-slash-menu')).toBeNull();
  });

  it('applying a filtered row replaces the slash and the typed query', () => {
    insertSlashChar(view);
    typeText('bt');
    expect(view.state.doc.toString()).toBe('/bt');

    expect(slashMenuApply(view)).toBe(true); // opens the 标题 flyout
    expect(view.dom.querySelectorAll('.mdb-slash-flyout-item').length).toBe(6);
    slashMenuSelectNext(view); // H2
    slashMenuApply(view);

    expect(view.state.doc.toString()).toBe('## ');
    expect(view.state.selection.main.head).toBe(view.state.doc.length);
  });

  it('Enter applies the selected filtered opener row and its chosen type', () => {
    insertSlashChar(view);
    typeText('bz'); // only 标注
    expect(view.dom.querySelectorAll('.mdb-slash-grid-menu .mdb-slash-item').length).toBe(1);

    expect(slashMenuApply(view)).toBe(true); // opens the type flyout
    expect(view.dom.querySelectorAll('.mdb-slash-flyout-item').length).toBe(8);
    expect(slashMenuApply(view)).toBe(true); // applies 注释 (note)
    expect(view.state.doc.toString()).toBe('> [!NOTE]\n> ');
  });

  it('ArrowRight opens the flyout and ArrowLeft closes it while the root grid stays', () => {
    insertSlashChar(view);
    expect(view.dom.querySelectorAll('.mdb-slash-flyout-item').length).toBe(0);

    expect(slashMenuSubmenuEnter(view)).toBe(true);
    expect(view.dom.querySelectorAll('.mdb-slash-flyout-item').length).toBe(6);
    expect(view.dom.querySelectorAll('.mdb-slash-grid-menu .mdb-slash-item').length).toBe(11)

    expect(slashMenuSubmenuBack(view)).toBe(true);
    expect(view.dom.querySelector('.mdb-slash-flyout')).toBeNull();
    expect(view.dom.querySelectorAll('.mdb-slash-grid-menu .mdb-slash-item').length).toBe(11)
    expect(view.state.doc.toString()).toBe('/');
  });

  it('hovering a parent cell opens its flyout', () => {
    insertSlashChar(view);
    const headingCell = Array.from(
      view.dom.querySelectorAll<HTMLElement>('.mdb-slash-grid-menu .mdb-slash-item'),
    ).find((cell) => cell.textContent?.includes('标题'));
    expect(headingCell).toBeDefined();

    headingCell!.dispatchEvent(new MouseEvent('mouseenter'));
    expect(view.dom.querySelectorAll('.mdb-slash-flyout-item').length).toBe(6);
  });

  it('ArrowDown/ArrowUp navigate the selected item', () => {
    insertSlashChar(view);
    const items = () => view.dom.querySelectorAll('.mdb-slash-item');
    expect(items()[0].getAttribute('data-selected')).toBe('true');

    expect(slashMenuSelectNext(view)).toBe(true);
    expect(items()[1].getAttribute('data-selected')).toBe('true');
    expect(items()[0].getAttribute('data-selected')).toBeNull();

    expect(slashMenuSelectPrev(view)).toBe(true);
    expect(items()[0].getAttribute('data-selected')).toBe('true');
    expect(items()[1].getAttribute('data-selected')).toBeNull();
  });

  it('command functions return false when the menu is closed', () => {
    expect(slashMenuApply(view)).toBe(false);
    expect(slashMenuSelectNext(view)).toBe(false);
    expect(slashMenuSelectPrev(view)).toBe(false);
    expect(slashMenuClose(view)).toBe(false);
  });

  it('slash does NOT trigger on a non-empty line', () => {
    // Type some text first.
    view.dispatch({
      changes: { from: 0, insert: 'hello' },
      selection: { anchor: 5 },
    });
    const result = insertSlashChar(view);
    expect(result).toBe(false);
    expect(view.state.doc.toString()).toBe('hello');
    expect(view.dom.querySelector('.mdb-slash-menu')).toBeNull();
  });

  it('slash triggers at the start of an empty line', () => {
    // Empty document — cursor at position 0 (start of empty line).
    const result = insertSlashChar(view);
    expect(result).toBe(true);
    expect(view.state.doc.toString()).toBe('/');
    expect(view.dom.querySelector('.mdb-slash-menu')).not.toBeNull();
  });

  it('slash triggers on a line with only whitespace before cursor', () => {
    view.dispatch({
      changes: { from: 0, insert: '   ' },
      selection: { anchor: 3 },
    });
    const result = insertSlashChar(view);
    expect(result).toBe(true);
    expect(view.dom.querySelector('.mdb-slash-menu')).not.toBeNull();
  });

  it('slash triggers at word start (after space mid-line)', () => {
    view.dispatch({
      changes: { from: 0, insert: 'hello ' },
      selection: { anchor: 6 },
    });
    const result = insertSlashChar(view);
    expect(result).toBe(true);
    expect(view.dom.querySelector('.mdb-slash-menu')).not.toBeNull();
  });

  it('slash does NOT trigger mid-word (immediately after non-whitespace)', () => {
    view.dispatch({
      changes: { from: 0, insert: 'hello' },
      selection: { anchor: 5 },
    });
    const result = insertSlashChar(view);
    expect(result).toBe(false);
    expect(view.dom.querySelector('.mdb-slash-menu')).toBeNull();
  });

  it('slash does NOT trigger after a word followed by more text', () => {
    view.dispatch({
      changes: { from: 0, insert: 'foo bar' },
      selection: { anchor: 5 },
    });
    const result = insertSlashChar(view);
    expect(result).toBe(false);
    expect(view.dom.querySelector('.mdb-slash-menu')).toBeNull();
  });
});

describe('slash registry isolation', () => {
  it('does not register its own command ids into the global registry', () => {
    // The slash menu renders from defaultCommands directly; polluting the
    // shared registry would duplicate palette rows and (for insert-html /
    // insert-css) shadow the canonical cursor-insert commands.
    const slashOnlyIds = ['heading', 'callout', 'image-ref', 'code-block', 'table', 'quote'];
    for (const id of slashOnlyIds) {
      expect(commandRegistry.has(id), `slash-only id ${id} must not be registered`).toBe(false);
    }
  });

  it('leaves insert-html / insert-css to the canonical commands.ts registrations', () => {
    expect(commandRegistry.has('insert-html')).toBe(true);
    expect(commandRegistry.has('insert-css')).toBe(true);
  });
});
