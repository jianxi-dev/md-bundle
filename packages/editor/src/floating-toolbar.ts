/**
 * Floating toolbar — appears immediately when text is selected (ticket #260).
 *
 * Data-driven: the toolbar renders from a list of `FloatingToolbarItem`
 * descriptors (command ids + optional label/icon overrides) instead of
 * hardcoding commands. This keeps the toolbar the single source of truth for
 * the selection surface — `context-toolbar`'s `text-selected` returns `[]`
 * (#233 contract) and this plugin owns the selection toolbar.
 *
 * The item shape supports a `kind` discriminator (`'button'` | `'dropdown'` |
 * `'color'` | `'columns'`) so later tickets (font / align / color / columns)
 * can add dropdown controls without reworking the render path.
 *
 * Architecture:
 * - A ViewPlugin listens for selection changes via EditorView.updateListener.
 * - On selection change, the toolbar DOM is repositioned to the selection head.
 * - No animation or delay on first appearance — the toolbar is shown/hidden
 *   synchronously with the selection state.
 */
import { EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';
import { commandRegistry, type Command } from './commands';
import { createColorPalette } from './color-palette';

/**
 * A single toolbar control descriptor.
 *
 * References a registered command by `commandId`; the toolbar looks it up in
 * `commandRegistry` at render time (so the toolbar reflects the live
 * registry). `label` and `icon` override the command's defaults for this
 * toolbar slot (e.g. `code-copy` shows as "复制" here while the palette keeps
 * its canonical "复制代码" label).
 *
 * For `kind: 'dropdown'`, the `options` array defines the submenu items.
 * Each option has a `commandId` to execute and optional `label`/`icon` overrides.
 */
export interface FloatingToolbarItem {
  /** Command id to execute on click — must be registered in commandRegistry. */
  readonly commandId: string;
  /** Override the command's label for this toolbar slot (tooltip). */
  readonly label?: string;
  /** Override the command's icon for this toolbar slot (button text). */
  readonly icon?: string;
  /**
   * Control shape. `'button'` (default) renders a flat action button.
   * `'dropdown'` renders a button that opens a submenu of options.
   * `'color'` renders a button that opens the shared dual-palette color popup
   * (`createColorPalette`, ticket #360).
   * `'columns'` renders a button that opens the visual bar picker for 1..N
   * columns (`columns` field, ticket #290).
   */
  readonly kind?: 'button' | 'dropdown' | 'color' | 'columns';
  /** Submenu options for dropdown controls. */
  readonly options?: readonly DropdownOption[];
  /** Bar-picker bounds for column controls. */
  readonly columns?: ColumnsPopupOptions;
}

/**
 * Bounds of the `kind: 'columns'` visual picker (ticket #290): the popup
 * renders one clickable bar group per count from 1 to `max`.
 */
export interface ColumnsPopupOptions {
  /** Highest selectable column count (1..max groups rendered). */
  readonly max: number;
}

export interface DropdownOption {
  /** Command id to execute when this option is selected. */
  readonly commandId: string;
  /** Override the command's label for this option. */
  readonly label?: string;
  /** Override the command's icon for this option. */
  readonly icon?: string;
  /** Optional swatch chip colour for custom option rendering. */
  readonly swatch?: string;
}

export interface FloatingToolbarOptions {
  /**
   * Legacy raw command list. Rendered directly when provided. Prefer `items`
   * for data-driven rendering from commandRegistry.
   */
  readonly commands?: Command[];
  /**
   * Data-driven item descriptors. Defaults to the built-in 7-control inline
   * format set. When `commands` is also provided, `commands` wins (backwards
   * compat with callers that pass a raw list).
   */
  readonly items?: FloatingToolbarItem[];
}

/**
 * Default 11-control inline format set.
 * Order (user-pinned, ticket #269 + #277 + #278):
 * A(颜色) / 对齐 / 加粗 / 删除线 / 斜体 / 下划线 / 插入链接 / 行内代码 / 分栏 / 复制 / 转换.
 * The popup buttons show a short glyph (`A`/`对齐`/`分栏`/`转换`) with a `▾`
 * caret; the button controls keep their command glyphs (B/S/I/U/🔗/</>). Tooltips
 * stay the semantic labels. The 字体 dropdown was removed in #278 — the font
 * commands remain registered for the palette, only the toolbar control is gone.
 */
const DEFAULT_TOOLBAR_ITEMS: readonly FloatingToolbarItem[] = [
  {
    commandId: 'color-red',
    label: '颜色',
    icon: 'A',
    kind: 'color',
  },
  {
    commandId: 'align-left',
    label: '对齐',
    icon: '对齐',
    kind: 'dropdown',
    options: [
      { commandId: 'align-left', label: '左对齐' },
      { commandId: 'align-center', label: '居中' },
      { commandId: 'align-right', label: '右对齐' },
      { commandId: 'align-clear', label: '清除' },
    ],
  },
  { commandId: 'toggle-bold' },
  { commandId: 'toggle-strikethrough' },
  { commandId: 'toggle-italic' },
  { commandId: 'toggle-underline' },
  { commandId: 'toggle-link' },
  { commandId: 'toggle-code', icon: '</>' },
  {
    commandId: 'col-2',
    label: '分栏',
    icon: '分栏',
    kind: 'columns',
    columns: { max: 5 },
  },
  { commandId: 'code-copy', label: '复制', icon: '复制' },
  {
    commandId: 'turn-into-h2',
    label: '转换',
    icon: '⇄',
    kind: 'dropdown',
    options: [
      { commandId: 'turn-into-h1', label: '一级标题' },
      { commandId: 'turn-into-h2', label: '二级标题' },
      { commandId: 'turn-into-h3', label: '三级标题' },
      { commandId: 'turn-into-h4', label: '四级标题' },
      { commandId: 'turn-into-h5', label: '五级标题' },
      { commandId: 'turn-into-h6', label: '六级标题' },
      { commandId: 'turn-into-paragraph', label: '正文' },
      { commandId: 'turn-into-list', label: '列表' },
      { commandId: 'turn-into-task', label: '任务' },
      { commandId: 'turn-into-quote', label: '引用' },
      { commandId: 'turn-into-code', label: '代码' },
      { commandId: 'turn-into-callout', label: '高亮' },
      { commandId: 'turn-into-table', label: '表格' },
    ],
  },
];

interface ToolbarState {
  dom: HTMLDivElement | null;
  visible: boolean;
}

function resolveCommand(item: FloatingToolbarItem): Command | undefined {
  return commandRegistry.all().find((c) => c.id === item.commandId);
}

function applyToolbarButtonStyle(btn: HTMLButtonElement): void {
  btn.style.background = 'transparent';
  btn.style.border = 'none';
  btn.style.color = 'var(--mdb-text)';
  btn.style.padding = '4px 8px';
  btn.style.cursor = 'pointer';
  btn.style.borderRadius = '4px';
  btn.style.fontSize = '13px';
  btn.style.lineHeight = '1';
  btn.style.display = 'flex';
  btn.style.alignItems = 'center';
  btn.style.justifyContent = 'center';
  btn.style.minWidth = '28px';
  btn.style.height = '28px';
}

function wireHoverHighlight(btn: HTMLButtonElement): void {
  btn.addEventListener('mouseenter', () => {
    btn.style.background = 'rgba(255,255,255,0.1)';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.background = 'transparent';
  });
}

function stylePopupMenu(menu: HTMLDivElement): void {
  menu.style.position = 'absolute';
  menu.style.top = '100%';
  menu.style.left = '0';
  menu.style.marginTop = '4px';
  menu.style.background = 'var(--mdb-bg-secondary)';
  menu.style.border = '1px solid var(--mdb-border)';
  menu.style.borderRadius = '4px';
  menu.style.padding = '4px';
  menu.style.display = 'none';
  menu.style.flexDirection = 'column';
  menu.style.gap = '2px';
  menu.style.zIndex = '1001';
  menu.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.18)';
  menu.style.minWidth = '120px';
}

