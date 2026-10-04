/**
 * Flatten text so it is safe inside a GFM pipe-table cell.
 *
 * A newline would start a new block and a raw `|` would add a column, either of
 * which silently corrupts the table structure on the next parse. Both are
 * flattened to spaces: losing a character beats corrupting the document.
 *
 * A dependency leaf so both the table widget (staging) and the anchored insert
 * menu (commands) can reuse it without importing each other.
 */
export function sanitizeCellText(text: string): string {
  return text.replace(/\r?\n/g, ' ').replace(/\|/g, ' ');
}
