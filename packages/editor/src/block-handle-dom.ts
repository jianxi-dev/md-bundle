/**
 * Block handle DOM factory and theme — issue #189.
 *
 * Keeps `block-handle.ts` under the module-size ceiling: this file owns the
 * static DOM (handle, menu, insertion line) and the base theme, while
 * `block-handle.ts` owns the interaction ViewPlugin. Not a public entry —
 * `block-handle.ts` is the single import surface.
 */
import { EditorView } from '@codemirror/view';
import { getThemeColor } from './theme';
import type { BlockConvertTarget } from './block-handle-ops';

export const HANDLE_CLASS = 'mdb-block-handle';
export const MENU_CLASS = 'mdb-block-handle-menu';
export const ITEM_CLASS = 'mdb-block-handle-item';
export const INSERT_LINE_CLASS = 'block-insert-line';

interface MenuAction {
  readonly label: string;
  readonly convert?: BlockConvertTarget;
  readonly action?: 'duplicate' | 'delete';
}

/** Menu rows: the 转换为 group first, then copy/delete. */
const MENU_ACTIONS: readonly MenuAction[] = [
  { label: '一级标题', convert: 'h1' },
  { label: '二级标题', convert: 'h2' },
  { label: '三级标题', convert: 'h3' },
  { label: '正文', convert: 'paragraph' },
  { label: '复制块', action: 'duplicate' },
  { label: '删除块', action: 'delete' },
];

export function createHandle(): HTMLElement {
  const handle = document.createElement('div');
  handle.className = HANDLE_CLASS;
  handle.setAttribute('data-testid', 'block-handle');
  handle.textContent = '⠿';
  handle.style.display = 'none';
  return handle;
}

export function createMenu(): HTMLElement {
  const menu = document.createElement('div');
  menu.className = MENU_CLASS;
  menu.setAttribute('data-testid', 'block-handle-menu');
  menu.style.display = 'none';

  const groupLabel = document.createElement('div');
  groupLabel.className = 'mdb-block-handle-label';
  groupLabel.textContent = '转换为';
  menu.appendChild(groupLabel);

  for (const entry of MENU_ACTIONS) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = ITEM_CLASS;
    item.textContent = entry.label;
    if (entry.convert) item.setAttribute('data-convert', entry.convert);
    if (entry.action) item.setAttribute('data-action', entry.action);
    menu.appendChild(item);
  }
  return menu;
}

export function createInsertLine(): HTMLElement {
  const line = document.createElement('div');
  line.className = INSERT_LINE_CLASS;
  line.style.display = 'none';
  return line;
}

/**
 * Owns the three widget elements and the document-level Escape guard.
 * `hideAll()` is the single "dismissed" transition; the guard binds on the
 * first show and unbinds once both the handle and the menu are hidden, so no
 * global listener outlives the widget (issue #189).
 */
export class HandleChrome {
  readonly handle: HTMLElement = createHandle();
  readonly menu: HTMLElement = createMenu();
  readonly insertLine: HTMLElement = createInsertLine();
  private keyListening = false;

  constructor(private readonly onEscape: () => void) {}

  mount(parent: HTMLElement): void {
    parent.append(this.handle, this.menu, this.insertLine);
  }

  unmount(): void {
    this.removeKeyListener();
    this.handle.remove();
    this.menu.remove();
    this.insertLine.remove();
  }

  showHandle(): void {
    this.handle.style.display = 'flex';
    this.syncKeyListener();
  }

  showMenu(): void {
    this.menu.style.display = 'block';
    this.handle.style.display = 'flex';
    this.syncKeyListener();
  }

  hideHandle(): void {
    this.handle.style.display = 'none';
    this.syncKeyListener();
  }

  hideMenu(): void {
    this.menu.style.display = 'none';
    this.syncKeyListener();
  }

  showInsertLine(): void {
    this.insertLine.style.display = 'block';
  }

  hideInsertLine(): void {
    this.insertLine.style.display = 'none';
  }

  hideAll(): void {
    this.handle.style.display = 'none';
    this.menu.style.display = 'none';
    this.insertLine.style.display = 'none';
    this.syncKeyListener();
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') this.onEscape();
  };

  private syncKeyListener(): void {
    const active = this.handle.style.display !== 'none' || this.menu.style.display !== 'none';
    if (active === this.keyListening) return;
    if (active) document.addEventListener('keydown', this.onKeyDown, true);
    else document.removeEventListener('keydown', this.onKeyDown, true);
    this.keyListening = active;
  }

  private removeKeyListener(): void {
    if (!this.keyListening) return;
    document.removeEventListener('keydown', this.onKeyDown, true);
    this.keyListening = false;
  }
}

export const blockHandleTheme = EditorView.baseTheme({
  '.mdb-block-handle': {
    position: 'absolute',
    display: 'none',
    alignItems: 'center',
    justifyContent: 'center',
    width: '20px',
    height: '20px',
    cursor: 'grab',
    color: getThemeColor('dark', 'text-secondary'),
    userSelect: 'none',
    zIndex: '5',
  },
  '.mdb-block-handle:hover': {
    backgroundColor: 'rgba(127, 127, 127, 0.18)',
    borderRadius: '4px',
  },
  '.mdb-block-handle-menu': {
    position: 'absolute',
    display: 'none',
    minWidth: '120px',
    padding: '4px',
    backgroundColor: getThemeColor('dark', 'bg-secondary'),
    border: `1px solid ${getThemeColor('dark', 'border')}`,
    borderRadius: '6px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.18)',
    zIndex: '1000',
  },
  '.mdb-block-handle-label': {
    padding: '2px 8px',
    fontSize: '11px',
    color: getThemeColor('dark', 'muted'),
  },
  '.mdb-block-handle-item': {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    background: 'transparent',
    border: 'none',
    color: getThemeColor('dark', 'text'),
    padding: '4px 8px',
    cursor: 'pointer',
    fontSize: '13px',
  },
  '.block-insert-line': {
    position: 'absolute',
    display: 'none',
    left: '0',
    right: '0',
    height: '2px',
    backgroundColor: getThemeColor('dark', 'primary'),
    pointerEvents: 'none',
    zIndex: '4',
  },
});
