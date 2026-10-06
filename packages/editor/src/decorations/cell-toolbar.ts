/**
 * Table-cell selection toolbar (ticket #328 / change editor-fidelity 7.1).
 *
 * Appears while a rectangular table-cell selection is active (see
 * `cell-selection.ts`) and exposes two actions from the source spec §6:
 *
 * - 合并单元格 (`data-testid="cell-merge"`): merges the selected rectangle into
 *   its top-left cell. Disabled unless more than one cell is selected.
 * - 单元格背景色 (`data-testid="cell-bg"`): a submenu of background colors plus
 *   恢复默认, applied through the existing `mdb-bg-*` span convention.
 *
 * The toolbar is appended to `view.dom` (not to the table widget), so it stays
 * put while CM6 rebuilds the widget DOM. It is driven by the view-level
 * selection pub/sub rather than a CM6 transaction, because the drag that
 * creates the selection emits no transaction.
 */
import type { Extension } from '@codemirror/state';
import { ViewPlugin, type EditorView } from '@codemirror/view';
import {
  cellRect,
  cellSelectionCount,
  getCellSelection,
  isCellInSelection,
  subscribeCellSelection,
  type CellSelection,
} from './cell-selection';
import { mergeTableCellSelection, setCellBackground } from './table';

/** Background options, mirroring the floating color panel's 背景色 row. */
const CELL_BG_COLORS: readonly { label: string; swatch: string; colorClass: string }[] = [
  { label: '红色', swatch: '#ffd8d3', colorClass: 'mdb-bg-red' },
  { label: '蓝色', swatch: '#d7dcff', colorClass: 'mdb-bg-blue' },
  { label: '绿色', swatch: '#d2f8d2', colorClass: 'mdb-bg-green' },
  { label: '橙色', swatch: '#ffedd0', colorClass: 'mdb-bg-orange' },
  { label: '紫色', swatch: '#e8d7ff', colorClass: 'mdb-bg-purple' },
];

function styleToolbar(root: HTMLElement): void {
  root.style.position = 'absolute';
  root.style.display = 'none';
  root.style.alignItems = 'center';
  root.style.gap = '2px';
  root.style.padding = '4px';
  root.style.background = 'var(--mdb-bg-secondary)';
  root.style.border = '1px solid var(--mdb-border)';
  root.style.borderRadius = '6px';
  root.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.18)';
  root.style.zIndex = '1002';
}

function styleToolbarButton(btn: HTMLButtonElement): void {
  btn.style.background = 'transparent';
  btn.style.border = 'none';
  btn.style.color = 'var(--mdb-text)';
  btn.style.padding = '4px 8px';
  btn.style.cursor = 'pointer';
  btn.style.borderRadius = '4px';
  btn.style.fontSize = '13px';
  btn.style.lineHeight = '1';
  btn.style.whiteSpace = 'nowrap';
}

/** Grey out and block a button without removing it from the layout. */
function setButtonDisabled(btn: HTMLButtonElement, disabled: boolean): void {
  btn.disabled = disabled;
  btn.classList.toggle('mdb-cell-toolbar-btn-disabled', disabled);
  btn.style.opacity = disabled ? '0.4' : '1';
  btn.style.cursor = disabled ? 'default' : 'pointer';
}

/**
 * Cell toolbar extension. Include once (via `editorDecorations`) so any table
 * interaction gains the merge / cell-background surface.
 */