/**
 * Wire a popup trigger: mousedown toggles the menu, an outside mousedown
 * closes it. Shared by the dropdown and color-popup controls (ticket #278).
 */
function wirePopup(
  container: HTMLDivElement,
  btn: HTMLButtonElement,
  menu: HTMLDivElement,
): { closeMenu: () => void } {
  let isOpen = false;

  function openMenu(): void {
    menu.style.display = 'flex';
    isOpen = true;
    document.addEventListener('mousedown', closeOnOutsideClick);
  }

  function closeMenu(): void {
    menu.style.display = 'none';
    isOpen = false;
    document.removeEventListener('mousedown', closeOnOutsideClick);
  }

  function closeOnOutsideClick(e: MouseEvent): void {
    if (!container.contains(e.target as Node)) {
      closeMenu();
    }
  }

  btn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  return { closeMenu };
}

function createOptionButtonDom(
  view: EditorView,
  option: DropdownOption,
  cmd: Command,
  closeMenu: () => void,
  extraClass = '',
): HTMLButtonElement {
  const optionBtn = document.createElement('button');
  optionBtn.className = `mdb-toolbar-dropdown-option${extraClass ? ` ${extraClass}` : ''}`;
  const optionLabel = option.label ?? cmd.label;
  const optionIcon = option.icon ?? cmd.icon;
  optionBtn.textContent = optionIcon ? `${optionIcon} ${optionLabel}` : optionLabel;
  optionBtn.title = optionLabel;
  optionBtn.style.background = 'transparent';
  optionBtn.style.border = 'none';
  optionBtn.style.color = 'var(--mdb-text)';
  optionBtn.style.padding = '4px 8px';
  optionBtn.style.cursor = 'pointer';
  optionBtn.style.borderRadius = '4px';
  optionBtn.style.fontSize = '13px';
  optionBtn.style.lineHeight = '1';
  optionBtn.style.textAlign = 'left';
  optionBtn.style.width = '100%';

  optionBtn.addEventListener('mouseenter', () => {
    optionBtn.style.background = 'rgba(255,255,255,0.1)';
  });
  optionBtn.addEventListener('mouseleave', () => {
    optionBtn.style.background = 'transparent';
  });

  optionBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    commandRegistry.execute(option.commandId, view);
    closeMenu();
  });

  return optionBtn;
}

