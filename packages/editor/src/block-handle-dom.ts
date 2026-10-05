/**
 * Block handle DOM factory and theme — issue #189.
 *
 * Keeps `block-handle.ts` under the module-size ceiling: this file owns the
 * static DOM (handle, menu, insertion line) and the base theme, while
 * `block-handle.ts` owns the interaction ViewPlugin. Not a public entry —
 * `block-handle.ts` is the single import surface.
 */
import { EditorView } from '@codemirror/view';
import { calloutTypeMap } from '@md-bundle/renderer';
import type { BlockConvertTarget } from './block-handle-ops';
import { commandRegistry } from './commands';
import {
  renderIcon,
  HANDLE_DEFAULT_ICON,
  ACTION_ICON_NAME,
} from './icons';

export const HANDLE_CLASS = 'mdb-block-handle';
export const MENU_CLASS = 'mdb-block-handle-menu';
export const ITEM_CLASS = 'mdb-block-handle-item';
export const INSERT_LINE_CLASS = 'block-insert-line';
export const DIMMED_CLASS = 'mdb-block-handle-dimmed';
export const GRID_CLASS = 'mdb-block-handle-grid';
export const GRID_ITEM_CLASS = 'mdb-block-handle-grid-item';
export const FLYOUT_CLASS = 'mdb-block-handle-flyout';
export const FLYOUT_ITEM_CLASS = 'mdb-block-handle-flyout-item';
export const FLYOUT_ATTR = 'data-flyout';
export const FLYOUT_ACTION_ATTR = 'data-flyout-action';
export const CALLOUT_ONLY_ATTR = 'data-callout-only';
export const NON_CALLOUT_ONLY_ATTR = 'data-non-callout-only';
export const TABLE_ONLY_ATTR = 'data-table-only';
export const HANDLE_TYPE_ICON_CLASS = 'mdb-block-type-icon';
export const HANDLE_DRAG_CLASS = 'mdb-drag-handle';

/** Reveal duration (ms) for the handle fade-in. */
const REVEAL_MS = 120;

/**
 * Fade the handle in on reveal. Uses the Web Animations API rather than a CSS
 * `@keyframes` because baseTheme's style-mod spec cannot define keyframes, and
 * an inline `opacity` transition would fight the class-driven dimmed state
 * (`DIMMED_CLASS`). jsdom has no `Element.animate`, so it degrades to an
 * instant reveal there.
 */
function playFadeIn(el: HTMLElement): void {
  el.animate?.([{ opacity: '0' }, { opacity: '1' }], { duration: REVEAL_MS, easing: 'ease-out' });
}

interface MenuConvert {
  readonly label: string;
  readonly icon: string;
  readonly convert: BlockConvertTarget;
}

interface MenuAction {
  readonly label: string;
  readonly icon: string;
  readonly action:
    | 'duplicate'
    | 'delete'
    | 'move-up'
    | 'move-down'
    | 'toggle-header-row'
    | 'toggle-header-col'
    | 'distribute-columns'
    | 'synced-block'
    | 'comment'
    | 'cut'
    | 'translate'
    | 'share'
    | 'copy-link'
    | 'add-below';
  readonly nonCalloutOnly?: boolean;
}

const MENU_CONVERT: readonly MenuConvert[] = [
  { label: '正文', icon: 'TextOutlined', convert: 'paragraph' },
  { label: '一级标题', icon: 'H1Outlined', convert: 'h1' },
  { label: '二级标题', icon: 'H2Outlined', convert: 'h2' },
  { label: '三级标题', icon: 'H3Outlined', convert: 'h3' },
  { label: '有序', icon: 'OrderListOutlined', convert: 'ordered' },
  { label: '无序', icon: 'DisorderListOutlined', convert: 'bullet' },
  { label: '待办', icon: 'TodoOutlined', convert: 'todo' },
  { label: '代码', icon: 'CodeblockOutlined', convert: 'code' },
  { label: '引用', icon: 'ReferenceOutlined', convert: 'quote' },
  { label: '高亮', icon: 'CalloutOutlined', convert: 'callout' },
];

const MENU_ACTIONS: readonly MenuAction[] = [
  { label: '上移', icon: ACTION_ICON_NAME['move-up'], action: 'move-up' },
  { label: '下移', icon: ACTION_ICON_NAME['move-down'], action: 'move-down' },
  { label: '复制', icon: 'CopyOutlined', action: 'duplicate' },
  { label: '删除', icon: ACTION_ICON_NAME['delete'], action: 'delete' },
];