export function cellToolbar(): Extension {
  return ViewPlugin.fromClass(
    class {
      private readonly unsubscribe: () => void;
      private root: HTMLDivElement | null = null;
      private mergeBtn: HTMLButtonElement | null = null;
      private menu: HTMLDivElement | null = null;
      // True while the menu was revealed by hover rather than by a click; a
      // click that follows the hover-open must not toggle it shut (ticket #390).
      private hoverOpened = false;
      private readonly closeMenu: () => void;

      constructor(private readonly view: EditorView) {
        this.closeMenu = () => {
          if (this.menu) this.menu.style.display = 'none';
          this.hoverOpened = false;
          document.removeEventListener('mousedown', this.onOutsideDown, true);
          document.removeEventListener('keydown', this.onEscape, true);
        };
        this.unsubscribe = subscribeCellSelection(view, () => this.sync());
      }

      private onOutsideDown = (event: MouseEvent): void => {
        if (this.root && !this.root.contains(event.target as Node)) {
          this.closeMenu();
        }
      };

      private onEscape = (event: KeyboardEvent): void => {
        if (event.key === 'Escape') this.closeMenu();
      };

      private openMenu(): void {
        if (!this.menu) return;
        this.menu.style.display = 'flex';
        document.addEventListener('mousedown', this.onOutsideDown, true);
        document.addEventListener('keydown', this.onEscape, true);
      }

      private toggleMenu(): void {
        if (this.menu?.style.display === 'flex') this.closeMenu();
        else this.openMenu();
      }

      private build(): void {
        const view = this.view;
        const root = document.createElement('div');
        root.className = 'mdb-cell-toolbar';
        root.setAttribute('data-testid', 'cell-toolbar');
        styleToolbar(root);

        const merge = document.createElement('button');
        merge.type = 'button';
        merge.className = 'mdb-cell-toolbar-btn mdb-cell-toolbar-merge';
        merge.setAttribute('data-testid', 'cell-merge');
        merge.title = '合并单元格';
        merge.textContent = '合并单元格';
        styleToolbarButton(merge);
        merge.addEventListener('mousedown', (event) => {
          event.preventDefault();
          event.stopPropagation();
          const selection = getCellSelection(view);
          if (!selection || cellSelectionCount(selection) <= 1) return;
          mergeTableCellSelection(view, selection.tableIndex, cellRect(selection));
        });

        const dropdown = document.createElement('div');
        dropdown.className = 'mdb-cell-toolbar-dropdown';
        dropdown.style.position = 'relative';
        dropdown.style.display = 'inline-flex';

        const bg = document.createElement('button');
        bg.type = 'button';
        bg.className = 'mdb-cell-toolbar-btn mdb-cell-toolbar-dropdown-btn';
        bg.setAttribute('data-testid', 'cell-bg');
        bg.title = '单元格背景色';
        bg.textContent = '单元格背景色 ▾';
        styleToolbarButton(bg);
        bg.addEventListener('mousedown', (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (this.menu?.style.display === 'flex' && this.hoverOpened) {
            this.hoverOpened = false;
            return;
          }
          this.toggleMenu();
        });

        // Slide-in: hovering the 单元格背景色 control reveals its submenu
        // without a click, matching the block-handle flyout (ticket #390).
        dropdown.addEventListener('mouseenter', () => {
          if (this.menu?.style.display === 'flex') return;
          this.openMenu();
          this.hoverOpened = true;
        });
        dropdown.addEventListener('mouseleave', () => this.closeMenu());

        const menu = document.createElement('div');
        menu.className = 'mdb-cell-toolbar-menu';
        menu.style.position = 'absolute';
        menu.style.top = '100%';
        menu.style.left = '0';
        menu.style.marginTop = '4px';
        menu.style.background = 'var(--mdb-bg-secondary)';
        menu.style.border = '1px solid var(--mdb-border)';
        menu.style.borderRadius = '4px';
        menu.style.padding = '6px';
        menu.style.display = 'none';
        menu.style.flexDirection = 'column';
        menu.style.gap = '6px';
        menu.style.zIndex = '1003';
        menu.style.minWidth = '120px';
        menu.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.18)';

        const swatches = document.createElement('div');
        swatches.className = 'mdb-color-swatches';
        swatches.style.display = 'flex';
        swatches.style.gap = '6px';
        for (const color of CELL_BG_COLORS) {
          const swatch = document.createElement('button');
          swatch.type = 'button';
          swatch.className = 'mdb-color-swatch mdb-color-swatch-bg';
          swatch.title = color.label;
          swatch.setAttribute('aria-label', color.label);
          swatch.style.width = '20px';
          swatch.style.height = '20px';
          swatch.style.borderRadius = '4px';
          swatch.style.border = '1px solid var(--mdb-border)';
          swatch.style.cursor = 'pointer';
          swatch.style.padding = '0';
          swatch.style.background = color.swatch;
          swatch.addEventListener('mousedown', (event) => {
            event.preventDefault();
            event.stopPropagation();
            const selection = getCellSelection(view);
            if (selection) {
              setCellBackground(view, selection.tableIndex, cellRect(selection), color.colorClass);
            }
            this.closeMenu();
          });
          swatches.appendChild(swatch);
        }
        menu.appendChild(swatches);

        const reset = document.createElement('button');
        reset.type = 'button';
        reset.className = 'mdb-cell-toolbar-reset';
        reset.textContent = '恢复默认';
        reset.style.background = 'transparent';
        reset.style.border = 'none';
        reset.style.color = 'var(--mdb-text)';
        reset.style.padding = '4px 6px';
        reset.style.cursor = 'pointer';
        reset.style.borderRadius = '4px';
        reset.style.fontSize = '13px';
        reset.style.textAlign = 'left';
        reset.addEventListener('mousedown', (event) => {
          event.preventDefault();
          event.stopPropagation();
          const selection = getCellSelection(view);
          if (selection) {
            setCellBackground(view, selection.tableIndex, cellRect(selection), null);
          }
          this.closeMenu();
        });
        menu.appendChild(reset);

        dropdown.appendChild(bg);
        dropdown.appendChild(menu);
        root.appendChild(merge);
        root.appendChild(dropdown);

        if (view.dom.style.position === 'static' || view.dom.style.position === '') {
          view.dom.style.position = 'relative';
        }
        view.dom.appendChild(root);

        this.root = root;
        this.mergeBtn = merge;
        this.menu = menu;
      }

      /** Union bounding box of the selected cells, in editor-relative pixels. */
      private selectedRect(selection: CellSelection): DOMRect | null {
        const table = this.view.dom.querySelectorAll('table.cm-table')[selection.tableIndex];
        if (!(table instanceof HTMLTableElement)) return null;
        let left = Number.POSITIVE_INFINITY;
        let top = Number.POSITIVE_INFINITY;
        let right = Number.NEGATIVE_INFINITY;
        let bottom = Number.NEGATIVE_INFINITY;
        let found = false;
        const cells = table.querySelectorAll<HTMLElement>('th[data-row], td[data-row]');
        cells.forEach((cell) => {
          if (!isCellInSelection(selection, Number(cell.dataset.row), Number(cell.dataset.col))) {
            return;
          }
          const rect = cell.getBoundingClientRect();
          left = Math.min(left, rect.left);
          top = Math.min(top, rect.top);
          right = Math.max(right, rect.right);
          bottom = Math.max(bottom, rect.bottom);
          found = true;
        });
        if (!found) return null;
        return new DOMRect(left, top, right - left, bottom - top);
      }

      private position(selection: CellSelection): void {
        if (!this.root) return;
        const rect = this.selectedRect(selection);
        if (!rect) return;
        const editorRect = this.view.dom.getBoundingClientRect();
        const height = this.root.offsetHeight || 0;
        this.root.style.left = `${Math.max(4, rect.left - editorRect.left)}px`;
        this.root.style.top = `${Math.max(4, rect.top - editorRect.top - height - 6)}px`;
      }

      private sync(): void {
        const selection = getCellSelection(this.view);
        if (!selection) {
          this.closeMenu();
          if (this.root) this.root.style.display = 'none';
          return;
        }
        if (!this.root) this.build();
        if (this.root && this.mergeBtn) {
          setButtonDisabled(this.mergeBtn, cellSelectionCount(selection) <= 1);
          this.root.style.display = 'inline-flex';
          this.position(selection);
        }
      }

      destroy(): void {
        this.unsubscribe();
        this.closeMenu();
        this.root?.remove();
        this.root = null;
      }
    },
  );
}
