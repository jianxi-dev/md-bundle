/**
 * #361 (change editor-fidelity-2 / 2.6) — deduped editor callout type set.
 *
 * Pins R-CALLOUT-01: exactly thirteen editor types with a unique label each,
 * rendered by the block-handle type flyout. Also pins the resolver fallback so
 * renderer-only parse aliases (hint/caution/summary/…) still decorate.
 */
import { describe, expect, it } from 'vitest';
import {
  CALLOUT_EDIT_TYPES,
  CALLOUT_EMOJI_CHOICES,
  resolveCalloutType,
} from '../src/callout-types';

const EXPECTED_LABELS = [
  '注释',
  '信息',
  '摘要',
  '待办',
  '提示',
  '成功',
  '问题',
  '警告',
  '失败',
  '危险',
  'Bug',
  '示例',
  '引用',
];

const EXPECTED_KEYS = [
  'note',
  'info',
  'abstract',
  'todo',
  'tip',
  'success',
  'question',
  'warning',
  'failure',
  'danger',
  'bug',
  'example',
  'quote',
];

describe('#361 CALLOUT_EDIT_TYPES', () => {
  it('has exactly thirteen entries', () => {
    expect(CALLOUT_EDIT_TYPES).toHaveLength(13);
  });

  it('labels the thirteen types in conformance order with no duplicate', () => {
    const labels = CALLOUT_EDIT_TYPES.map((t) => t.label);
    expect(labels).toEqual(EXPECTED_LABELS);
    expect(new Set(labels).size).toBe(13);
  });

  it('keys the thirteen types exactly (renderer-compatible tokens)', () => {
    expect(CALLOUT_EDIT_TYPES.map((t) => t.key)).toEqual(EXPECTED_KEYS);
  });

  it('gives every entry an emoji and a tone', () => {
    for (const entry of CALLOUT_EDIT_TYPES) {
      expect(entry.emoji.length).toBeGreaterThan(0);
      expect(entry.tone.length).toBeGreaterThan(0);
    }
  });

  it('surfaces 提示 exactly once (the U-02 duplicate is gone)', () => {
    expect(CALLOUT_EDIT_TYPES.filter((t) => t.label === '提示')).toHaveLength(1);
    expect(CALLOUT_EDIT_TYPES.filter((t) => t.label === '注意')).toHaveLength(0);
  });
});

describe('#361 resolveCalloutType', () => {
  it('resolves an editor type to its deduped label + emoji', () => {
    expect(resolveCalloutType('todo')).toEqual({ label: '待办', tone: 'blue', icon: '☑️' });
    expect(resolveCalloutType('bug')).toEqual({ label: 'Bug', tone: 'red', icon: '🐛' });
    expect(resolveCalloutType('question')).toEqual({ label: '问题', tone: 'teal', icon: '❓' });
  });

  it('falls back to the renderer map for a parse alias not in the editor set', () => {
    expect(resolveCalloutType('hint')).toEqual({ label: '提示', tone: 'green', icon: '💡' });
    expect(resolveCalloutType('caution')).toEqual({ label: '注意', tone: 'orange', icon: '⚠️' });
    expect(resolveCalloutType('summary')).toEqual({ label: '总结', tone: 'purple', icon: '📋' });
  });

  it('returns null for an unknown type', () => {
    expect(resolveCalloutType('foo')).toBeNull();
  });
});

describe('#361 CALLOUT_EMOJI_CHOICES', () => {
  it('offers a non-trivial curated grid without duplicates', () => {
    expect(CALLOUT_EMOJI_CHOICES.length).toBeGreaterThanOrEqual(12);
    const emojis = CALLOUT_EMOJI_CHOICES.map((c) => c.emoji);
    expect(new Set(emojis).size).toBe(emojis.length);
  });

  it('names every choice for the search box', () => {
    for (const choice of CALLOUT_EMOJI_CHOICES) {
      expect(choice.name.length).toBeGreaterThan(0);
    }
  });
});
