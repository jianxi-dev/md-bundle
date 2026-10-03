/**
 * Icon system — ticket #322 (editor-fidelity D3).
 *
 * Internal module: builds `<svg data-icon="XxxOutlined" viewBox="0 0 24 24"
 * fill="currentColor">` icons and exposes the block-type → icon-name and
 * action → icon-name maps. Not exported from the package barrel — the
 * curtain test pins the public surface, and icons are an implementation
 * detail shared between block-handle, empty-line-entry, and the floating
 * toolbar.
 *
 * Naming follows the Material "XxxOutlined" convention so the data-icon
 * attribute reads as a stable,greppable vocabulary token. The SVG content
 * is either path data (geometric icons) or a short text glyph (heading
 * level marks H1..H6) — both render under the same viewBox/colour contract.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Default rendered icon size — matches the existing 16px gutter slot. */
const ICON_SIZE_PX = '16px';

type IconDef =
  | { readonly kind: 'text'; readonly label: string; readonly weight?: number }
  | { readonly kind: 'paths'; readonly paths: readonly string[] };

/**
 * Icon registry — the single source of truth for the `data-icon` vocabulary.
 * Adding a new block type or action only needs a new entry here; consumers
 * reference icons by name string, so no call-site changes are required.
 */
const ICON_REGISTRY: Record<string, IconDef> = {
  // Headings — bold "H1".."H6" text marks so each level is visually distinct
  // (AC: "手柄图标随块型切换" must be observable, not just attribute-different).
  H1Outlined: { kind: 'text', label: 'H1', weight: 700 },
  H2Outlined: { kind: 'text', label: 'H2', weight: 700 },
  H3Outlined: { kind: 'text', label: 'H3', weight: 700 },
  H4Outlined: { kind: 'text', label: 'H4', weight: 700 },
  H5Outlined: { kind: 'text', label: 'H5', weight: 700 },
  H6Outlined: { kind: 'text', label: 'H6', weight: 700 },
  HOutlined: { kind: 'text', label: 'H', weight: 700 },

  // Task — checked = circle with checkmark, unchecked = empty square.
  TaskAltOutlined: {
    kind: 'paths',
    paths: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1.2 14.5L6.4 12l1.4-1.4 3 3 5.4-5.4 1.4 1.4z'],
  },
  CheckBoxOutlineBlankOutlined: {
    kind: 'paths',
    paths: ['M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm0 2v14h14V5z'],
  },

  // Blockquote — quotation mark.
  FormatQuoteOutlined: {
    kind: 'paths',
    paths: [
      'M7.5 11a2.5 2.5 0 0 1 2.5 2.5V17a2.5 2.5 0 0 1-2.5 2.5H4A1.5 1.5 0 0 1 2.5 18V11A6.5 6.5 0 0 1 9 4.5v3A3.5 3.5 0 0 0 5.5 11zm10 0a2.5 2.5 0 0 1 2.5 2.5V17a2.5 2.5 0 0 1-2.5 2.5H14A1.5 1.5 0 0 1 12.5 18V11A6.5 6.5 0 0 1 19 4.5v3A3.5 3.5 0 0 0 15.5 11z',
    ],
  },

  // Code — </>
  CodeOutlined: {
    kind: 'paths',
    paths: ['M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6zm5.2-9.2L19.2 12l-4.6 4.6L16 18l6-6-6-6z'],
  },
  CodeOffOutlined: {
    kind: 'paths',
    paths: ['M9.2 6.4L4.6 11l4.6 4.6L8 17l-6-6 6-6zm5.6 11.2L19.4 13l-4.6-4.6L16 7l6 6-6 6z'],
  },

  // List — three horizontal lines with bullet markers.
  ListOutlined: {
    kind: 'paths',
    paths: [
      'M4 6h2v2H4V6zm4 0h12v2H8V6zM4 11h2v2H4v-2zm4 0h12v2H8v-2zM4 16h2v2H4v-2zm4 0h12v2H8v-2z',
    ],
  },

  // Table — grid.
  TableChartOutlined: {
    kind: 'paths',
    paths: [
      'M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm1 2v4h6V5zm0 6v4h6v-4zm0 6v4h6v-4zm8-12v4h6V5zm0 6v4h6v-4zm0 6v4h6v-4z',
    ],
  },

  // Horizontal rule / thematic break.
  HorizontalRuleOutlined: { kind: 'paths', paths: ['M3 11h18v2H3z'] },

  // Image.
  ImageOutlined: {
    kind: 'paths',
    paths: [
      'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm1 2v8l4-4 3 3 4-4 3 3V7zM8 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
    ],
  },

  // Drag handle (six dots) — default/paragraph affordance.
  DragHandleOutlined: {
    kind: 'paths',
    paths: [
      'M9 6a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm6 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM9 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm6 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM9 15a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm6 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z',
    ],
  },

  // Add (+) — empty-line insert affordance.
  AddOutlined: { kind: 'paths', paths: ['M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z'] },

  // Paragraph — pilcrow.
  FormatParagraphOutlined: { kind: 'text', label: '¶' },

  // Arrows.
  ArrowUpwardOutlined: { kind: 'paths', paths: ['M12 4l7 7-1.4 1.4L13 8.8V20h-2V8.8L6.4 12.4 5 11z'] },
  ArrowDownwardOutlined: { kind: 'paths', paths: ['M12 20l7-7-1.4-1.4L13 15.2V4h-2v11.2L6.4 11.6 5 13z'] },

  // Copy.
  ContentCopyOutlined: {
    kind: 'paths',
    paths: [
      'M8 2h12a1 1 0 0 1 1 1v14h-2V4H8V2zM4 6h12a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zm1 2v12h10V8z',
    ],
  },

  // Delete.
  DeleteOutlined: {
    kind: 'paths',
    paths: [
      'M6 7h12v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7zm3-3h6l1 2h4v2H4V6h4l1-2z',
    ],
  },

  // Font colour — a bold "A" the selection toolbar tints per swatch (W5 / #328).
  FormatColorTextOutlined: { kind: 'text', label: 'A', weight: 700 },
};