function createButtonItemDom(
  view: EditorView,
  item: FloatingToolbarItem,
  cmd: Command,
): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'mdb-toolbar-btn';
  // Item overrides win over the command's defaults.
  const label = item.label ?? cmd.label;
  const icon = item.icon ?? cmd.icon;
  btn.textContent = icon ?? label;
  btn.title = label;
  applyToolbarButtonStyle(btn);

  // Visual hint for the few glyph-bearing controls so B/I read as bold/italic.
  if (icon === 'B') btn.style.fontWeight = '600';
  if (icon === 'I') btn.style.fontStyle = 'italic';

  wireHoverHighlight(btn);

  btn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    commandRegistry.execute(item.commandId, view);
  });

  return btn;
}

function createDropdownItemDom(
  view: EditorView,
  item: FloatingToolbarItem,
  cmd: Command,
): HTMLDivElement {
  const container = document.createElement('div');
  container.className = 'mdb-toolbar-dropdown';
  container.style.position = 'relative';
  container.style.display = 'inline-flex';

  const btn = document.createElement('button');
  btn.className = 'mdb-toolbar-btn mdb-toolbar-dropdown-btn';
  const label = item.label ?? cmd.label;
  const icon = item.icon ?? cmd.icon;
  btn.textContent = `${icon ?? label} ▾`;
  btn.title = label;
  applyToolbarButtonStyle(btn);
  wireHoverHighlight(btn);

  const menu = document.createElement('div');
  menu.className = 'mdb-toolbar-dropdown-menu';
  stylePopupMenu(menu);

  const { closeMenu } = wirePopup(container, btn, menu);

  if (item.options) {
    for (const option of item.options) {
      const optionCmd = commandRegistry.all().find((c) => c.id === option.commandId);
      if (!optionCmd) continue;
      menu.appendChild(createOptionButtonDom(view, option, optionCmd, closeMenu));
    }
  }

  container.appendChild(btn);
  container.appendChild(menu);

  return container;
}

/**
 * Dual-palette color popup (ticket #278, unified in #360): one trigger
 * (title 颜色) whose panel mounts the SHARED color palette — the same node the
 * block-handle 颜色› flyout renders — so both surfaces stay identical.
 */