const TABLE_ACTIONS: readonly MenuAction[] = [
  { label: '标题行', icon: 'HeaderRowOutlined', action: 'toggle-header-row' },
  { label: '标题列', icon: 'HeaderColumnOutlined', action: 'toggle-header-col' },
  { label: '均分列宽', icon: 'DistributeColumnsOutlined', action: 'distribute-columns' },
];

const CALLOUT_ACTIONS: readonly MenuAction[] = [
  { label: '同步块', icon: 'LinkRecordOutlined', action: 'synced-block' },
];

const COMMON_ACTIONS: readonly MenuAction[] = [
  { label: '评论', icon: 'AddCommentOutlined', action: 'comment' },
  { label: '剪切', icon: 'FeishuclipOutlined', action: 'cut' },
  { label: '翻译', icon: 'TranslateOutlined', action: 'translate', nonCalloutOnly: true },
  { label: '分享', icon: 'SharewordsOutlined', action: 'share' },
  { label: '复制链接', icon: 'BlocklinkOutlined', action: 'copy-link' },
  { label: '在下方添加', icon: 'NewJoinMeetingOutlined', action: 'add-below' },
];

interface FlyoutOption {
  readonly label: string;
  readonly value: string;
  /** Optional leading glyph (callout types show their emoji). */
  readonly icon?: string;
}

/** 缩进和对齐 flyout — order is asserted verbatim by the #330 e2e. */
const INDENT_ALIGN_OPTIONS: readonly FlyoutOption[] = [
  { label: '左对齐', value: 'align-left' },
  { label: '居中', value: 'align-center' },
  { label: '右对齐', value: 'align-right' },
  { label: '增加缩进', value: 'indent-increase' },
  { label: '减少缩进', value: 'indent-decrease' },
];

/** 颜色 flyout — font colors plus reset. */
const COLOR_OPTIONS: readonly FlyoutOption[] = [
  { label: '红色', value: 'color-red' },
  { label: '蓝色', value: 'color-blue' },
  { label: '绿色', value: 'color-green' },
  { label: '橙色', value: 'color-orange' },
  { label: '紫色', value: 'color-purple' },
  { label: '恢复默认', value: 'color-clear' },
];

/** 类型 flyout — labels sourced from the renderer's shared callout type map. */
function calloutTypeOptions(): readonly FlyoutOption[] {
  return Object.entries(calloutTypeMap).map(([key, def]) => ({
    label: def.label,
    value: `callout-${key}`,
    icon: def.icon,
  }));
}

const FLYOUT_OPTIONS: Record<string, () => readonly FlyoutOption[]> = {
  'indent-align': () => INDENT_ALIGN_OPTIONS,
  color: () => COLOR_OPTIONS,
  'callout-type': calloutTypeOptions,
};

/**
 * Registry command id backing a 转为 row, or null for 正文 which has no chord.
 * Headings are `heading-${level}` (registered with Mod-Alt-<level>).
 */
function registryCommandId(convert: BlockConvertTarget): string | null {
  return /^h[1-6]$/.test(convert) ? `heading-${convert.slice(1)}` : null;
}

function createMenuItem(
  label: string,
  icon: string | null,
  opts: {
    convert?: BlockConvertTarget;
    action?: MenuAction['action'];
    flyout?: string;
    calloutOnly?: boolean;
    nonCalloutOnly?: boolean;
    tableOnly?: boolean;
  },
): HTMLButtonElement {
  const item = document.createElement('button');
  item.type = 'button';
  item.className = ITEM_CLASS;
  if (opts.flyout) {
    item.setAttribute(FLYOUT_ATTR, opts.flyout);
    item.setAttribute('aria-haspopup', 'menu');
  }
  if (opts.calloutOnly) {
    item.setAttribute(CALLOUT_ONLY_ATTR, '');
    item.style.display = 'none';
  }
  if (opts.nonCalloutOnly) {
    item.setAttribute(NON_CALLOUT_ONLY_ATTR, '');
  }
  if (opts.tableOnly) {
    item.setAttribute(TABLE_ONLY_ATTR, '');
    item.style.display = 'none';
  }
  if (icon !== null) {
    const iconEl = document.createElement('span');
    iconEl.className = 'mdb-block-handle-item-icon';
    iconEl.setAttribute('aria-hidden', 'true');
    iconEl.replaceChildren(renderIcon(icon));
    item.appendChild(iconEl);
  }
  const labelEl = document.createElement('span');
  labelEl.className = 'mdb-block-handle-item-label';
  labelEl.textContent = label;
  item.appendChild(labelEl);
  if (opts.flyout) {
    const chevron = document.createElement('span');
    chevron.className = 'mdb-block-handle-chevron';
    chevron.setAttribute('aria-hidden', 'true');
    chevron.textContent = '›';
    item.appendChild(chevron);
  }
  if (opts.convert) {
    const commandId = registryCommandId(opts.convert);
    const keyBinding = commandId === null ? null : commandRegistry.getKeyBinding(commandId);
    if (keyBinding !== null) {
      const kbd = document.createElement('kbd');
      kbd.className = 'mdb-block-handle-item-kbd';
      kbd.textContent = keyBinding;
      kbd.setAttribute('aria-hidden', 'true');
      item.appendChild(kbd);
    }
    item.setAttribute('data-convert', opts.convert);
  }
  if (opts.action) item.setAttribute('data-action', opts.action);
  return item;
}

