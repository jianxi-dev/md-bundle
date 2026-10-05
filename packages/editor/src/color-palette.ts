/**
 * Shared dual-palette color renderer (ticket #360 — change editor-fidelity-2
 * task 2.5).
 *
 * #278 gave the block-handle flyout and the floating toolbar two separate
 * color implementations that drifted apart (different counts, different
 * values). This module is the single renderer both surfaces call, so the
 * 字体色 A-row, the 背景色 row and 恢复默认 cannot diverge again.
 *
 * Colors and counts are the prototype machine-read values (functional-spec
 * §2.6 `fontColors` / `bgColors`): 8 font swatches (default + 7) and 16
 * background swatches (none + 15). Applying a swatch runs a `color-*` /
 * `bg-*` / `color-reset` command through the caller's `onPick`.
 *
 * Not a public entry — consumed by `block-handle-dom.ts` and
 * `floating-toolbar.ts` only.
 */

export const COLOR_PALETTE_CLASS = 'mdb-color-palette';
export const COLOR_ROW_CLASS = 'mdb-color-row';
export const COLOR_ROW_LABEL_CLASS = 'mdb-color-row-label';
export const COLOR_SWATCHES_CLASS = 'mdb-color-swatches';
export const COLOR_FONT_SWATCH_CLASS = 'mdb-color-font-swatch';
export const COLOR_BG_SWATCH_CLASS = 'mdb-color-bg-swatch';
export const COLOR_SWATCH_DEFAULT_CLASS = 'mdb-color-swatch-default';
export const COLOR_SWATCH_SLASH_CLASS = 'mdb-color-swatch-slash';
export const COLOR_SWATCH_GLYPH_CLASS = 'mdb-color-swatch-text-glyph';
export const COLOR_RESET_CLASS = 'mdb-color-reset';
/** Command id carried by each swatch/reset, read by tests and click wiring. */
export const COLOR_COMMAND_ATTR = 'data-color-command';
/** Prototype color value carried by each swatch (`''` for the bg "none" slot). */
export const COLOR_VALUE_ATTR = 'data-color';

/** One swatch descriptor: which command it runs, its prototype color, its label. */
export interface ColorSwatchDef {
  readonly commandId: string;
  /** Prototype hex value; empty string for the background "none" slot. */
  readonly color: string;
  readonly label: string;
  /** Renders transparent with a diagonal slash (default / none). */
  readonly isDefault?: boolean;
}

/**
 * 字体颜色 row — prototype `fontColors` L456, exactly 8 entries. The first
 * (`#ebebeb`) is the default/reset swatch (clears the text color).
 */
export const FONT_COLORS: readonly ColorSwatchDef[] = [
  { commandId: 'color-clear', color: '#ebebeb', label: '默认', isDefault: true },
  { commandId: 'color-red', color: '#f0000e', label: '红色' },
  { commandId: 'color-orange', color: '#f2962c', label: '橙色' },
  { commandId: 'color-yellow', color: '#f0b622', label: '黄色' },
  { commandId: 'color-green', color: '#419e34', label: '绿色' },
  { commandId: 'color-cyan', color: '#20b2aa', label: '青色' },
  { commandId: 'color-blue', color: '#4c88ff', label: '蓝色' },
  { commandId: 'color-purple', color: '#8a5cf6', label: '紫色' },
];

/**
 * 背景颜色 row — prototype `bgColors` L460, exactly 16 entries. The first is
 * the "none" swatch (clears the background); the remaining 15 are colors.
 */
export const BACKGROUND_COLORS: readonly ColorSwatchDef[] = [
  { commandId: 'bg-clear', color: '', label: '无', isDefault: true },
  { commandId: 'bg-red', color: '#f0000e', label: '红色' },
  { commandId: 'bg-orange', color: '#f2962c', label: '橙色' },
  { commandId: 'bg-yellow', color: '#f0b622', label: '黄色' },
  { commandId: 'bg-green', color: '#419e34', label: '绿色' },
  { commandId: 'bg-cyan', color: '#20b2aa', label: '青色' },
  { commandId: 'bg-blue', color: '#4c88ff', label: '蓝色' },
  { commandId: 'bg-purple', color: '#8a5cf6', label: '紫色' },
  { commandId: 'bg-gray', color: '#ebebeb', label: '浅灰' },
  { commandId: 'bg-darkred', color: '#b34444', label: '暗红' },
  { commandId: 'bg-brown', color: '#845117', label: '棕色' },
  { commandId: 'bg-olive', color: '#877b10', label: '橄榄绿' },
  { commandId: 'bg-darkgreen', color: '#296b22', label: '深绿' },
  { commandId: 'bg-navy', color: '#203e78', label: '藏蓝' },
  { commandId: 'bg-indigo', color: '#4d2691', label: '靛紫' },
  { commandId: 'bg-slate', color: '#5f5f5f', label: '深灰' },
];

/**
 * Run `commandId` when a swatch or the reset button is pressed. `mousedown`
 * (not `click`) mirrors the toolbar's existing controls: it fires before the
 * editor moves focus away from the selection, so the command still sees it.
 */
