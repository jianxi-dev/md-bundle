/* Command palette DOM builders — element factories with no editor dependency.
 *
 * Split out of command-palette.ts to keep that module under the 250-pure-LOC
 * ceiling. Callers pass activation callbacks so this file never imports
 * EditorView. NOT part of the package public API.
 */

import type { MatchEntry } from './command-palette-search';
import { formatKeyChord } from './keybindings';

/** Full-viewport scrim. `onOutside` fires on mousedown anywhere on it. */
export function createPaletteBackdrop(onOutside: () => void): HTMLDivElement {
  const backdrop = document.createElement('div');
  backdrop.className = 'mdb-palette-backdrop';
  backdrop.setAttribute('data-testid', 'command-palette-backdrop');
  Object.assign(backdrop.style, {
    position: 'fixed',
    inset: '0',
    top: '0',
    right: '0',
    bottom: '0',
    left: '0',
    background: 'rgba(0,0,0,0.45)',
    zIndex: '2000',
  });
  backdrop.addEventListener('mousedown', (e) => {
    e.preventDefault();
    onOutside();
  });
  return backdrop;
}

/** Sticky group header above each command group (or the 最近 section). */
export function createGroupHeader(group: string): HTMLDivElement {
  const header = document.createElement('div');
  header.className = 'mdb-palette-group';
  header.setAttribute('data-testid', 'command-palette-group');
  header.textContent = group;
  Object.assign(header.style, {
    position: 'sticky',
    top: '0',
    zIndex: '2',
    padding: '10px 10px 6px',
    fontSize: '11.5px',
    fontWeight: '600',
    letterSpacing: '0.04em',
    color: 'var(--mdb-text-secondary)',
    background: 'var(--mdb-bg-secondary)',
  });
  return header;
}

/**
 * A single command row: icon | label (with `<b>` highlights) | description | kbd.
 * The description column is `flex: 1`, so the shortcut always ends flush right.
 */
export function createPaletteRow(
  entry: MatchEntry,
  selected: boolean,
  onActivate: () => void,
): HTMLDivElement {
  const row = document.createElement('div');
  row.className = selected
    ? 'mdb-palette-item mdb-palette-item--selected'
    : 'mdb-palette-item';
  row.setAttribute('data-testid', 'command-palette-item');
  row.setAttribute('role', 'option');
  row.setAttribute('aria-selected', selected ? 'true' : 'false');
  Object.assign(row.style, {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    height: '32px',
    minHeight: '32px',
    maxHeight: '32px',
    padding: '0 8px',
    borderRadius: '9px',
    cursor: 'pointer',
    position: 'relative',
    boxSizing: 'border-box',
  });
  if (selected) {
    row.setAttribute('data-selected', 'true');
    // Brand-tinted selection (primary at 30% — matches the prototype's --sel-strong).
    row.style.background = 'rgba(123, 134, 234, 0.30)';
  }

  const icon = document.createElement('span');
  icon.className = 'mdb-palette-icon';
  icon.textContent = entry.icon ?? '•';
  Object.assign(icon.style, {
    flex: 'none',
    width: '20px',
    height: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    color: selected ? 'var(--mdb-primary)' : 'var(--mdb-text-secondary)',
    background: 'var(--mdb-surface)',
    border: `1px solid var(--mdb-border)`,
    borderRadius: '6px',
  });
  row.appendChild(icon);

  const label = document.createElement('span');
  label.className = 'mdb-palette-label';
  Object.assign(label.style, {
    flex: 'none',
    maxWidth: '280px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: '12px',
    color: 'var(--mdb-text)',
  });
  const marked = new Set(entry.matchPositions);
  [...entry.label].forEach((ch, index) => {
    if (marked.has(index)) {
      const mark = document.createElement('b');
      mark.textContent = ch;
      Object.assign(mark.style, { color: 'var(--mdb-primary)', fontWeight: '700' });
      label.appendChild(mark);
    } else {
      label.appendChild(document.createTextNode(ch));
    }
  });
  row.appendChild(label);

  const desc = document.createElement('span');
  desc.className = 'mdb-palette-desc';
  desc.setAttribute('data-testid', 'command-palette-desc');
  desc.textContent = entry.description ?? '';
  Object.assign(desc.style, {
    flex: '1 1 auto',
    minWidth: '0',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: '12.5px',
    color: 'var(--mdb-text-secondary)',
  });
  row.appendChild(desc);

  const chord = entry.keyBinding ? formatKeyChord(entry.keyBinding) : '';
  if (chord) {
    const kb = document.createElement('kbd');
    kb.className = 'mdb-palette-kbd';
    kb.textContent = chord;
    Object.assign(kb.style, {
      flex: 'none',
      fontFamily: 'var(--mdb-font-mono, ui-monospace, monospace)',
      fontSize: '11px',
      padding: '2px 7px',
      border: `1px solid var(--mdb-border)`,
      borderRadius: '6px',
      color: 'var(--mdb-text-secondary)',
      background: 'var(--mdb-code-bg)',
    });
    row.appendChild(kb);
  }

  // Appended last so `children[1]` stays the label regardless of selection;
  // absolute positioning keeps the visual bar at the row's leading edge.
  if (selected) {
    const accent = document.createElement('span');
    accent.className = 'mdb-palette-accent';
    accent.setAttribute('data-testid', 'command-palette-accent');
    Object.assign(accent.style, {
      position: 'absolute',
      left: '0',
      top: '4px',
      bottom: '4px',
      width: '2px',
      borderRadius: '2px',
      background: 'var(--mdb-primary)',
    });
    row.appendChild(accent);
  }

  row.addEventListener('mousedown', (e) => {
    e.preventDefault();
    onActivate();
  });
  return row;
}

