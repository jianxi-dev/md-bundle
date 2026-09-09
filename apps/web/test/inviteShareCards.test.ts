// 邀请分享卡模板单元测试（任务 27）。
// 验证：4 种模板结构差异、URL 可见、Jianxi 品牌、多色方案、RNG 注入可测。
import { describe, expect, it } from 'vitest';
import {
  buildInviteCard,
  pickTemplate,
  allTemplates,
  AVAILABLE_SCHEMES,
  INVITE_CARD_WIDTH,
  INVITE_CARD_HEIGHT,
  INVITE_CARD_PORTRAIT_WIDTH,
  INVITE_CARD_PORTRAIT_HEIGHT,
  type InviteTemplateType,
  type InviteCardTemplate,
} from '../src/lib/inviteShareCards';
import { BYLINE_BASE_URL, BYLINE_TEXT } from '../src/lib/byline';
import { INVITE_SITE_URL } from '../src/lib/nicknames';

const NICKNAME = '快乐文字打包师';

/** 断言：卡片包含网站 URL。 */
function expectUrl(card: InviteCardTemplate): void {
  expect(card.html).toContain(INVITE_SITE_URL);
}

/** 断言：卡片包含 Jianxi 品牌（链接或文字）。 */
function expectBrand(card: InviteCardTemplate): void {
  expect(card.html).toContain(BYLINE_BASE_URL);
  expect(card.html).toContain(BYLINE_TEXT);
}

/** 断言：卡片包含昵称。 */
function expectNickname(card: InviteCardTemplate, nickname: string): void {
  expect(card.html).toContain(nickname);
}

describe('buildInviteCard — 4 template types', () => {
  const types: InviteTemplateType[] = ['product', 'quote', 'promo', 'minimal'];

  it.each(types)('builds %s card with URL + brand + nickname', (type) => {
    const card = buildInviteCard(type, { nickname: NICKNAME });
    expectUrl(card);
    expectBrand(card);
    expectNickname(card, NICKNAME);
    expect(card.type).toBe(type);
    expect(card.html).toContain('position:relative');
  });

  it('product card is landscape (600×316) with editor preview on left', () => {
    const card = buildInviteCard('product', { nickname: NICKNAME });
    expect(card.width).toBe(INVITE_CARD_WIDTH);
    expect(card.height).toBe(INVITE_CARD_HEIGHT);
    // 横版布局：display:flex 横向排列
    expect(card.html).toContain('display:flex');
    // 含模拟编辑器界面
    expect(card.html).toContain('我的文档');
  });

  it('quote card is portrait (360×640) with big quote text', () => {
    const card = buildInviteCard('quote', { nickname: NICKNAME });
    expect(card.width).toBe(INVITE_CARD_PORTRAIT_WIDTH);
    expect(card.height).toBe(INVITE_CARD_PORTRAIT_HEIGHT);
    // 含金句
    expect(card.html).toContain('Share Markdown');
    expect(card.html).toContain('no more');
  });

  it('promo card has logo + slogan + product screenshot', () => {
    const card = buildInviteCard('promo', { nickname: NICKNAME });
    expect(card.width).toBe(INVITE_CARD_WIDTH);
    expect(card.height).toBe(INVITE_CARD_HEIGHT);
    // Logo "M"
    expect(card.html).toContain('>M<');
    // Slogan
    expect(card.html).toContain('不再裂图');
    // CTA
    expect(card.html).toContain('立即打开');
  });

  it('minimal card is portrait with centered @nickname', () => {
    const card = buildInviteCard('minimal', { nickname: NICKNAME });
    expect(card.width).toBe(INVITE_CARD_PORTRAIT_WIDTH);
    expect(card.height).toBe(INVITE_CARD_PORTRAIT_HEIGHT);
    // 极简：大量留白，文字居中
    expect(card.html).toContain('text-align:center');
    // 分隔装饰
    expect(card.html).toContain('MD-BUNDLE');
  });
});

