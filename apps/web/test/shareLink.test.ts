// 邀请链接单元测试（任务 26）。
// 验证：URL 构建（仅 ref+by 参数）、昵称注入可测、解析/坏参数回退、isInviteLink 判定。
import { describe, expect, it } from 'vitest';
import {
  buildInviteUrl,
  createInviteLink,
  parseInviteParams,
  isInviteLink,
  INVITE_REF,
  REF_KEY,
  BY_KEY,
} from '../src/lib/shareLink';
import { randomNickname, randomBadgePattern, BASE_NOUNS, ADJECTIVES } from '../src/lib/nicknames';

describe('buildInviteUrl', () => {
  it('仅含 ref+by 两参数，无文档 payload', () => {
    const url = buildInviteUrl('快乐文字打包师', 'https://bundle.jianxi.me/');
    const parsed = new URL(url);
    expect(parsed.searchParams.get(REF_KEY)).toBe(INVITE_REF);
    expect(parsed.searchParams.get(BY_KEY)).toBe('快乐文字打包师');
    // 仅两个参数
    expect([...parsed.searchParams.keys()]).toHaveLength(2);
  });

  it('清除已有 ref/by 参数（不重复叠加）', () => {
    const url = buildInviteUrl('拼图手', 'https://bundle.jianxi.me/?ref=invite&by=old&foo=bar');
    const parsed = new URL(url);
    expect(parsed.searchParams.get(REF_KEY)).toBe(INVITE_REF);
    expect(parsed.searchParams.get(BY_KEY)).toBe('拼图手');
    // foo 保留，ref/by 不叠加
    expect(parsed.searchParams.get('foo')).toBe('bar');
    expect([...parsed.searchParams.keys()]).toHaveLength(3); // foo + ref + by
  });

  it('昵称含特殊字符正确编码', () => {
    const url = buildInviteUrl('深夜排版员', 'https://bundle.jianxi.me/');
    expect(url).toContain('by=');
    expect(url).not.toContain(' '); // 无空格（URL 编码）
  });
});

describe('createInviteLink', () => {
  it('生成昵称 + URL（默认 RNG）', () => {
    const { url, nickname } = createInviteLink(undefined, 'https://bundle.jianxi.me/');
    expect(nickname).toBeTruthy();
    expect(url).toContain('ref=invite');
    expect(url).toContain(`by=${encodeURIComponent(nickname)}`);
  });

  it('注入 RNG 可复现（序列 RNG 两次不同结果）', () => {
    const seq1 = [0.1, 0.2];
    const seq2 = [0.9, 0.8];
    const result1 = createInviteLink(() => seq1.shift() ?? 0, 'https://bundle.jianxi.me/');
    const result2 = createInviteLink(() => seq2.shift() ?? 0, 'https://bundle.jianxi.me/');
    expect(result1.nickname).not.toBe(result2.nickname);
    // 昵称在词库内
    const validNicknames = ADJECTIVES.flatMap(a => BASE_NOUNS.map(n => `${a}${n}`));
    expect(validNicknames).toContain(result1.nickname);
    expect(validNicknames).toContain(result2.nickname);
  });
});

describe('parseInviteParams', () => {
  it('有效邀请参数 → { by }', () => {
    const result = parseInviteParams('?ref=invite&by=快乐文字打包师');
    expect(result).toEqual({ by: '快乐文字打包师' });
  });

  it('ref 非 invite → null', () => {
    expect(parseInviteParams('?ref=other&by=foo')).toBeNull();
  });

  it('缺失 ref → null', () => {
    expect(parseInviteParams('?by=foo')).toBeNull();
  });

  it('缺失 by → null', () => {
    expect(parseInviteParams('?ref=invite')).toBeNull();
  });

  it('by 为空字符串 → null', () => {
    expect(parseInviteParams('?ref=invite&by=')).toBeNull();
  });

  it('by 仅空白 → null', () => {
    expect(parseInviteParams('?ref=invite&by=   ')).toBeNull();
  });

  it('空 query string → null', () => {
    expect(parseInviteParams('')).toBeNull();
  });

  it('URL 编码的 by 参数正确解码', () => {
    const encoded = encodeURIComponent('深夜排版员');
    const result = parseInviteParams(`?ref=invite&by=${encoded}`);
    expect(result?.by).toBe('深夜排版员');
  });
});

describe('isInviteLink', () => {
  it('非邀请链接 → false（无 window 环境时 search 为空）', () => {
    // node 环境下 window 未定义 → search 为空 → false
    expect(isInviteLink()).toBe(false);
  });
});

describe('randomNickname', () => {
  it('生成昵称在词库组合内', () => {
    const validNicknames = ADJECTIVES.flatMap(a => BASE_NOUNS.map(n => `${a}${n}`));
    for (let i = 0; i < 20; i++) {
      expect(validNicknames).toContain(randomNickname());
    }
  });

  it('注入 RNG 返回确定昵称', () => {
    // 0.0 → 第一个形容词 + 第一个名词
    const nickname = randomNickname(() => 0.0);
    expect(nickname).toBe(`${ADJECTIVES[0]}${BASE_NOUNS[0]}`);
  });
});

describe('randomBadgePattern', () => {
  it('返回有效图案名', () => {
    const patterns = ['star', 'ripple', 'gradient', 'dots', 'wave'];
    for (let i = 0; i < 10; i++) {
      expect(patterns).toContain(randomBadgePattern());
    }
  });

  it('注入 RNG 返回确定图案', () => {
    expect(randomBadgePattern(() => 0.0)).toBe('star');
    expect(randomBadgePattern(() => 0.99)).toBe('wave');
  });
});
