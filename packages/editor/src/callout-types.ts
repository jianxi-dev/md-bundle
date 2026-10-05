/**
 * Editor-side callout type set (issue #361, change editor-fidelity-2 task 2.6).
 *
 * Why this exists separately from the renderer's `CALLOUT_TYPE_MAP`
 * -------------------------------------------------------------------
 * The renderer map is the RENDER source of truth: it keeps every parse alias
 * (`hint`/`caution`/`summary`/`check`/`error`/`help`/…) so any document written
 * before this change still renders. Several aliases intentionally share one
 * label (`tip`/`hint` both 「提示」, `caution`/`attention` both 「注意」), which is
 * correct for rendering but produces a DUPLICATE-looking editor flyout (U-02).
 *
 * `CALLOUT_EDIT_TYPES` is the EDITOR display set: thirteen types with a unique
 * label each, aligned to design.md D7 / conformance R-CALLOUT-01. The editor
 * flyout renders from this list, and the callout decoration resolves a block's
 * type through `resolveCalloutType` (this list first, then the renderer map for
 * aliases the editor does not surface). Nothing here mutates the renderer map,
 * so `slash.ts`'s eight callout children and preview rendering stay untouched.
 */
import { calloutTypeMap } from '@md-bundle/renderer';

/** One editor-facing callout type: unique label + header emoji + tone token. */
export interface CalloutEditType {
  /** Markdown `[!KEY]` token (lowercase, matches the renderer aliases). */
  readonly key: string;
  /** Unique display label — the flyout's dedup contract (R-CALLOUT-01). */
  readonly label: string;
  /** Header emoji shown in the callout card and the type flyout. */
  readonly emoji: string;
  /** Tone class suffix (`cm-callout-tone-${tone}`) defined in decorations/theme. */
  readonly tone: string;
  /** Optional per-type background override; reserved (tone token drives colour). */
  readonly bg?: string;
}

/**
 * The thirteen editor types, in the R-CALLOUT-01 label order:
 * 注释 信息 摘要 待办 提示 成功 问题 警告 失败 危险 Bug 示例 引用.
 *
 * Order matters: the type flyout renders top-to-bottom in this sequence and
 * the fidelity spec asserts the label array verbatim.
 */
export const CALLOUT_EDIT_TYPES: readonly CalloutEditType[] = [
  { key: 'note', label: '注释', emoji: '📝', tone: 'blue' },
  { key: 'info', label: '信息', emoji: 'ℹ️', tone: 'blue' },
  { key: 'abstract', label: '摘要', emoji: '📋', tone: 'purple' },
  { key: 'todo', label: '待办', emoji: '☑️', tone: 'blue' },
  { key: 'tip', label: '提示', emoji: '💡', tone: 'green' },
  { key: 'success', label: '成功', emoji: '✅', tone: 'green' },
  { key: 'question', label: '问题', emoji: '❓', tone: 'teal' },
  { key: 'warning', label: '警告', emoji: '⚠️', tone: 'orange' },
  { key: 'failure', label: '失败', emoji: '✖️', tone: 'red' },
  { key: 'danger', label: '危险', emoji: '🚨', tone: 'red' },
  { key: 'bug', label: 'Bug', emoji: '🐛', tone: 'red' },
  { key: 'example', label: '示例', emoji: '📝', tone: 'gray' },
  { key: 'quote', label: '引用', emoji: '💬', tone: 'muted' },
];

/** Resolved display info for a callout type, whichever set supplies it. */
export interface ResolvedCalloutType {
  readonly label: string;
  readonly tone: string;
  /** Header emoji (renderer map calls this `icon`). */
  readonly icon: string;
}

/**
 * Resolve a callout type key to its display info. The deduped editor set wins
 * (so `bug` reads 「Bug」 and `question` reads 「问题」 in the editor); unknown
 * editor keys fall back to the renderer map so every parse alias still renders.
 * Returns null when neither set knows the type (an invalid `[!FOO]` stays a
 * plain blockquote).
 */
export function resolveCalloutType(type: string): ResolvedCalloutType | null {
  const edit = CALLOUT_EDIT_TYPES.find((entry) => entry.key === type);
  if (edit) return { label: edit.label, tone: edit.tone, icon: edit.emoji };
  const renderer = calloutTypeMap[type];
  if (renderer) return { label: renderer.label, tone: renderer.tone, icon: renderer.icon };
  return null;
}

/** One curated emoji choice in the picker; `name` doubles as a search key. */
export interface CalloutEmojiChoice {
  readonly emoji: string;
  readonly name: string;
}

/**
 * Curated emoji grid for the header picker — deliberately small and shipped
 * in-tree: the product bans new dependencies, so emoji-mart cannot be added
 * (R-CALLOUT-02's "emoji-mart" wording is an implementation note, not a
 * dependency contract). `name` mixes Chinese and English keywords so the
 * optional search box filters by either.
 */
export const CALLOUT_EMOJI_CHOICES: readonly CalloutEmojiChoice[] = [
  { emoji: '📝', name: '备注 笔记 记录 memo note' },
  { emoji: 'ℹ️', name: '信息 info' },
  { emoji: '💡', name: '提示 灯泡 想法 idea tip' },
  { emoji: '✅', name: '成功 完成 对勾 done success' },
  { emoji: '❓', name: '问题 疑问 question' },
  { emoji: '⚠️', name: '警告 注意 warning' },
  { emoji: '🚨', name: '危险 警报 danger' },
  { emoji: '✖️', name: '失败 错误 叉 failure' },
  { emoji: '🐛', name: '虫子 缺陷 bug' },
  { emoji: '📋', name: '摘要 剪贴板 abstract' },
  { emoji: '⭐', name: '星标 重要 star' },
  { emoji: '🎉', name: '庆祝 派对 默认 party' },
  { emoji: '🔥', name: '火焰 热门 fire' },
  { emoji: '👍', name: '赞 好的 thumbs up' },
  { emoji: '🙌', name: '举手 欢呼' },
  { emoji: '🚀', name: '火箭 发布 rocket' },
  { emoji: '📌', name: '图钉 钉住 pin' },
  { emoji: '🎯', name: '目标 靶心 target' },
  { emoji: '💬', name: '对话 引用 quote' },
  { emoji: '📖', name: '书 引述 cite' },
  { emoji: '📎', name: '回形针 附件' },
  { emoji: '🧠', name: '大脑 想法 思考 brain' },
  { emoji: '🌟', name: '闪星 发光 star' },
  { emoji: '😄', name: '笑脸 开心 smile' },
];