/** Category filter chips: 全部 plus the canonical palette groups. */
export const PALETTE_CATEGORIES: readonly string[] = [
  '全部',
  '格式',
  '块',
  '插入',
  '视图',
  '体检',
];

export function createPaletteChips(
  activeGroup: string | null,
  onSelect: (group: string | null) => void,
): HTMLDivElement {
  const bar = document.createElement('div');
  bar.className = 'mdb-palette-chips';
  bar.setAttribute('data-testid', 'command-palette-chips');
  Object.assign(bar.style, {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    padding: '10px 12px 4px',
    flex: 'none',
  });
  for (const label of PALETTE_CATEGORIES) {
    const value = label === '全部' ? null : label;
    const active = activeGroup === value;
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = active
      ? 'mdb-palette-chip mdb-palette-chip--active'
      : 'mdb-palette-chip';
    chip.setAttribute('data-testid', 'command-palette-chip');
    chip.setAttribute('data-group', label);
    chip.setAttribute('aria-pressed', active ? 'true' : 'false');
    chip.textContent = label;
    Object.assign(chip.style, {
      fontSize: '12px',
      padding: '3px 11px',
      borderRadius: '999px',
      cursor: 'pointer',
      color: active ? 'var(--mdb-text)' : 'var(--mdb-text-secondary)',
      border: `1px solid ${active ? 'transparent' : 'var(--mdb-border)'}`,
      background: active ? 'rgba(123, 134, 234, 0.30)' : 'transparent',
    });
    chip.addEventListener('mousedown', (e) => e.preventDefault());
    chip.addEventListener('click', (e) => {
      e.preventDefault();
      onSelect(value);
    });
    bar.appendChild(chip);
  }
  return bar;
}

/** Bottom shortcut-hint bar: ↑↓ 选择 · ↵ 执行 · esc 关闭. */
export function createPaletteFooter(): HTMLDivElement {
  const footer = document.createElement('div');
  footer.className = 'mdb-palette-footer';
  footer.setAttribute('data-testid', 'command-palette-footer');
  Object.assign(footer.style, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '9px 14px',
    borderTop: `1px solid var(--mdb-border)`,
    color: 'var(--mdb-text-secondary)',
    fontSize: '12px',
    flex: 'none',
  });

  const keys = document.createElement('div');
  keys.className = 'mdb-palette-footer-keys';
  Object.assign(keys.style, { display: 'flex', gap: '14px' });
  const hints: ReadonlyArray<readonly [string, string]> = [
    ['↑↓', ' 选择'],
    ['↵', ' 执行'],
    ['esc', ' 关闭'],
  ];
  for (const [key, text] of hints) {
    const span = document.createElement('span');
    const kb = document.createElement('kbd');
    kb.textContent = key;
    Object.assign(kb.style, {
      fontFamily: 'var(--mdb-font-mono, ui-monospace, monospace)',
      fontSize: '11px',
      padding: '1px 6px',
      border: `1px solid var(--mdb-border)`,
      borderRadius: '5px',
      marginRight: '4px',
      background: 'var(--mdb-surface)',
      color: 'var(--mdb-text-secondary)',
    });
    span.appendChild(kb);
    span.appendChild(document.createTextNode(text));
    keys.appendChild(span);
  }
  footer.appendChild(keys);

  const brand = document.createElement('div');
  brand.textContent = 'md-bundle · 命令面板';
  footer.appendChild(brand);
  return footer;
}

/** Empty state: no-match message plus clickable suggestion chips. */
export function createPaletteEmptyState(
  onSuggestion: (text: string) => void,
): HTMLDivElement {
  const empty = document.createElement('div');
  empty.className = 'mdb-palette-empty';
  empty.setAttribute('data-testid', 'command-palette-empty');
  Object.assign(empty.style, {
    textAlign: 'center',
    padding: '34px 16px',
    color: 'var(--mdb-text-secondary)',
  });

  const title = document.createElement('div');
  title.className = 'mdb-palette-empty-title';
  title.textContent = '未找到匹配命令';
  Object.assign(title.style, {
    fontSize: '15px',
    color: 'var(--mdb-text)',
    marginBottom: '4px',
  });
  empty.appendChild(title);

  const hint = document.createElement('div');
  hint.textContent = '换个关键词，或试试拼音首字母';
  empty.appendChild(hint);

  const suggestions = document.createElement('div');
  suggestions.className = 'mdb-palette-suggestions';
  Object.assign(suggestions.style, {
    marginTop: '14px',
    display: 'flex',
    gap: '8px',
    justifyContent: 'center',
    flexWrap: 'wrap',
  });
  for (const text of ['表格', 'jc', '标题']) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'mdb-palette-suggestion';
    chip.setAttribute('data-testid', 'command-palette-suggestion');
    chip.setAttribute('data-suggestion', text);
    chip.textContent = text;
    Object.assign(chip.style, {
      fontSize: '12px',
      color: 'var(--mdb-text-secondary)',
      border: `1px solid var(--mdb-border)`,
      background: 'transparent',
      borderRadius: '999px',
      padding: '3px 11px',
      cursor: 'pointer',
    });
    chip.addEventListener('mousedown', (e) => e.preventDefault());
    chip.addEventListener('click', (e) => {
      e.preventDefault();
      onSuggestion(text);
    });
    suggestions.appendChild(chip);
  }
  empty.appendChild(suggestions);
  return empty;
}
