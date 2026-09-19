/* Command palette DOM builders — element factories with no editor dependency.
 *
 * Split out of command-palette.ts to keep that module under the 250-pure-LOC
 * ceiling. Callers pass activation callbacks so this file never imports
 * EditorView. NOT part of the package public API.
 */

import { getThemeColor } from './theme';
import type { MatchEntry } from './command-palette-search';

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

/** Group header row shown above each command group. */
export function createGroupHeader(group: string): HTMLDivElement {
  const header = document.createElement('div');
  header.className = 'mdb-palette-group';
  header.textContent = group;
  Object.assign(header.style, {
    padding: '8px 12px 4px',
    fontSize: '11px',
    fontWeight: '600',
    color: getThemeColor('dark', 'text-secondary'),
  });
  return header;
}

/** A single command row: icon + label + optional key-binding chip. */
export function createPaletteRow(
  entry: MatchEntry,
  selected: boolean,
  onActivate: () => void,
): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'mdb-palette-item';
  row.setAttribute('data-testid', 'command-palette-item');
  Object.assign(row.style, {
    padding: '6px 12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  });
  if (selected) {
    row.setAttribute('data-selected', 'true');
    row.style.background = 'rgba(123, 134, 234, 0.18)';
  }

  const icon = document.createElement('span');
  icon.textContent = entry.icon ?? '';
  Object.assign(icon.style, {
    width: '18px',
    fontSize: '13px',
    color: getThemeColor('dark', 'primary'),
  });
  row.appendChild(icon);

  const label = document.createElement('span');
  label.textContent = entry.label;
  Object.assign(label.style, { flex: '1', fontSize: '13px' });
  row.appendChild(label);

  if (entry.keyBinding) {
    const kb = document.createElement('kbd');
    kb.textContent = entry.keyBinding;
    Object.assign(kb.style, {
      fontSize: '11px',
      padding: '1px 6px',
      border: `1px solid ${getThemeColor('dark', 'border')}`,
      borderRadius: '3px',
      color: getThemeColor('dark', 'text-secondary'),
    });
    row.appendChild(kb);
  }

  row.addEventListener('mousedown', (e) => {
    e.preventDefault();
    onActivate();
  });
  return row;
}