function createColorPopupItemDom(
  view: EditorView,
  item: FloatingToolbarItem,
  cmd: Command,
): HTMLDivElement {
  const container = document.createElement('div');
  container.className = 'mdb-toolbar-dropdown';
  container.style.position = 'relative';
  container.style.display = 'inline-flex';

  const btn = document.createElement('button');
  btn.className = 'mdb-toolbar-btn mdb-toolbar-dropdown-btn';
  const label = item.label ?? cmd.label;
  const icon = item.icon ?? cmd.icon;
  btn.textContent = `${icon ?? label} ▾`;
  btn.title = label;
  applyToolbarButtonStyle(btn);
  wireHoverHighlight(btn);

  const menu = document.createElement('div');
  menu.className = 'mdb-toolbar-dropdown-menu mdb-toolbar-color-menu';
  stylePopupMenu(menu);
  menu.style.minWidth = '184px';

  const { closeMenu } = wirePopup(container, btn, menu);

  menu.appendChild(
    createColorPalette((commandId) => {
      commandRegistry.execute(commandId, view);
      closeMenu();
    }),
  );

  container.appendChild(btn);
  container.appendChild(menu);

  return container;
}

function createColumnBarButtonDom(
  view: EditorView,
  count: number,
  closeMenu: () => void,
): HTMLButtonElement {
  const optionBtn = document.createElement('button');
  optionBtn.className = 'mdb-column-option';
  optionBtn.dataset.columns = String(count);
  optionBtn.title = `${count} 栏`;
  optionBtn.setAttribute('aria-label', optionBtn.title);
  optionBtn.style.display = 'flex';
  optionBtn.style.alignItems = 'center';
  optionBtn.style.justifyContent = 'center';
  optionBtn.style.gap = '2px';
  optionBtn.style.width = '100%';
  optionBtn.style.height = '26px';
  optionBtn.style.padding = '0 8px';
  optionBtn.style.background = 'transparent';
  optionBtn.style.border = 'none';
  optionBtn.style.borderRadius = '4px';
  optionBtn.style.cursor = 'pointer';

  const bars: HTMLSpanElement[] = [];
  for (let i = 0; i < count; i += 1) {
    const bar = document.createElement('span');
    bar.className = 'mdb-column-bar';
    bar.style.width = '3px';
    bar.style.height = '14px';
    bar.style.borderRadius = '1px';
    bar.style.background = 'var(--mdb-text-secondary)';
    bars.push(bar);
    optionBtn.appendChild(bar);
  }

  function highlight(on: boolean): void {
    optionBtn.style.background = on ? 'var(--mdb-selection)' : 'transparent';
    for (const bar of bars) {
      bar.style.background = on ? 'var(--mdb-text)' : 'var(--mdb-text-secondary)';
    }
  }

  optionBtn.addEventListener('mouseenter', () => highlight(true));
  optionBtn.addEventListener('mouseleave', () => highlight(false));

  optionBtn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    commandRegistry.execute(`col-${count}`, view);
    closeMenu();
  });

  return optionBtn;
}

/**
 * Visual column-count picker (ticket #290): one trigger (title 分栏) whose panel
 * shows a clickable bar group per count — N vertical bars for N columns — plus
 * a 清除 action. Replaces the former text dropdown (#263).
 */
function createColumnsItemDom(
  view: EditorView,
  item: FloatingToolbarItem,
  cmd: Command,
): HTMLDivElement {
  const container = document.createElement('div');
  container.className = 'mdb-toolbar-dropdown';
  container.style.position = 'relative';
  container.style.display = 'inline-flex';

  const btn = document.createElement('button');
  btn.className = 'mdb-toolbar-btn mdb-toolbar-dropdown-btn';
  const label = item.label ?? cmd.label;
  const icon = item.icon ?? cmd.icon;
  btn.textContent = `${icon ?? label} ▾`;
  btn.title = label;
  applyToolbarButtonStyle(btn);
  wireHoverHighlight(btn);

  const menu = document.createElement('div');
  menu.className = 'mdb-toolbar-dropdown-menu mdb-toolbar-columns-menu';
  stylePopupMenu(menu);
  menu.style.minWidth = '110px';

  const { closeMenu } = wirePopup(container, btn, menu);

  if (item.columns) {
    for (let count = 1; count <= item.columns.max; count += 1) {
      if (!commandRegistry.has(`col-${count}`)) continue;
      menu.appendChild(createColumnBarButtonDom(view, count, closeMenu));
    }

    const clearCmd = commandRegistry.all().find((c) => c.id === 'col-clear');
    if (clearCmd) {
      menu.appendChild(
        createOptionButtonDom(
          view,
          { commandId: 'col-clear', label: '清除' },
          clearCmd,
          closeMenu,
          'mdb-columns-clear',
        ),
      );
    }
  }

  container.appendChild(btn);
  container.appendChild(menu);

  return container;
}