function wirePick(button: HTMLButtonElement, commandId: string, onPick: (id: string) => void): void {
  button.addEventListener('mousedown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    onPick(commandId);
  });
}

function createSwatchButton(
  def: ColorSwatchDef,
  variant: 'font' | 'bg',
  onPick: (id: string) => void,
): HTMLButtonElement {
  const swatch = document.createElement('button');
  swatch.type = 'button';
  swatch.className = variant === 'font' ? COLOR_FONT_SWATCH_CLASS : COLOR_BG_SWATCH_CLASS;
  swatch.setAttribute(COLOR_COMMAND_ATTR, def.commandId);
  swatch.setAttribute(COLOR_VALUE_ATTR, def.color);
  swatch.title = def.label;
  swatch.setAttribute('aria-label', def.label);
  swatch.style.position = 'relative';
  swatch.style.width = '18px';
  swatch.style.height = '18px';
  swatch.style.padding = '0';
  swatch.style.border = '1px solid var(--mdb-border)';
  swatch.style.borderRadius = '4px';
  swatch.style.cursor = 'pointer';
  swatch.style.overflow = 'hidden';
  swatch.style.boxSizing = 'border-box';

  if (variant === 'font') {
    // Font colors are a tinted "A" glyph, not a filled chip.
    swatch.style.background = 'transparent';
    swatch.style.display = 'flex';
    swatch.style.alignItems = 'center';
    swatch.style.justifyContent = 'center';
    const glyph = document.createElement('span');
    glyph.className = COLOR_SWATCH_GLYPH_CLASS;
    glyph.textContent = 'A';
    glyph.style.fontSize = '15px';
    glyph.style.fontWeight = '600';
    glyph.style.lineHeight = '1';
    glyph.style.color = def.color;
    swatch.appendChild(glyph);
  } else {
    swatch.style.background = def.isDefault ? 'transparent' : def.color;
  }

  if (def.isDefault) {
    swatch.classList.add(COLOR_SWATCH_DEFAULT_CLASS);
    const slash = document.createElement('span');
    slash.className = COLOR_SWATCH_SLASH_CLASS;
    slash.setAttribute('aria-hidden', 'true');
    slash.style.position = 'absolute';
    slash.style.left = '-3px';
    slash.style.top = '50%';
    slash.style.width = '24px';
    slash.style.height = '1px';
    slash.style.background = 'var(--mdb-muted, #9a9a9a)';
    slash.style.transform = 'rotate(-45deg)';
    swatch.appendChild(slash);
  }

  wirePick(swatch, def.commandId, onPick);
  return swatch;
}

function createRow(
  label: string,
  defs: readonly ColorSwatchDef[],
  variant: 'font' | 'bg',
  onPick: (id: string) => void,
): HTMLElement {
  const row = document.createElement('div');
  row.className = COLOR_ROW_CLASS;
  row.style.display = 'flex';
  row.style.flexDirection = 'column';
  row.style.gap = '4px';

  const labelEl = document.createElement('span');
  labelEl.className = COLOR_ROW_LABEL_CLASS;
  labelEl.textContent = label;
  labelEl.style.fontSize = '11px';
  labelEl.style.color = 'var(--mdb-text-secondary)';

  const swatches = document.createElement('div');
  swatches.className = COLOR_SWATCHES_CLASS;
  swatches.style.display = 'grid';
  // The prototype row is a fixed 8-column grid; the 16 background swatches wrap
  // onto two rows automatically.
  swatches.style.gridTemplateColumns = 'repeat(8, 18px)';
  swatches.style.gap = '4px';

  for (const def of defs) swatches.appendChild(createSwatchButton(def, variant, onPick));

  row.appendChild(labelEl);
  row.appendChild(swatches);
  return row;
}

/**
 * The single palette DOM: 字体色 row (8 A-swatches), 背景色 row (16 swatches)
 * and a full-width 恢复默认 action. Both the block-handle flyout and the
 * floating-toolbar popup mount exactly this node.
 */
export function createColorPalette(onPick: (commandId: string) => void): HTMLElement {
  const root = document.createElement('div');
  root.className = COLOR_PALETTE_CLASS;
  root.style.display = 'flex';
  root.style.flexDirection = 'column';
  root.style.gap = '6px';

  root.appendChild(createRow('字体色', FONT_COLORS, 'font', onPick));
  root.appendChild(createRow('背景色', BACKGROUND_COLORS, 'bg', onPick));

  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = COLOR_RESET_CLASS;
  reset.textContent = '恢复默认';
  reset.style.width = '100%';
  reset.style.height = '30px';
  reset.style.boxSizing = 'border-box';
  reset.style.background = 'transparent';
  reset.style.border = '1px solid var(--mdb-border)';
  reset.style.borderRadius = '4px';
  reset.style.color = 'var(--mdb-text)';
  reset.style.cursor = 'pointer';
  reset.style.fontSize = '12px';
  wirePick(reset, 'color-reset', onPick);
  root.appendChild(reset);

  return root;
}
