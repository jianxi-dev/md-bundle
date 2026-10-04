/* MD-Bundle slash filter — pure matching for the `/` insert menu.
 *
 * Split out of `slash.ts` so the ranking rules are testable without a CodeMirror
 * view. Nothing here touches the DOM or the editor; `slash.ts` owns rendering
 * and applying. Kept out of `index.ts` on purpose — the palette matcher is not
 * part of the public surface.
 */

/**
 * Table size query: `t` + one or two digits (e.g. `t53` → 5 cols × 3 rows).
 * Shared with `slashMenuApply` so the row that survives filtering is exactly the
 * row that gets inserted.
 */
export const TABLE_SIZE_QUERY = /^t([1-9])([1-9])?$/;

/** The subset of a command row this module needs; `SlashCommand` satisfies it. */
export interface FilterableCommand {
  id: string;
  label: string;
  /** Single-key code typed after `/`. */
  code?: string;
  /** Extra codes that resolve to this command. */
  aliases?: readonly string[];
  /** Second-level options; promoting one of these into the root list is allowed. */
  children?: readonly FilterableCommand[];
  /** When present, activating the row opens a rows×cols grid picker instead. */
  grid?: { rows: number; cols: number };
}

/**
 * Full pinyin for every CJK character a registry label can contain. A partial
 * table would silently drop matches (`fenge` needs 分/割/线), so it covers the
 * whole current vocabulary: root labels, `N 级标题` children and the eight
 * callout style labels. Non-CJK characters are matched as-is.
 */
const PINYIN: Record<string, string> = {
  标: 'biao',
  注: 'zhu',
  释: 'shi',
  题: 'ti',
  引: 'yin',
  用: 'yong',
  代: 'dai',
  码: 'ma',
  块: 'kuai',
  分: 'fen',
  栏: 'lan',
  割: 'ge',
  线: 'xian',
  表: 'biao',
  格: 'ge',
  图: 'tu',
  片: 'pian',
  任: 'ren',
  务: 'wu',
  插: 'cha',
  入: 'ru',
  级: 'ji',
  属: 'shu',
  信: 'xin',
  息: 'xi',
  示: 'shi',
  成: 'cheng',
  功: 'gong',
  警: 'jing',
  告: 'gao',
  危: 'wei',
  险: 'xian',
  错: 'cuo',
  误: 'wu',
  疑: 'yi',
  问: 'wen',
};

/** Match tiers, best first. Compared numerically, so order here is the ranking. */
const TIER_CODE = 0;
const TIER_CHILD_CODE = 1;
const TIER_NAME = 2;
const TIER_PREFIX = 3;
const TIER_SUBSEQUENCE = 4;
const TIER_NONE = 5;

/** Case-insensitive subsequence test: are all `query` chars in `text`, in order? */
function isSubsequence(query: string, text: string): boolean {
  const lowerQuery = query.toLowerCase();
  const lowerText = text.toLowerCase();
  let qi = 0;
  for (let ti = 0; ti < lowerText.length && qi < lowerQuery.length; ti++) {
    if (lowerText[ti] === lowerQuery[qi]) qi++;
  }
  return qi === lowerQuery.length;
}

/** Full pinyin for a label, lowercased; non-CJK characters pass through. */
function pinyinFull(label: string): string {
  return [...label].map((ch) => PINYIN[ch] ?? ch.toLowerCase()).join('');
}

/** First pinyin letter per character (`标题` → `bt`). */
function pinyinInitials(label: string): string {
  return [...label].map((ch) => PINYIN[ch]?.[0] ?? ch.toLowerCase()).join('');
}

/** Does this row's own code (or an alias) equal the query? */
function matchesCode(cmd: FilterableCommand, query: string): boolean {
  const q = query.toLowerCase();
  if (cmd.code !== undefined && cmd.code.toLowerCase() === q) return true;
  return (cmd.aliases ?? []).some((alias) => alias.toLowerCase() === q);
}

/**
 * How well `query` names this row: exact label/initials/full pinyin beats a
 * prefix beats a loose subsequence. Chinese input matches the label directly.
 */
function nameTier(label: string, query: string): number {
  const q = query.toLowerCase();
  const candidates = [label.toLowerCase(), pinyinFull(label), pinyinInitials(label)];
  if (candidates.some((text) => text === q)) return TIER_NAME;
  if (candidates.some((text) => text.startsWith(q))) return TIER_PREFIX;
  if (candidates.some((text) => isSubsequence(q, text))) return TIER_SUBSEQUENCE;
  return TIER_NONE;
}

/** Scored row plus the registry position it came from (ties keep registry order). */
interface ScoredRow {
  row: FilterableCommand;
  tier: number;
  seq: number;
}

/**
 * Root rows matching the typed filter, best match first. Exact codes outrank
 * names and name matches outrank loose ones — so `/t` lands on 表格 while
 * `/bt` still finds 标题.
 *
 * A typed code is an instruction rather than a hint: when any row answers to it
 * exactly, only those rows survive. Otherwise `/n` would also drag in every
 * label whose pinyin merely contains the letter (`引用` → `yinyong`), burying
 * the 标注 styles under four irrelevant rows.
 *
 * A hit on a parent's own code keeps the parent and lists its second-level
 * options underneath (spec: options are surfaced directly, no hover needed). A
 * hit on a *child* code replaces the parent with just that child, because the
 * user asked for that style rather than the parent row.
 */
export function filterSlashCommands<T extends FilterableCommand>(
  commands: readonly T[],
  query: string,
): T[] {
  if (!query) return [...commands];
  // `t53` is an insert instruction rather than a filter: only the grid-owning
  // row can act on it, so nothing else is worth showing.
  if (TABLE_SIZE_QUERY.test(query)) {
    return commands.filter((cmd) => cmd.grid !== undefined);
  }

  const exact: ScoredRow[] = [];
  commands.forEach((cmd, seq) => {
    const children = (cmd.children ?? []) as readonly T[];
    if (matchesCode(cmd, query)) {
      exact.push({ row: cmd, tier: TIER_CODE, seq });
      for (const child of children) exact.push({ row: child, tier: TIER_CODE, seq });
      return;
    }
    for (const child of children) {
      if (matchesCode(child, query)) exact.push({ row: child, tier: TIER_CHILD_CODE, seq });
    }
  });
  if (exact.length > 0) return exact.map((entry) => entry.row as T);

  const scored: ScoredRow[] = [];
  commands.forEach((cmd, seq) => {
    const tier = nameTier(cmd.label, query);
    if (tier === TIER_NONE) return;
    scored.push({ row: cmd, tier, seq });
  });

  return scored.sort((a, b) => a.tier - b.tier || a.seq - b.seq).map((entry) => entry.row as T);
}