function createToolbarDom(
  view: EditorView,
  items: readonly FloatingToolbarItem[],
): HTMLDivElement {
  const toolbar = document.createElement('div');
  toolbar.className = 'mdb-floating-toolbar';
  toolbar.style.position = 'absolute';
  toolbar.style.background = 'var(--mdb-bg-secondary)';
  toolbar.style.border = `1px solid var(--mdb-border)`;
  toolbar.style.borderRadius = '6px';
  toolbar.style.padding = '4px';
  toolbar.style.display = 'flex';
  toolbar.style.gap = '2px';
  toolbar.style.zIndex = '1000';
  toolbar.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.18)';

  for (const item of items) {
    const cmd = resolveCommand(item);
    if (!cmd) continue;
    if (item.kind === 'color') {
      toolbar.appendChild(createColorPopupItemDom(view, item, cmd));
    } else if (item.kind === 'columns' && item.columns) {
      toolbar.appendChild(createColumnsItemDom(view, item, cmd));
    } else if (item.kind === 'dropdown' && item.options && item.options.length > 0) {
      toolbar.appendChild(createDropdownItemDom(view, item, cmd));
    } else {
      toolbar.appendChild(createButtonItemDom(view, item, cmd));
    }
  }

  return toolbar;
}

function positionToolbar(view: EditorView, toolbar: HTMLDivElement): void {
  // coordsAtPos is forbidden during the update cycle, so read in the measure
  // phase (#233); place relative to the editor rect (the offset parent).
  try {
    view.requestMeasure({
      read: (v) => {
        const coords = v.coordsAtPos(v.state.selection.main.head);
        if (!coords) return null;
        return {
          coords,
          rect: v.dom.getBoundingClientRect(),
          width: toolbar.getBoundingClientRect().width,
        };
      },
      write: (measure) => {
        if (!measure) return;
        const { coords, rect, width } = measure;
        const left = coords.left - rect.left;
        const maxLeft = Math.max(4, rect.width - width - 4);
        toolbar.style.left = `${Math.max(4, Math.min(left, maxLeft))}px`;
        toolbar.style.top = `${Math.max(4, coords.bottom - rect.top + 4)}px`;
      },
    });
  } catch {
    // jsdom / unmeasured content — leave at default position
  }
}

/**
 * Creates the floating toolbar ViewPlugin.
 *
 * The toolbar appears immediately on selection, updates position in
 * real-time, and disappears immediately on selection clear.
 */
export function floatingToolbar(options: FloatingToolbarOptions = {}) {
  // Backwards compat: legacy `commands` (raw Command[]) wins when provided.
  const legacyCommands = options.commands;
  const items = options.items ?? DEFAULT_TOOLBAR_ITEMS;

  return ViewPlugin.define((view) => {
    const state: ToolbarState = { dom: null, visible: false };

    function buildDom(): HTMLDivElement {
      if (legacyCommands) {
        // Legacy path — render raw commands directly (pre-data-driven callers).
        return createToolbarDom(
          view,
          legacyCommands.map((c) => ({ commandId: c.id, label: c.label, icon: c.icon })),
        );
      }
      return createToolbarDom(view, items);
    }

    function showToolbar(): void {
      if (!state.dom) {
        state.dom = buildDom();
        if (view.dom.style.position === 'static' || view.dom.style.position === '') {
          view.dom.style.position = 'relative';
        }
        view.dom.appendChild(state.dom);
      }
      state.dom.style.display = 'flex';
      state.visible = true;
      positionToolbar(view, state.dom);
    }

    function hideToolbar(): void {
      if (state.dom) {
        state.dom.style.display = 'none';
      }
      state.visible = false;
    }

    return {
      update(u: ViewUpdate): void {
        if (u.selectionSet) {
          const { from, to } = u.state.selection.main;
          if (from !== to) {
            if (!state.visible) {
              showToolbar();
            } else {
              if (state.dom) positionToolbar(view, state.dom);
            }
          } else {
            if (state.visible) {
              hideToolbar();
            }
          }
        }
      },
      destroy(): void {
        if (state.dom?.parentNode) {
          state.dom.parentNode.removeChild(state.dom);
        }
        state.dom = null;
        state.visible = false;
      },
    };
  });
}
