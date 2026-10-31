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

  // Inline format — the doubao vocabulary (spec: .lavish/doubao-editor-spec-v2.html).
  // These replace the text glyphs (`B`/`I`/`U`/`S`) the toolbar used to print (#471).
  BoldOutlined: {
    kind: 'paths',
    paths: [
      'M6 4h6.2a4 4 0 0 1 2.9 6.7A4.2 4.2 0 0 1 13 18H6zm3 2.6v3.6h3.2a1.8 1.8 0 0 0 0-3.6zm0 6.2v3.6h4a1.8 1.8 0 0 0 0-3.6z',
    ],
  },
  ItalicOutlined: {
    kind: 'paths',
    paths: ['M10 4h6v2h-2.2l-3.4 12H13v2H7v-2h2.2l3.4-12H10z'],
  },
  UnderlineOutlined: {
    kind: 'paths',
    paths: ['M6 3h2v8a4 4 0 0 0 8 0V3h2v8a6 6 0 0 1-12 0zM5 20h14v2H5z'],
  },
  StrikethroughOutlined: {
    kind: 'paths',
    paths: [
      'M12 3c3 0 5 1.4 5 3.8h-2c0-1.1-1.2-1.8-3-1.8s-3 .6-3 1.8c0 .7.4 1.2 1.3 1.6H8.2C7.5 7.8 7 7.1 7 6c0-2.2 2-3 5-3z',
      'M4 11h16v2H4z',
      'M12 21c-3 0-5-1.4-5-3.8h2c0 1.1 1.2 1.8 3 1.8s3-.6 3-1.8c0-.7-.4-1.2-1.3-1.6h2.1c.7.6 1.2 1.3 1.2 2.4 0 2.2-2 3-5 3z',
    ],
  },
  FontcolorOutlined: {
    kind: 'paths',
    paths: [
      'M9.4 4h2.2L16.4 18h-2.3l-.9-3.2H8.8L7.9 18H5.6zm.3 8.9h3.6l-1.8-6z',
      'M4 20h16v2H4z',
    ],
  },
  DocColumnsOutlined: {
    kind: 'paths',
    paths: ['M4 4h7v16H4zm9 0h7v16h-7zM6 6v12h3V6zm9 0v12h3V6z'],
  },
  GlobalLinkOutlined: {
    kind: 'paths',
    paths: [
      'M10.6 13.4a1 1 0 0 1 0-1.4l2.8-2.8a4 4 0 0 1 5.7 5.7l-1.4 1.4-1.4-1.4 1.4-1.4a2 2 0 1 0-2.9-2.9l-2.8 2.8a1 1 0 0 1-1.4 0z',
      'M13.4 10.6a1 1 0 0 1 0 1.4l-2.8 2.8a4 4 0 0 1-5.7-5.7l1.4-1.4 1.4 1.4-1.4 1.4a2 2 0 1 0 2.9 2.9l2.8-2.8a1 1 0 0 1 1.4 0z',
    ],
  },
  DeleteTrashOutlined: {
    kind: 'paths',
    paths: ['M9 3h6l1 2h4v2H4V5h4zM6 8h12l-1 12a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2zm3 3v8h2v-8zm4 0v8h2v-8z'],
  },
  TypographyOutlined: {
    kind: 'paths',
    paths: ['M4 4h16v3h-6.5v13h-3V7H4z'],
  },
  InlineCodeOutlined: {
    kind: 'paths',
    paths: ['M9.4 7.4 4.8 12l4.6 4.6-1.4 1.4L1.9 12 8 5.9zM14.6 7.4 20.1 12l-5.5 5.4-1.4-1.4L17.3 12l-4.1-4.6z'],
  },

  StyleSetOutlined: {
    kind: 'paths',
    paths: [
      'M12 3a9 9 0 0 1 9 9 3 3 0 0 1-3 3h-1.2a1.8 1.8 0 0 0 0 3.6H18a3 3 0 0 1-3 3 9 9 0 1 1-3-18zm-3.5 5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm2 6a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm6-1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm-4-5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z',
    ],
  },

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

  // Drag (four dots, compact) — right segment of the two-segment pill handle.
  DragOutlined: {
    kind: 'paths',
    paths: [
      'M9 8a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm6 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM9 14a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm6 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z',
    ],
  },

  // Add (+) — empty-line insert affordance.
  AddOutlined: { kind: 'paths', paths: ['M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z'] },

  // Alignment — simple rule glyphs, sized for the 18px toolbar slot.
  AlignLeftOutlined: { kind: 'paths', paths: ['M4 6h16M4 10h10M4 14h16M4 18h10'] },
  AlignCenterOutlined: { kind: 'paths', paths: ['M4 6h16M7 10h10M4 14h16M7 18h10'] },
  AlignRightOutlined: { kind: 'paths', paths: ['M4 6h16M10 10h10M4 14h16M10 18h10'] },
  AlignClearOutlined: { kind: 'paths', paths: ['M4 6h16M4 12h16M4 18h16'] },

  // Paragraph / text block — pilcrow.
  TextOutlined: { kind: 'text', label: '¶', weight: 700 },

  // Ordered list — numbered list marker.
  OrderListOutlined: {
    kind: 'paths',
    paths: ['M5 5h14v2H5zm0 5h14v2H5zm0 5h14v2H5zM3 5v2h1v-2zm0 5v2h1v-2zm0 5v2h1v-2z'],
  },

  // Unordered (disorder) list — bullet list marker.
  DisorderListOutlined: {
    kind: 'paths',
    paths: ['M4 6h2v2H4V6zm4 0h12v2H8V6zM4 11h2v2H4v-2zm4 0h12v2H8v-2zM4 16h2v2H4v-2zm4 0h12v2H8v-2z'],
  },

  // Task / todo list — checkbox.
  TodoOutlined: {
    kind: 'paths',
    paths: ['M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm0 2v14h14V5z'],
  },

  // Code block — fenced code.
  CodeblockOutlined: {
    kind: 'paths',
    paths: ['M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6zm5.2-9.2L19.2 12l-4.6 4.6L16 18l6-6-6-6z'],
  },

  // Reference / blockquote — quotation mark.
  ReferenceOutlined: {
    kind: 'paths',
    paths: [
      'M7.5 11a2.5 2.5 0 0 1 2.5 2.5V17a2.5 2.5 0 0 1-2.5 2.5H4A1.5 1.5 0 0 1 2.5 18V11A6.5 6.5 0 0 1 9 4.5v3A3.5 3.5 0 0 0 5.5 11zm10 0a2.5 2.5 0 0 1 2.5 2.5V17a2.5 2.5 0 0 1-2.5 2.5H14A1.5 1.5 0 0 1 12.5 18V11A6.5 6.5 0 0 1 19 4.5v3A3.5 3.5 0 0 0 15.5 11z',
    ],
  },

  // Callout — info circle with exclamation.
  CalloutOutlined: {
    kind: 'paths',
    paths: [
      'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm-1 11h2v2h-2zm0-6h2v4h-2z',
    ],
  },

  // Data sheet / table — grid.
  DataSheetOutlined: {
    kind: 'paths',
    paths: [
      'M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm1 2v4h6V5zm0 6v4h6v-4zm0 6v4h6v-4zm8-12v4h6V5zm0 6v4h6v-4zm0 6v4h6v-4z',
    ],
  },

  // Divider / thematic break — horizontal rule.
  DividerOutlined: { kind: 'paths', paths: ['M3 11h18v2H3z'] },

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

  HeaderRowOutlined: {
    kind: 'paths',
    paths: ['M4 5h16a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm0 4h16a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm0 4h16a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z'],
  },

  HeaderColumnOutlined: {
    kind: 'paths',
    paths: ['M5 4v16a1 1 0 0 1-1 1h2a1 1 0 0 1 1-1V4a1 1 0 0 1-1-1H5zm4 0v16a1 1 0 0 1-1 1h2a1 1 0 0 1 1-1V4a1 1 0 0 1-1-1h-2zm4 0v16a1 1 0 0 1-1 1h2a1 1 0 0 1 1-1V4a1 1 0 0 1-1-1h-2z'],
  },

  DistributeColumnsOutlined: {
    kind: 'paths',
    paths: ['M3 3h18v2H3zm0 4h18v2H3zm0 4h18v2H3zm0 4h18v2H3zM5 5v2h2V5zm4 0v2h2V5zm4 0v2h2V5zm4 0v2h2V5zM5 9v2h2V9zm4 0v2h2V9zm4 0v2h2V9zm4 0v2h2V9zM5 13v2h2v-2zm4 0v2h2v-2zm4 0v2h2v-2zm4 0v2h2v-2zM5 17v2h2v-2zm4 0v2h2v-2zm4 0v2h2v-2zm4 0v2h2v-2z'],
  },

  LinkRecordOutlined: {
    kind: 'paths',
    paths: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm-1 7.5V14h2v-4.5a2.5 2.5 0 0 1 5 0V14h2v-4.5a4.5 4.5 0 0 0-9 0z'],
  },

  NewJoinMeetingOutlined: {
    kind: 'paths',
    paths: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm-1 7.5V14h2v-4.5a2.5 2.5 0 0 1 5 0V14h2v-4.5a4.5 4.5 0 0 0-9 0zM12 6a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm0 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4z'],
  },

  FeishuclipOutlined: {
    kind: 'paths',
    paths: ['M7 4h10a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm0 2v14h10V6H7zm5-3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V3z'],
  },

  CopyOutlined: {
    kind: 'paths',
    paths: ['M8 2h12a1 1 0 0 1 1 1v14h-2V4H8V2zM4 6h12a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zm1 2v12h10V8H5z'],
  },

  TranslateOutlined: {
    kind: 'paths',
    paths: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm-4.5 7.5a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0zm9 0a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0zM7.5 15a3.5 3.5 0 1 0 7 0 3.5 3.5 0 0 0-7 0z'],
  },

  SharewordsOutlined: {
    kind: 'paths',
    paths: ['M18 6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h12m0-2H6a4 4 0 0 0-4 4v8a4 4 0 0 0 4 4h12a4 4 0 0 0 4-4V8a4 4 0 0 0-4-4zM8 10h8v4H8zm0 6h5v2H8z'],
  },

  BlocklinkOutlined: {
    kind: 'paths',
    paths: ['M15.5 5.5a3.5 3.5 0 1 1-4.95 4.95 3.5 3.5 0 0 1 4.95-4.95zM10 15.5a3.5 3.5 0 1 1-4.95-4.95 3.5 3.5 0 0 1 4.95 4.95zM15.5 10.5a2 2 0 1 0-2.83 2.83 2 2 0 0 0 2.83-2.83zM10 10.5a2 2 0 1 0-2.83-2.83 2 2 0 0 0 2.83 2.83z'],
  },

  AddCommentOutlined: {
    kind: 'paths',
    paths: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm-1 7.5V14h2v-4.5a2.5 2.5 0 0 1 5 0V14h2v-4.5a4.5 4.5 0 0 0-9 0zM12 6a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm0 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4z'],
  },
};


