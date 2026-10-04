/**
 * Mermaid fenced-block decoration — renders an inactive ```mermaid block as a
 * diagram in edit mode while the raw source stays authoritative.
 *
 * The whole block is replaced by one widget when the cursor is outside it, so
 * no fence text survives in the inactive DOM; moving the cursor into the block
 * drops the replace and reveals the editable source (semantic editing mode).
 *
 * Hydration reuses the renderer's shared lazy pipeline. The widget root WRAPS a
 * `div.mermaid-block` because `hydrateLazyFeatures` matches blocks via
 * `querySelectorAll('div.mermaid-block')`, which never matches its own context
 * node — the wrapper makes the block a discoverable descendant.
 */
import type { Range } from '@codemirror/state';
import { Decoration, WidgetType } from '@codemirror/view';
import { hydrateLazyFeatures } from '@md-bundle/renderer';

export type MermaidTheme = 'dark' | 'light';

/** Injectable hydration seam; matches `hydrateLazyFeatures`' call signature. */
export type MermaidHydrator = (root: HTMLElement, theme: MermaidTheme) => Promise<void>;

/** Default theme source: the document's `data-theme` attribute. */
function currentTheme(): MermaidTheme {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

interface MermaidBlock {
  from: number;
  to: number;
  source: string;
}

const FENCE_OPEN_RE = /^( {0,3})(`{3,}|~{3,})[ \t]*([^\n]*)$/;
const FENCE_CLOSE_RE = /^( {0,3})(`{3,}|~{3,})[ \t]*$/;

/**
 * Find every ```mermaid / ~~~mermaid block. Ranges are whole-line: start of the
 * opening fence line → end of the closing fence line (`block: true` requires
 * line-aligned ranges). An unclosed fence extends to the end of the document.
 */
function parseMermaidBlocks(docText: string): MermaidBlock[] {
  const lines = docText.split('\n');
  const offsets: number[] = [];
  let acc = 0;
  for (const line of lines) {
    offsets.push(acc);
    acc += line.length + 1;
  }

  const blocks: MermaidBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const open = FENCE_OPEN_RE.exec(lines[i]);
    const language = open ? open[3].trim().split(/\s+/)[0] : '';
    if (!open || language !== 'mermaid') {
      i += 1;
      continue;
    }
    const fenceChar = open[2][0];
    const fenceLen = open[2].length;

    let close = -1;
    for (let j = i + 1; j < lines.length; j += 1) {
      const m = FENCE_CLOSE_RE.exec(lines[j]);
      if (m && m[2][0] === fenceChar && m[2].length >= fenceLen) {
        close = j;
        break;
      }
    }

    const contentStart = offsets[i] + lines[i].length + 1;
    const contentEnd = close === -1 ? docText.length : offsets[close];
    let source = docText.slice(contentStart, contentEnd);
    if (source.endsWith('\n')) source = source.slice(0, -1);

    blocks.push({
      from: offsets[i],
      to: close === -1 ? docText.length : offsets[close] + lines[close].length,
      source,
    });
    i = close === -1 ? lines.length : close + 1;
  }
  return blocks;
}

class MermaidWidget extends WidgetType {
  constructor(
    private readonly _source: string,
    private readonly _hydrate: MermaidHydrator,
    private readonly _theme: MermaidTheme,
  ) {
    super();
  }

  eq(other: MermaidWidget): boolean {
    return other._source === this._source;
  }

  toDOM(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'cm-mermaid-block wide';

    const block = document.createElement('div');
    block.className = 'mermaid-block wide';
    const pre = document.createElement('pre');
    pre.className = 'mermaid';
    pre.textContent = this._source;
    block.appendChild(pre);
    container.appendChild(block);

    // Fire-and-forget: a hydrator failure must never break the editor, so both
    // an async rejection and a synchronous throw are swallowed.
    try {
      void this._hydrate(container, this._theme).catch(() => {});
    } catch {
      // ignore — the source stays visible and the block remains editable
    }
    return container;
  }

  /**
   * Hand clicks to CM6 so it places the cursor in the block and the raw fence
   * is revealed. `eventBelongsToEditor` treats an event as the editor's only
   * when this returns false, so false is what makes the click fall through.
   */
  ignoreEvent(): boolean {
    return false;
  }
}

/**
 * Build mermaid decorations. Active blocks (overlapping `[activeFrom, activeTo]`)
 * emit nothing so the raw fence stays editable; inactive blocks are fully
 * replaced by the rendered diagram.
 */
export function createMermaidDecorations(
  docText: string,
  activeFrom: number = -1,
  activeTo: number = -1,
  hydrateMermaid?: MermaidHydrator,
  theme?: MermaidTheme,
): Range<Decoration>[] {
  const hydrate: MermaidHydrator = hydrateMermaid ?? hydrateLazyFeatures;
  const resolvedTheme = theme ?? currentTheme();

  return parseMermaidBlocks(docText)
    .filter((block) => !(activeFrom >= 0 && block.from < activeTo && block.to > activeFrom))
    .map((block) =>
      Decoration.replace({
        widget: new MermaidWidget(block.source, hydrate, resolvedTheme),
        block: true,
      }).range(block.from, block.to),
    );
}
