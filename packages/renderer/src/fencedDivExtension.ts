/**
 * fencedDivExtension.ts — Pandoc fenced divs → layout templates.
 *
 * Converts Pandoc-style fenced divs into HTML wrappers that marked can
 * process natively. The inner content is preserved as markdown for marked
 * to parse.
 *
 * Supported layouts:
 *   {.hero}           → <section class="layout-hero wide">
 *   {.col-2}          → <div class="layout-col-2 wide">
 *   {.col-3}          → <div class="layout-col-3 wide">
 *   {.card-grid}      → <div class="layout-card-grid wide" data-columns="N">
 *   {.timeline}       → <div class="layout-timeline">
 *   {.cta}            → <section class="layout-cta wide">
 *
 * Unknown classes fall back to <div class="layout-{name}">.
 */

// Matches the opening line: ::: {.class [.class2] [key:val ...]}
const FENCED_DIV_OPEN_RE = /^ {0,3}::: {(.+)}\s*$/;

// Parse "class1 class2 key:val" → { classes: string[], attrs: Record<string,string> }
function parseDivAttrs(raw: string): {
  classes: string[];
  attrs: Record<string, string>;
} {
  const classes: string[] = [];
  const attrs: Record<string, string> = {};
  for (const token of raw.matchAll(/([^.:\s][^:\s]*)(?::([^\s]+))?/g)) {
    const key = token[1];
    const val = token[2];
    if (val !== undefined) {
      attrs[key] = val;
    } else {
      classes.push(key);
    }
  }
  return { classes, attrs };
}

// Map a fenced div to its wrapper HTML tag + class attribute.
function resolveWrapper(classes: string[], attrs: Record<string, string>): {
  tag: string;
  className: string;
  extraAttr: string;
} {
  const primary = classes[0] ?? '';
  const rest = classes.slice(1);
  const baseClass = `layout-${primary}`;
  const allClasses = [baseClass, ...rest].filter(Boolean).join(' ');

  switch (primary) {
    case 'hero':
      return { tag: 'section', className: allClasses, extraAttr: '' };
    case 'col-2':
      return { tag: 'div', className: allClasses, extraAttr: '' };
    case 'col-3':
      return { tag: 'div', className: allClasses, extraAttr: '' };
    case 'card-grid': {
      const cols = attrs.cards ?? '3';
      return {
        tag: 'div',
        className: allClasses,
        extraAttr: `data-columns="${cols}"`,
      };
    }
    case 'timeline':
      return { tag: 'div', className: allClasses, extraAttr: '' };
    case 'cta':
      return { tag: 'section', className: allClasses, extraAttr: '' };
    default:
      return { tag: 'div', className: allClasses, extraAttr: '' };
  }
}

/**
 * Preprocess markdown source: replace Pandoc fenced divs with HTML wrappers.
 * The inner content is left as markdown for marked to parse.
 *
 * Returns the transformed source. Fenced divs that are malformed (no closing
 * :::) are left untouched so marked renders them as literal text.
 */
export function preprocessFencedDivs(src: string): string {
  const lines = src.split('\n');
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const openMatch = FENCED_DIV_OPEN_RE.exec(line);

    if (!openMatch) {
      result.push(line);
      i++;
      continue;
    }

    const { classes, attrs } = parseDivAttrs(openMatch[1]);
    if (classes.length === 0) {
      result.push(line);
      i++;
      continue;
    }

    // Find the closing ::: line (track nesting depth)
    let depth = 1;
    let endIdx = -1;
    for (let j = i + 1; j < lines.length; j++) {
      const inner = lines[j];
      if (FENCED_DIV_OPEN_RE.test(inner)) {
        depth++;
      } else if (/^ {0,3}:::\s*$/.test(inner)) {
        depth--;
        if (depth === 0) {
          endIdx = j;
          break;
        }
      }
    }

    if (endIdx === -1) {
      // No closing ::: found — leave as-is
      result.push(line);
      i++;
      continue;
    }

    const wrapper = resolveWrapper(classes, attrs);
    const { tag, className, extraAttr } = wrapper;
    const attrStr = extraAttr ? ` ${extraAttr}` : '';

    // Opening tag (block-level HTML so marked passes it through)
    result.push(`<${tag} class="${className}"${attrStr}>`);
    result.push('');

    // Inner content — pass through as-is (marked will parse markdown inside)
    for (let k = i + 1; k < endIdx; k++) {
      result.push(lines[k]);
    }

    result.push('');
    // Closing tag
    result.push(`</${tag}>`);

    i = endIdx + 1;
  }

  return result.join('\n');
}