/**
 * Command id → icon name. The ONE place a command maps to a glyph name; the
 * toolbar, the command palette and the code-block toolbar all resolve through
 * it, so no surface can drift back to printing raw text (#471).
 */
export const COMMAND_ICON_NAME: Readonly<Record<string, string>> = {
  'toggle-bold': 'BoldOutlined',
  'toggle-italic': 'ItalicOutlined',
  'toggle-underline': 'UnderlineOutlined',
  'toggle-strikethrough': 'StrikethroughOutlined',
  'toggle-code': 'InlineCodeOutlined',
  'toggle-link': 'GlobalLinkOutlined',
  'insert-unordered-list': 'DisorderListOutlined',
  'insert-ordered-list': 'OrderListOutlined',
  'insert-task-list': 'TodoOutlined',
  'insert-quote': 'FormatQuoteOutlined',
  'insert-code-block': 'CodeblockOutlined',
  'insert-table': 'TableChartOutlined',
  'insert-callout': 'CalloutOutlined',
  'insert-html': 'CodeOutlined',
  'insert-css': 'CodeOutlined',
  'code-copy': 'CopyOutlined',
  'heading-1': 'H1Outlined',
  'heading-2': 'H2Outlined',
  'heading-3': 'H3Outlined',
  'heading-4': 'H4Outlined',
  'heading-5': 'H5Outlined',
  'heading-6': 'H6Outlined',
  paragraph: 'FormatParagraphOutlined',
  'structure-check': 'TextOutlined',
  'font-serif': 'TypographyOutlined',
  'font-mono': 'TypographyOutlined',
  'font-sans': 'TypographyOutlined',
  'font-clear': 'TypographyOutlined',
  'color-red': 'FontcolorOutlined',
  'color-blue': 'FontcolorOutlined',
  'color-green': 'FontcolorOutlined',
  'color-orange': 'FontcolorOutlined',
  'color-purple': 'FontcolorOutlined',
  'color-yellow': 'FontcolorOutlined',
  'color-cyan': 'FontcolorOutlined',
  'color-clear': 'FontcolorOutlined',
  'bg-red': 'StyleSetOutlined',
  'bg-blue': 'StyleSetOutlined',
  'bg-green': 'StyleSetOutlined',
  'bg-orange': 'StyleSetOutlined',
  'bg-purple': 'StyleSetOutlined',
  'bg-yellow': 'StyleSetOutlined',
  'bg-cyan': 'StyleSetOutlined',
  'bg-gray': 'StyleSetOutlined',
  'bg-darkred': 'StyleSetOutlined',
  'bg-brown': 'StyleSetOutlined',
  'bg-olive': 'StyleSetOutlined',
  'bg-darkgreen': 'StyleSetOutlined',
  'bg-navy': 'StyleSetOutlined',
  'bg-indigo': 'StyleSetOutlined',
  'bg-slate': 'StyleSetOutlined',
  'bg-clear': 'StyleSetOutlined',
  'color-reset': 'StyleSetOutlined',
  'align-left': 'AlignLeftOutlined',
  'align-center': 'AlignCenterOutlined',
  'align-right': 'AlignRightOutlined',
  'align-clear': 'AlignClearOutlined',
  'col-1': 'DocColumnsOutlined',
  'col-2': 'DocColumnsOutlined',
  'col-3': 'DocColumnsOutlined',
  'col-4': 'DocColumnsOutlined',
  'col-5': 'DocColumnsOutlined',
  'col-clear': 'DocColumnsOutlined',
  'turn-into-h1': 'H1Outlined',
  'turn-into-h2': 'H2Outlined',
  'turn-into-h3': 'H3Outlined',
  'turn-into-h4': 'H4Outlined',
  'turn-into-h5': 'H5Outlined',
  'turn-into-h6': 'H6Outlined',
  'turn-into-paragraph': 'FormatParagraphOutlined',
  'turn-into-list': 'DisorderListOutlined',
  'turn-into-task': 'TodoOutlined',
  'turn-into-quote': 'ReferenceOutlined',
  'turn-into-code': 'CodeblockOutlined',
  'turn-into-callout': 'CalloutOutlined',
  'turn-into-table': 'TableChartOutlined',
  delete: 'DeleteTrashOutlined',
  duplicate: 'CopyOutlined',
  'move-up': 'ArrowUpwardOutlined',
  'move-down': 'ArrowDownwardOutlined',
};