/** Known icon names — used as a fallback for unmapped names. */
const FALLBACK_ICON_NAME = 'DragHandleOutlined';

/**
 * Icon shown on the block handle before a block type is resolved (and for
 * paragraph/front-matter). Mirrors `blockHandleIcon`'s default so the
 * pre-hover handle and a paragraph hover read as the same affordance.
 */
export const HANDLE_DEFAULT_ICON = FALLBACK_ICON_NAME;

/**
 * Build an `<svg data-icon="name" viewBox="0 0 24 24" fill="currentColor">`
 * element for the given icon name. Always sets the data-icon attribute to
 * `name` (even if the name is not in the registry, so the contract attribute
 * is stable); falls back to the drag-handle paths when the name is unknown.
 */
export function renderIcon(name: string): SVGSVGElement {
  const def = ICON_REGISTRY[name] ?? ICON_REGISTRY[FALLBACK_ICON_NAME];
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('data-icon', name);
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'currentColor');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.width = ICON_SIZE_PX;
  svg.style.height = ICON_SIZE_PX;
  svg.style.flexShrink = '0';
  svg.style.display = 'block';

  if (def.kind === 'text') {
    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('x', '12');
    text.setAttribute('y', '17');
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('font-size', def.weight && def.weight >= 700 ? '11' : '13');
    if (def.weight) text.setAttribute('font-weight', String(def.weight));
    text.textContent = def.label;
    svg.appendChild(text);
  } else {
    for (const d of def.paths) {
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', d);
      svg.appendChild(path);
    }
  }
  return svg;
}

/**
 * Action/convert → icon-name maps — the single source of truth for the
 * block-handle menu. Kept here (not in block-handle-dom) so the icon
 * vocabulary has one home; block-handle-dom imports the names it needs.
 */

/** Icon name for a 转换为 menu row targeting a heading level or paragraph. */
export const CONVERT_ICON_NAME: Record<string, string> = {
  h1: 'H1Outlined',
  h2: 'H2Outlined',
  h3: 'H3Outlined',
  h4: 'H4Outlined',
  h5: 'H5Outlined',
  h6: 'H6Outlined',
  paragraph: 'FormatParagraphOutlined',
};

/** Icon name for a structural action (move/duplicate/delete). */
export const ACTION_ICON_NAME: Record<'move-up' | 'move-down' | 'duplicate' | 'delete', string> = {
  'move-up': 'ArrowUpwardOutlined',
  'move-down': 'ArrowDownwardOutlined',
  duplicate: 'ContentCopyOutlined',
  delete: 'DeleteOutlined',
};

/** Icon name for the empty-line "+" affordance. */
export const ADD_ICON_NAME = 'AddOutlined';