describe('color schemes per template', () => {
  it('product has ≥2 schemes (midnight + warm)', () => {
    expect(AVAILABLE_SCHEMES.product.length).toBeGreaterThanOrEqual(2);
    const midnight = buildInviteCard('product', { nickname: NICKNAME, scheme: 'midnight' });
    const warm = buildInviteCard('product', { nickname: NICKNAME, scheme: 'warm' });
    // 不同方案颜色不同
    expect(midnight.scheme).toBe('midnight');
    expect(warm.scheme).toBe('warm');
    // warm 方案含暖色
    expect(warm.html).toContain('#f59e0b');
  });

  it('quote has ≥2 schemes (ocean + forest)', () => {
    expect(AVAILABLE_SCHEMES.quote.length).toBeGreaterThanOrEqual(2);
    const ocean = buildInviteCard('quote', { nickname: NICKNAME, scheme: 'ocean' });
    const forest = buildInviteCard('quote', { nickname: NICKNAME, scheme: 'forest' });
    expect(ocean.scheme).toBe('ocean');
    expect(forest.scheme).toBe('forest');
    // ocean 蓝色 vs forest 绿色
    expect(ocean.html).toContain('#3b82f6');
    expect(forest.html).toContain('#22c55e');
  });

  it('promo has ≥2 schemes (brand + light)', () => {
    expect(AVAILABLE_SCHEMES.promo.length).toBeGreaterThanOrEqual(2);
    const brand = buildInviteCard('promo', { nickname: NICKNAME, scheme: 'brand' });
    const light = buildInviteCard('promo', { nickname: NICKNAME, scheme: 'light' });
    expect(brand.scheme).toBe('brand');
    expect(light.scheme).toBe('light');
    // light 方案含浅底
    expect(light.html).toContain('#f8fafc');
  });

  it('minimal has ≥2 schemes (paper + ink)', () => {
    expect(AVAILABLE_SCHEMES.minimal.length).toBeGreaterThanOrEqual(2);
    const paper = buildInviteCard('minimal', { nickname: NICKNAME, scheme: 'paper' });
    const ink = buildInviteCard('minimal', { nickname: NICKNAME, scheme: 'ink' });
    expect(paper.scheme).toBe('paper');
    expect(ink.scheme).toBe('ink');
    // paper 白底 vs ink 黑底
    expect(paper.html).toContain('#ffffff');
    expect(ink.html).toContain('#000000');
  });
});

describe('theme support', () => {
  it('product card uses theme tokens when scheme=midnight', () => {
    const dark = buildInviteCard('product', { nickname: NICKNAME, theme: 'dark', scheme: 'midnight' });
    const light = buildInviteCard('product', { nickname: NICKNAME, theme: 'light', scheme: 'midnight' });
    // 暗色 vs 亮色背景不同
    expect(dark.html).toContain('#08090b');
    expect(light.html).toContain('#ffffff');
  });
});

describe('XML safety', () => {
  it('escapes special chars in nickname', () => {
    const card = buildInviteCard('product', { nickname: 'a<b>&"c' });
    expect(card.html).toContain('a&lt;b&gt;&amp;&quot;c');
    expect(card.html).not.toContain('a<b>');
  });
});

describe('pickTemplate (random selection)', () => {
  it('returns a valid template with default RNG', () => {
    const card = pickTemplate({ nickname: NICKNAME });
    expect(['product', 'quote', 'promo', 'minimal']).toContain(card.type);
    expectUrl(card);
    expectBrand(card);
  });

  it('injected RNG selects deterministically (0 → product)', () => {
    const card = pickTemplate({ nickname: NICKNAME }, () => 0);
    expect(card.type).toBe('product');
  });

  it('injected RNG selects last template at 0.99', () => {
    const card = pickTemplate({ nickname: NICKNAME }, () => 0.99);
    expect(card.type).toBe('minimal');
  });

  it('injected RNG sequence covers all 4 types', () => {
    const seq = [0.0, 0.25, 0.5, 0.75];
    const types = seq.map((v) => pickTemplate({ nickname: NICKNAME }, () => v).type);
    expect(types).toEqual(['product', 'quote', 'promo', 'minimal']);
  });
});

describe('allTemplates', () => {
  it('returns all 4 templates with default schemes', () => {
    const cards = allTemplates({ nickname: NICKNAME });
    expect(cards).toHaveLength(4);
    const types = cards.map((c) => c.type);
    expect(types).toEqual(['product', 'quote', 'promo', 'minimal']);
    // 全部含 URL + 品牌
    cards.forEach((card) => {
      expectUrl(card);
      expectBrand(card);
    });
  });
});

describe('structural differentiation', () => {
  it('all 4 templates have distinct HTML (not just color swap)', () => {
    const cards = allTemplates({ nickname: NICKNAME });
    const htmls = cards.map((c) => c.html);
    // 两两不同
    for (let i = 0; i < htmls.length; i++) {
      for (let j = i + 1; j < htmls.length; j++) {
        expect(htmls[i]).not.toBe(htmls[j]);
      }
    }
  });

  it('product/promo are landscape, quote/minimal are portrait', () => {
    const cards = allTemplates({ nickname: NICKNAME });
    const landscape = cards.filter((c) => c.width > c.height);
    const portrait = cards.filter((c) => c.height >= c.width);
    expect(landscape.map((c) => c.type)).toEqual(['product', 'promo']);
    expect(portrait.map((c) => c.type)).toEqual(['quote', 'minimal']);
  });
});