/**
 * Resolve the icon NAME for a command, in priority order: an explicit name that
 * is registered, then the SSOT map. `null` means "no icon — caller may print a
 * label".
 */
export function resolveIconName(commandId: string, declared?: string): string | null {
  if (declared && hasIcon(declared)) return declared;
  const mapped = COMMAND_ICON_NAME[commandId];
  if (mapped && hasIcon(mapped)) return mapped;
  return null;
}

/**
 * Fill `el` with the resolved SVG icon. Returns false when nothing was
 * rendered (caller decides the text fallback).
 */
export function renderIconInto(el: HTMLElement, commandId: string, declared?: string): boolean {
  const name = resolveIconName(commandId, declared);
  if (!name) return false;
  el.replaceChildren(renderIcon(name));
  return true;
}

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
  ordered: 'OrderListOutlined',
  bullet: 'DisorderListOutlined',
  todo: 'TodoOutlined',
  code: 'CodeblockOutlined',
  quote: 'ReferenceOutlined',
  callout: 'CalloutOutlined',
};

/** Icon name for a structural action (move/duplicate/delete). */
export const ACTION_ICON_NAME: Record<'move-up' | 'move-down' | 'duplicate' | 'delete', string> = {
  'move-up': 'ArrowUpwardOutlined',
  'move-down': 'ArrowDownwardOutlined',
  duplicate: 'ContentCopyOutlined',
  delete: 'DeleteOutlined',
};

/** True when `name` is a registry icon (so a toolbar option can render an SVG). */
export function hasIcon(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(ICON_REGISTRY, name);
}

/** Icon name for the empty-line "+" affordance. */
export const ADD_ICON_NAME = 'AddOutlined';
