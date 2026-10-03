/**
 * Block handle DOM factory and theme — issue #189.
 *
 * Keeps `block-handle.ts` under the module-size ceiling: this file owns the
 * static DOM (handle, menu, insertion line) and the base theme, while
 * `block-handle.ts` owns the interaction ViewPlugin. Not a public entry —
 * `block-handle.ts` is the single import surface.
 */
import { EditorView } from '@codemirror/view';
import type { BlockConvertTarget } from './block-handle-ops';
import { commandRegistry } from './commands';
import {
  renderIcon,
  HANDLE_DEFAULT_ICON,
  CONVERT_ICON_NAME,
  ACTION_ICON_NAME,
} from './icons';

export const HANDLE_CLASS = 'mdb-block-handle';
export const MENU_CLASS = 'mdb-block-handle-menu';
export const ITEM_CLASS = 'mdb-block-handle-item';
export const INSERT_LINE_CLASS = 'block-insert-line';

interface MenuAction {
  readonly label: string;
  readonly icon: string;
  readonly convert?: BlockConvertTarget;
  readonly action?: 'duplicate' | 'delete' | 'move-up' | 'move-down';
}

/** Menu rows: the 转换为 group first, then move/copy/delete. */
const MENU_ACTIONS: readonly MenuAction[] = [
  { label: '一级标题', icon: CONVERT_ICON_NAME['h1'], convert: 'h1' },
  { label: '二级标题', icon: CONVERT_ICON_NAME['h2'], convert: 'h2' },
  { label: '三级标题', icon: CONVERT_ICON_NAME['h3'], convert: 'h3' },
  { label: '四级标题', icon: CONVERT_ICON_NAME['h4'], convert: 'h4' },
  { label: '五级标题', icon: CONVERT_ICON_NAME['h5'], convert: 'h5' },
  { label: '六级标题', icon: CONVERT_ICON_NAME['h6'], convert: 'h6' },
  { label: '正文', icon: CONVERT_ICON_NAME['paragraph'], convert: 'paragraph' },
  { label: '上移', icon: ACTION_ICON_NAME['move-up'], action: 'move-up' },
  { label: '下移', icon: ACTION_ICON_NAME['move-down'], action: 'move-down' },
  { label: '复制块', icon: ACTION_ICON_NAME['duplicate'], action: 'duplicate' },
  { label: '删除块', icon: ACTION_ICON_NAME['delete'], action: 'delete' },
];

/**
 * Registry command id backing a 转换为 row, or null for rows with no command.
 * Headings are `heading-${level}` (registered with Mod-Alt-<level> in #291);
 * 正文 and the structural actions have no registry command yet, so no chord.
 */
function registryCommandId(entry: MenuAction): string | null {
  return entry.convert !== undefined && /^h[1-6]$/.test(entry.convert)
    ? `heading-${entry.convert.slice(1)}`
    : null;
}

export function createHandle(): HTMLElement {
  const handle = document.createElement('div');
  handle.className = HANDLE_CLASS;
  handle.setAttribute('data-testid', 'block-handle');
  handle.title = '拖拽重排 · 点击打开菜单';
  handle.setAttribute('data-icon', HANDLE_DEFAULT_ICON);
  handle.replaceChildren(renderIcon(HANDLE_DEFAULT_ICON));
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
    // Icon is aria-hidden so the button's accessible name stays exactly the
    // label (role/name queries in tests and assistive tech rely on it).
    const icon = document.createElement('span');
    icon.className = 'mdb-block-handle-item-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.replaceChildren(renderIcon(entry.icon));
    const label = document.createElement('span');
    label.className = 'mdb-block-handle-item-label';
    label.textContent = entry.label;
    item.append(icon, label);
    const commandId = registryCommandId(entry);
    const keyBinding = commandId === null ? null : commandRegistry.getKeyBinding(commandId);
    if (keyBinding !== null) {
      const kbd = document.createElement('kbd');
      kbd.className = 'mdb-block-handle-item-kbd';
      kbd.textContent = keyBinding;
      // The chord is also exposed accessibly by the command palette; hiding it
      // here keeps this button's accessible name exactly the label (#276).
      kbd.setAttribute('aria-hidden', 'true');
      item.append(kbd);
    }
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
 * Owns the three widget elements and the document-level dismiss guards
 * (Escape and outside mousedown).
 * `hideAll()` is the single "dismissed" transition; the guards bind on the
 * first show and unbind once both the handle and the menu are hidden, so no
 * global listener outlives the widget (issue #189, #238).
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

  setIcon(icon: string): void {
    this.handle.setAttribute('data-icon', icon);
    this.handle.replaceChildren(renderIcon(icon));
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

  private readonly onDocMouseDown = (event: MouseEvent): void => {
    const target = event.target;
    if (target instanceof Node && (this.handle.contains(target) || this.menu.contains(target))) {
      return;
    }
    this.onEscape();
  };

  private syncKeyListener(): void {
    const active = this.handle.style.display !== 'none' || this.menu.style.display !== 'none';
    if (active === this.keyListening) return;
    if (active) {
      document.addEventListener('keydown', this.onKeyDown, true);
      document.addEventListener('mousedown', this.onDocMouseDown, true);
    } else {
      document.removeEventListener('keydown', this.onKeyDown, true);
      document.removeEventListener('mousedown', this.onDocMouseDown, true);
    }
    this.keyListening = active;
  }

  private removeKeyListener(): void {
    if (!this.keyListening) return;
    document.removeEventListener('keydown', this.onKeyDown, true);
    document.removeEventListener('mousedown', this.onDocMouseDown, true);
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
    color: 'var(--mdb-text-secondary)',
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
    backgroundColor: 'var(--mdb-bg-secondary)',
    border: `1px solid var(--mdb-border)`,
    borderRadius: '6px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.18)',
    zIndex: '1000',
  },
  '.mdb-block-handle-label': {
    padding: '2px 8px',
    fontSize: '11px',
    color: 'var(--mdb-muted)',
  },
  '.mdb-block-handle-item': {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    textAlign: 'left',
    background: 'transparent',
    border: 'none',
    color: 'var(--mdb-text)',
    padding: '4px 8px',
    cursor: 'pointer',
    fontSize: '13px',
  },
  '.mdb-block-handle-item-icon': {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '16px',
    flexShrink: '0',
    opacity: '0.7',
    color: 'var(--mdb-text-secondary)',
  },
  '.mdb-block-handle-item-kbd': {
    marginLeft: 'auto',
    flexShrink: '0',
    fontSize: '11px',
    padding: '1px 6px',
    border: `1px solid var(--mdb-border)`,
    borderRadius: '3px',
    color: 'var(--mdb-text-secondary)',
  },
  '.block-insert-line': {
    position: 'absolute',
    display: 'none',
    left: '0',
    right: '0',
    height: '2px',
    backgroundColor: 'var(--mdb-primary)',
    pointerEvents: 'none',
    zIndex: '4',
  },
});