export function createHandle(): HTMLElement {
  const handle = document.createElement('div');
  handle.className = HANDLE_CLASS;
  handle.setAttribute('data-testid', 'block-handle');
  handle.title = '拖拽重排 · 点击打开菜单';
  handle.setAttribute('data-icon', HANDLE_DEFAULT_ICON);
  handle.style.display = 'none';

  // Left segment: block type icon (22x22)
  const typeIcon = document.createElement('div');
  typeIcon.className = HANDLE_TYPE_ICON_CLASS;
  typeIcon.setAttribute('aria-hidden', 'true');
  typeIcon.replaceChildren(renderIcon(HANDLE_DEFAULT_ICON));
  handle.appendChild(typeIcon);

  // Right segment: drag handle (16x22) with DragOutlined icon
  const dragHandle = document.createElement('div');
  dragHandle.className = HANDLE_DRAG_CLASS;
  dragHandle.setAttribute('aria-hidden', 'true');
  dragHandle.replaceChildren(renderIcon('DragOutlined'));
  handle.appendChild(dragHandle);

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

  const grid = document.createElement('div');
  grid.className = GRID_CLASS;
  grid.setAttribute('data-testid', 'block-handle-convert-grid');
  for (const entry of MENU_CONVERT) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = GRID_ITEM_CLASS;
    btn.setAttribute('aria-label', entry.label);
    btn.title = entry.label;
    btn.setAttribute('data-convert', entry.convert);
    btn.appendChild(renderIcon(entry.icon));
    grid.appendChild(btn);
  }
  menu.appendChild(grid);

  menu.appendChild(createMenuItem('缩进和对齐', null, { flyout: 'indent-align' }));
  menu.appendChild(createMenuItem('颜色', null, { flyout: 'color', nonCalloutOnly: true }));
  menu.appendChild(createMenuItem('类型', null, { flyout: 'callout-type', calloutOnly: true }));

  for (const entry of TABLE_ACTIONS) {
    menu.appendChild(createMenuItem(entry.label, entry.icon, { action: entry.action, tableOnly: true }));
  }

  for (const entry of CALLOUT_ACTIONS) {
    menu.appendChild(createMenuItem(entry.label, entry.icon, { action: entry.action, calloutOnly: true }));
  }

  for (const entry of COMMON_ACTIONS) {
    menu.appendChild(createMenuItem(entry.label, entry.icon, { action: entry.action, nonCalloutOnly: entry.nonCalloutOnly }));
  }

  for (const entry of MENU_ACTIONS) {
    menu.appendChild(createMenuItem(entry.label, entry.icon, { action: entry.action }));
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

  private flyout: HTMLElement | null = null;

  constructor(private readonly onEscape: (event: KeyboardEvent | MouseEvent) => void) {
    this.menu.addEventListener('mouseover', this.onMenuOver);
    this.menu.addEventListener('mouseleave', this.onMenuLeave);
  }

  mount(parent: HTMLElement): void {
    parent.append(this.handle, this.menu, this.insertLine);
  }

  unmount(): void {
    this.removeKeyListener();
    this.menu.removeEventListener('mouseover', this.onMenuOver);
    this.menu.removeEventListener('mouseleave', this.onMenuLeave);
    this.hideFlyout();
    this.handle.remove();
    this.menu.remove();
    this.insertLine.remove();
  }

  setIcon(icon: string): void {
    this.handle.setAttribute('data-icon', icon);
    const typeIcon = this.handle.querySelector(`.${HANDLE_TYPE_ICON_CLASS}`);
    if (typeIcon) {
      typeIcon.replaceChildren(renderIcon(icon));
    }
  }

  showHandle(): void {
    // Fade only on the hidden->visible edge: showHandleAt() runs on every
    // mousemove while hovering one block, and re-fading each tick would flicker.
    const wasHidden = this.handle.style.display === 'none';
    this.handle.style.display = 'flex';
    if (wasHidden) playFadeIn(this.handle);
    this.syncKeyListener();
  }

  showMenu(): void {
    this.handle.classList.remove(DIMMED_CLASS);
    this.menu.style.display = 'block';
    this.handle.style.display = 'flex';
    this.syncKeyListener();
  }

  hideHandle(): void {
    this.handle.style.display = 'none';
    this.syncKeyListener();
  }

  hideMenu(): void {
    this.hideFlyout();
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
    this.hideFlyout();
    this.handle.classList.remove(DIMMED_CLASS);
    this.handle.style.display = 'none';
    this.menu.style.display = 'none';
    this.insertLine.style.display = 'none';
    this.syncKeyListener();
  }

  setDimmed(dimmed: boolean): void {
    this.handle.classList.toggle(DIMMED_CLASS, dimmed);
  }

  isMenuOpen(): boolean {
    return this.menu.style.display !== 'none';
  }

  /** Show or hide the callout-only 类型 row for the block about to open. */
  setCalloutContext(isCallout: boolean): void {
    const calloutRows = this.menu.querySelectorAll<HTMLElement>(`[${CALLOUT_ONLY_ATTR}]`);
    calloutRows.forEach((row) => {
      row.style.display = isCallout ? 'flex' : 'none';
    });
    const nonCalloutRows = this.menu.querySelectorAll<HTMLElement>(`[${NON_CALLOUT_ONLY_ATTR}]`);
    nonCalloutRows.forEach((row) => {
      row.style.display = isCallout ? 'none' : 'flex';
    });
    if (!isCallout && this.flyout?.getAttribute(FLYOUT_ATTR) === 'callout-type') {
      this.hideFlyout();
    }
    if (isCallout && this.flyout?.getAttribute(FLYOUT_ATTR) === 'color') {
      this.hideFlyout();
    }
  }

  setTableContext(isTable: boolean): void {
    const tableRows = this.menu.querySelectorAll<HTMLElement>(`[${TABLE_ONLY_ATTR}]`);
    tableRows.forEach((row) => {
      row.style.display = isTable ? 'flex' : 'none';
    });
  }

  /**
   * Open the flyout for a hovered row. Replaces any open flyout so exactly one
   * panel exists at a time; the panel is removed (not merely hidden) on close
   * so a dismissed menu leaves no residual nodes (#330).
   */
  private showFlyout(row: HTMLElement): void {
    const key = row.getAttribute(FLYOUT_ATTR) ?? '';
    const options = FLYOUT_OPTIONS[key]?.() ?? [];
    if (options.length === 0 || this.flyout?.getAttribute(FLYOUT_ATTR) === key) return;
    this.hideFlyout();
    const panel = document.createElement('div');
    panel.className = FLYOUT_CLASS;
    panel.setAttribute('data-testid', 'block-handle-flyout');
    panel.setAttribute(FLYOUT_ATTR, key);
    for (const option of options) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = FLYOUT_ITEM_CLASS;
      btn.setAttribute(FLYOUT_ACTION_ATTR, option.value);
      if (option.icon) {
        const iconEl = document.createElement('span');
        iconEl.className = 'mdb-block-handle-flyout-icon';
        iconEl.setAttribute('aria-hidden', 'true');
        iconEl.textContent = option.icon;
        btn.appendChild(iconEl);
      }
      btn.appendChild(document.createTextNode(option.label));
      panel.appendChild(btn);
    }
    panel.style.position = 'absolute';
    panel.style.left = '100%';
    panel.style.top = `${row.offsetTop}px`;
    this.menu.appendChild(panel);
    this.flyout = panel;
  }

  hideFlyout(): void {
    if (!this.flyout) return;
    this.flyout.remove();
    this.flyout = null;
  }

  private readonly onMenuOver = (event: MouseEvent): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const row = target.closest<HTMLElement>(`[${FLYOUT_ATTR}]`);
    if (row && this.menu.contains(row)) this.showFlyout(row);
  };

  private readonly onMenuLeave = (event: MouseEvent): void => {
    const to = event.relatedTarget;
    if (to instanceof Node && this.menu.contains(to)) return;
    this.hideFlyout();
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') this.onEscape(event);
  };

  private readonly onDocMouseDown = (event: MouseEvent): void => {
    const target = event.target;
    if (target instanceof Node && (this.handle.contains(target) || this.menu.contains(target))) {
      return;
    }
    this.onEscape(event);
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
    width: '42px',
    height: '26px',
    padding: '0 3px',
    border: '1px solid var(--mdb-border)',
    borderRadius: '6px',
    cursor: 'grab',
    color: 'var(--mdb-text-secondary)',
    userSelect: 'none',
    zIndex: '5',
    backgroundColor: 'var(--mdb-bg-secondary)',
    boxSizing: 'border-box',
  },
  '.mdb-block-handle:hover': {
    backgroundColor: 'rgba(127, 127, 127, 0.18)',
  },
  '.mdb-block-handle-dimmed': {
    opacity: '0.35',
  },
  '.mdb-block-type-icon': {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '22px',
    height: '22px',
    flexShrink: '0',
    fontSize: '18px',
    lineHeight: '1',
    color: 'var(--mdb-text-secondary)',
  },
  '.mdb-block-type-icon svg': {
    width: '18px',
    height: '18px',
  },
  '.mdb-drag-handle': {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '16px',
    height: '22px',
    flexShrink: '0',
    fontSize: '12px',
    lineHeight: '1',
    color: 'var(--mdb-text-secondary)',
    opacity: '0.6',
  },
  '.mdb-drag-handle svg': {
    width: '12px',
    height: '12px',
  },
  '.cm-block-selected': {
    backgroundColor: 'rgba(127, 127, 127, 0.1)',
  },
  '.mdb-block-handle-menu': {
    position: 'absolute',
    display: 'none',
    minWidth: '236px',
    padding: '5px',
    backgroundColor: 'var(--mdb-bg-secondary)',
    border: `1px solid var(--mdb-border)`,
    borderRadius: '6px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.18)',
    zIndex: '1000',
    fontSize: '12px',
  },
  '.mdb-block-handle-label': {
    padding: '2px 8px',
    fontSize: '11px',
    color: 'var(--mdb-muted)',
  },
  '.mdb-block-handle-item': {
    display: 'flex',
    alignItems: 'center',
    gap: '9px',
    width: '100%',
    textAlign: 'left',
    background: 'transparent',
    border: 'none',
    color: 'var(--mdb-text)',
    padding: '0 8px',
    height: '32px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
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
  '.mdb-block-handle-chevron': {
    marginLeft: 'auto',
    flexShrink: '0',
    fontSize: '14px',
    lineHeight: '1',
    color: 'var(--mdb-text-secondary)',
  },
  '.mdb-block-handle-item:hover': {
    backgroundColor: 'rgba(235, 235, 235, 0.08)',
  },
  '.mdb-block-handle-grid': {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '2px',
    padding: '2px 4px',
  },
  '.mdb-block-handle-grid-item': {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '30px',
    height: '30px',
    padding: '0',
    border: 'none',
    borderRadius: '4px',
    background: 'transparent',
    color: 'var(--mdb-text)',
    cursor: 'pointer',
  },
  '.mdb-block-handle-grid-item:hover': {
    backgroundColor: 'rgba(235, 235, 235, 0.08)',
  },
  '.mdb-block-handle-flyout': {
    minWidth: '96px',
    padding: '4px',
    backgroundColor: 'var(--mdb-bg-secondary)',
    border: `1px solid var(--mdb-border)`,
    borderRadius: '6px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.18)',
    zIndex: '1001',
  },
  '.mdb-block-handle-flyout-item': {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    background: 'transparent',
    border: 'none',
    color: 'var(--mdb-text)',
    padding: '4px 8px',
    cursor: 'pointer',
    fontSize: '13px',
  },
  '.mdb-block-handle-flyout-item:hover': {
    backgroundColor: 'rgba(235, 235, 235, 0.08)',
  },
  '.mdb-block-handle-flyout-icon': {
    display: 'inline-block',
    marginRight: '6px',
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
