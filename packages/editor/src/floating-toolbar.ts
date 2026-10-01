/**
 * Floating toolbar — appears immediately when text is selected (ticket #260).
 *
 * Data-driven: the toolbar renders from a list of `FloatingToolbarItem`
 * descriptors (command ids + optional label/icon overrides) instead of
 * hardcoding commands. This keeps the toolbar the single source of truth for
 * the selection surface — `context-toolbar`'s `text-selected` returns `[]`
 * (#233 contract) and this plugin owns the selection toolbar.
 *
 * The item shape supports a `kind` discriminator (`'button'` | `'dropdown'`)
 * so later tickets (font / align / color / columns) can add dropdown
 * controls without reworking the render path.
 *
 * Architecture:
 * - A ViewPlugin listens for selection changes via EditorView.updateListener.
 * - On selection change, the toolbar DOM is repositioned to the selection head.
 * - No animation or delay on first appearance — the toolbar is shown/hidden
 *   synchronously with the selection state.
 */
import { EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';
import { commandRegistry, type Command } from './commands';

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
   */
  readonly kind?: 'button' | 'dropdown';
  /** Submenu options for dropdown controls. */
  readonly options?: readonly DropdownOption[];
}

export interface DropdownOption {
  /** Command id to execute when this option is selected. */
  readonly commandId: string;
  /** Override the command's label for this option. */
  readonly label?: string;
  /** Override the command's icon for this option. */
  readonly icon?: string;
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
 * Default 9-control inline format set — the contract for ticket #261.
 * Order: 字体▾ / 颜色▾ / 加粗 / 斜体 / 删除线 / 下划线 / 行内代码 / 链接 / 复制.
 * `code-copy` is reused (clipboard write logic) but its toolbar label is
 * overridden to "复制" per the ticket.
 */
const DEFAULT_TOOLBAR_ITEMS: readonly FloatingToolbarItem[] = [
  {
    commandId: 'font-sans',
    label: '字体',
    icon: 'Aa',
    kind: 'dropdown',
    options: [
      { commandId: 'font-clear', label: '无' },
      { commandId: 'font-serif', label: '衬线' },
      { commandId: 'font-mono', label: '等宽' },
      { commandId: 'font-sans', label: '无衬线' },
    ],
  },
  {
    commandId: 'color-red',
    label: '颜色',
    icon: '●',
    kind: 'dropdown',
    options: [
      { commandId: 'color-clear', label: '清除' },
      { commandId: 'color-red', label: '红色' },
      { commandId: 'color-blue', label: '蓝色' },
      { commandId: 'color-green', label: '绿色' },
      { commandId: 'color-orange', label: '橙色' },
      { commandId: 'color-purple', label: '紫色' },
    ],
  },
  { commandId: 'toggle-bold' },
  { commandId: 'toggle-italic' },
  { commandId: 'toggle-strikethrough' },
  { commandId: 'toggle-underline' },
  { commandId: 'toggle-code' },
  { commandId: 'toggle-link' },
  { commandId: 'code-copy', label: '复制' },
];

interface ToolbarState {
  dom: HTMLDivElement | null;
  visible: boolean;
}

function resolveCommand(item: FloatingToolbarItem): Command | undefined {
  return commandRegistry.all().find((c) => c.id === item.commandId);
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

  // Visual hint for the few glyph-bearing controls so B/I read as bold/italic.
  if (icon === 'B') btn.style.fontWeight = '600';
  if (icon === 'I') btn.style.fontStyle = 'italic';

  btn.addEventListener('mouseenter', () => {
    btn.style.background = 'rgba(255,255,255,0.1)';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.background = 'transparent';
  });

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

  btn.addEventListener('mouseenter', () => {
    btn.style.background = 'rgba(255,255,255,0.1)';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.background = 'transparent';
  });

  const menu = document.createElement('div');
  menu.className = 'mdb-toolbar-dropdown-menu';
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

  if (item.options) {
    for (const option of item.options) {
      const optionCmd = commandRegistry.all().find((c) => c.id === option.commandId);
      if (!optionCmd) continue;

      const optionBtn = document.createElement('button');
      optionBtn.className = 'mdb-toolbar-dropdown-option';
      const optionLabel = option.label ?? optionCmd.label;
      const optionIcon = option.icon ?? optionCmd.icon;
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
        menu.style.display = 'none';
      });

      menu.appendChild(optionBtn);
    }
  }

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
    if (item.kind === 'dropdown' && item.options && item.options.length > 0) {
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
