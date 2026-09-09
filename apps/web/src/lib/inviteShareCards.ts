// 邀请分享卡模板（任务 27）—— 4 种结构不同的卡片构图。
// 与 docShareCard.ts（文档复制卡）独立：本模块分享对象 = 网站邀请。
// 每张卡含网站 URL + Jianxi 品牌；不消费文档内容；纯静态 HTML。
// 卡片 HTML 通过 shareCardSvg 的 foreignObject 管线栅格化为 PNG。
import { getThemeColor, type ThemeName } from '@md-bundle/editor';
import { BYLINE_BASE_URL, BYLINE_TEXT } from './byline';
import { INVITE_SITE_URL, type Rng } from './nicknames';

/** 卡片默认尺寸（px）—— 横版 600×316（OG 比例近似），竖版 360×640。 */
export const INVITE_CARD_WIDTH = 600;
export const INVITE_CARD_HEIGHT = 316;
export const INVITE_CARD_PORTRAIT_WIDTH = 360;
export const INVITE_CARD_PORTRAIT_HEIGHT = 640;

/** 模板类型标识。 */
export type InviteTemplateType = 'product' | 'quote' | 'promo' | 'minimal';

/** 单张卡片的完整描述。 */
export interface InviteCardTemplate {
  type: InviteTemplateType;
  /** 卡片名称（人类可读）。 */
  label: string;
  /** 卡片 HTML（内联样式，无外部依赖）。 */
  html: string;
  /** 卡片宽度。 */
  width: number;
  /** 卡片高度。 */
  height: number;
  /** 使用的主题色方案。 */
  scheme: string;
}

/** 卡片构建选项。 */
export interface BuildInviteCardOptions {
  /** 邀请人昵称。 */
  nickname: string;
  /** 主题（默认 'dark'）。 */
  theme?: ThemeName;
  /** 色方案名（每模板多方案时选择）。 */
  scheme?: string;
}

/** 色方案注册表：每模板 ≥2 个方案（theme token 家族）。 */
const SCHEMES: Record<string, Record<string, (t: ThemeName) => Record<string, string>>> = {
  // 横版作品卡：暗色 / 暖色
  product: {
    midnight: (t) => ({
      bg: getThemeColor(t, 'bg'),
      accent: getThemeColor(t, 'primary'),
      text: getThemeColor(t, 'text'),
      sub: getThemeColor(t, 'text-secondary'),
      cardBg: getThemeColor(t, 'card-bg'),
      border: getThemeColor(t, 'border'),
    }),
    warm: (t) => ({
      bg: '#1a1410',
      accent: '#f59e0b',
      text: getThemeColor(t, 'text'),
      sub: getThemeColor(t, 'text-secondary'),
      cardBg: '#251d15',
      border: '#4a3828',
    }),
  },
  // 竖版金句卡：深蓝 / 墨绿
  quote: {
    ocean: (_t) => ({
      bg: '#0a1628',
      accent: '#3b82f6',
      text: '#ffffff',
      sub: '#94a3b8',
      cardBg: '#0f1f3d',
      border: '#1e3a5f',
    }),
    forest: (_t) => ({
      bg: '#0a1f1a',
      accent: '#22c55e',
      text: '#ffffff',
      sub: '#86efac',
      cardBg: '#0f2d22',
      border: '#164332',
    }),
  },
  // 网站宣传卡：品牌紫 / 浅底
  promo: {
    brand: (t) => ({
      bg: getThemeColor(t, 'bg'),
      accent: getThemeColor(t, 'primary'),
      text: getThemeColor(t, 'text'),
      sub: getThemeColor(t, 'text-secondary'),
      cardBg: getThemeColor(t, 'card-bg'),
      border: getThemeColor(t, 'border'),
    }),
    light: (_t) => ({
      bg: '#f8fafc',
      accent: '#165DFF',
      text: '#1e293b',
      sub: '#64748b',
      cardBg: '#ffffff',
      border: '#e2e8f0',
    }),
  },
  // 极简名片卡：纯白 / 纯黑
  minimal: {
    paper: (_t) => ({
      bg: '#ffffff',
      accent: '#165DFF',
      text: '#111827',
      sub: '#6b7280',
      cardBg: '#f9fafb',
      border: '#e5e7eb',
    }),
    ink: (_t) => ({
      bg: '#000000',
      accent: '#ffffff',
      text: '#ffffff',
      sub: '#9ca3af',
      cardBg: '#111111',
      border: '#333333',
    }),
  },
};

/** XML 安全转义（卡片 HTML 嵌入 foreignObject 按 XML 解析）。 */
function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 通用字体族。 */
const FONT =
  "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;";

/**
 * 模板 1：横版作品卡 —— 产品缩略图 + 邀请文字 "@nickname 邀请你来 MD-Bundle"。
 * 布局：左半模拟编辑器缩略图，右半邀请文案 + URL + 品牌。
 */
function buildProductCard(opts: BuildInviteCardOptions): InviteCardTemplate {
  const scheme = opts.scheme ?? 'midnight';
  const colors = SCHEMES.product[scheme](opts.theme ?? 'dark');
  const { nickname } = opts;

  const html =
    `<div style="position:relative;width:${INVITE_CARD_WIDTH}px;height:${INVITE_CARD_HEIGHT}px;` +
    `box-sizing:border-box;background:${colors.bg};border:1px solid ${colors.border};` +
    `border-radius:16px;display:flex;overflow:hidden;${FONT}">` +
    // 左半：产品缩略图（模拟编辑器界面）
    `<div style="width:280px;height:100%;background:${colors.cardBg};border-right:1px solid ${colors.border};` +
    `display:flex;flex-direction:column;padding:20px;box-sizing:border-box;">` +
    // 伪工具栏
    `<div style="display:flex;align-items:center;gap:6px;margin-bottom:14px;">` +
    `<span style="width:10px;height:10px;border-radius:50%;background:#ff5f57;"></span>` +
    `<span style="width:10px;height:10px;border-radius:50%;background:#febc2e;"></span>` +
    `<span style="width:10px;height:10px;border-radius:50%;background:#28c840;"></span>` +
    `<span style="margin-left:8px;font-size:11px;color:${colors.sub};">MD-Bundle</span>` +
    `</div>` +
    // 模拟内容
    `<div style="font-size:18px;font-weight:700;color:${colors.text};line-height:1.3;"># 我的文档</div>` +
    `<div style="margin-top:8px;font-size:12px;color:${colors.sub};line-height:1.6;">` +
    `MD-Bundle 是一个 Markdown 自包含工具。</div>` +
    `<div style="margin-top:4px;font-size:12px;color:${colors.sub};line-height:1.6;">` +
    `支持 <span style="color:${colors.accent};">图片打包</span>、流程图。</div>` +
    `<div style="margin-top:12px;padding:8px;background:${colors.bg};border-radius:6px;border:1px solid ${colors.border};` +
    `font-size:11px;color:#d29922;">💡 拖拽图片即可导入</div>` +
    `</div>` +
    // 右半：邀请文案
    `<div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:28px 24px;box-sizing:border-box;">` +
    `<div style="font-size:13px;color:${colors.sub};margin-bottom:8px;">✨ 邀请</div>` +
    `<div style="font-size:24px;font-weight:800;color:${colors.text};line-height:1.3;">` +
    `<span style="color:${colors.accent};">@${esc(nickname)}</span></div>` +
    `<div style="font-size:16px;color:${colors.text};margin-top:4px;line-height:1.4;">邀你一起打包分享 Markdown</div>` +
    `<div style="margin-top:16px;font-size:13px;color:${colors.sub};line-height:1.5;">` +
    `一个文件，带走全部图文 · 不再裂图</div>` +
    // URL + 品牌
    `<div style="margin-top:auto;padding-top:16px;border-top:1px solid ${colors.border};` +
    `display:flex;align-items:center;justify-content:space-between;">` +
    `<span style="font-size:14px;font-weight:600;color:${colors.accent};">${INVITE_SITE_URL}</span>` +
    `<span style="font-size:11px;color:${colors.sub};">${BYLINE_TEXT}</span>` +
    `</div></div>` +
    // 品牌角标
    `<div style="position:absolute;right:16px;top:14px;padding:3px 8px;border-radius:999px;` +
    `background:${colors.accent}18;font-size:11px;color:${colors.accent};${FONT}">` +
    `<a href="${BYLINE_BASE_URL}/?ref=md-invite" style="color:${colors.accent};text-decoration:none;">jianxi</a>` +
    `</div>` +
    `</div>`;

  return {
    type: 'product',
    label: '横版作品卡',
    html,
    width: INVITE_CARD_WIDTH,
    height: INVITE_CARD_HEIGHT,
    scheme,
  };
}

/**
 * 模板 2：竖版金句卡 —— 大字号金句 + @nickname + 品牌。
 * 布局：居中竖排，金句为主视觉，底部 URL。
 */
function buildQuoteCard(opts: BuildInviteCardOptions): InviteCardTemplate {
  const scheme = opts.scheme ?? 'ocean';
  const colors = SCHEMES.quote[scheme](opts.theme ?? 'dark');
  const { nickname } = opts;

  const html =
    `<div style="position:relative;width:${INVITE_CARD_PORTRAIT_WIDTH}px;height:${INVITE_CARD_PORTRAIT_HEIGHT}px;` +
    `box-sizing:border-box;background:${colors.bg};border-radius:20px;` +
    `display:flex;flex-direction:column;align-items:center;justify-content:center;` +
    `padding:48px 36px;${FONT}">` +
    // 装饰引号
    `<div style="position:absolute;top:32px;left:28px;font-size:80px;line-height:1;` +
    `color:${colors.accent};opacity:0.25;font-family:Georgia,serif;">"</div>` +
    // 金句
    `<div style="font-size:32px;font-weight:800;color:${colors.text};text-align:center;` +
    `line-height:1.4;position:relative;z-index:1;">Share Markdown,<br/>no more<br/>broken images.</div>` +
    // 分割线
    `<div style="width:48px;height:3px;background:${colors.accent};border-radius:2px;margin:28px 0;"></div>` +
    // 昵称
    `<div style="font-size:18px;color:${colors.accent};font-weight:600;">@${esc(nickname)}</div>` +
    `<div style="font-size:13px;color:${colors.sub};margin-top:6px;">邀请你来 MD-Bundle</div>` +
    // 底部 URL + 品牌
    `<div style="position:absolute;bottom:36px;left:0;right:0;text-align:center;">` +
    `<div style="font-size:15px;font-weight:600;color:${colors.accent};margin-bottom:4px;">${INVITE_SITE_URL}</div>` +
    `<div style="font-size:11px;color:${colors.sub};">${BYLINE_TEXT}</div>` +
    `</div>` +
    // 品牌角标
    `<div style="position:absolute;top:20px;right:20px;padding:3px 8px;border-radius:999px;` +
    `background:${colors.accent}18;font-size:11px;color:${colors.accent};${FONT}">` +
    `<a href="${BYLINE_BASE_URL}/?ref=md-invite" style="color:${colors.accent};text-decoration:none;">jianxi</a>` +
    `</div>` +
    `</div>`;

  return {
    type: 'quote',
    label: '竖版金句卡',
    html,
    width: INVITE_CARD_PORTRAIT_WIDTH,
    height: INVITE_CARD_PORTRAIT_HEIGHT,
    scheme,
  };
}

/**
 * 模板 3：网站宣传卡 —— Logo + Slogan + 界面截图 + 邀请 URL。
 * 布局：顶部品牌栏 + 中部 slogan + 产品截图 + 底部 URL CTA。
 */
function buildPromoCard(opts: BuildInviteCardOptions): InviteCardTemplate {
  const scheme = opts.scheme ?? 'brand';
  const colors = SCHEMES.promo[scheme](opts.theme ?? 'dark');
  const { nickname } = opts;

  const html =
    `<div style="position:relative;width:${INVITE_CARD_WIDTH}px;height:${INVITE_CARD_HEIGHT}px;` +
    `box-sizing:border-box;background:${colors.bg};border:1px solid ${colors.border};` +
    `border-radius:16px;display:flex;flex-direction:column;overflow:hidden;${FONT}">` +
    // 顶部品牌栏
    `<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 24px;` +
    `border-bottom:1px solid ${colors.border};">` +
    `<div style="display:flex;align-items:center;gap:10px;">` +
    // Logo（CSS 方块）
    `<div style="width:28px;height:28px;border-radius:8px;background:${colors.accent};` +
    `display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:900;color:#fff;">M</div>` +
    `<span style="font-size:15px;font-weight:700;color:${colors.text};">MD-Bundle</span>` +
    `</div>` +
    `<div style="font-size:12px;color:${colors.sub};">@${esc(nickname)} 邀请</div>` +
    `</div>` +
    // 中部：slogan + 产品截图
    `<div style="flex:1;display:flex;align-items:center;gap:24px;padding:20px 24px;">` +
    // 左侧 slogan
    `<div style="flex:1;display:flex;flex-direction:column;justify-content:center;">` +
    `<div style="font-size:22px;font-weight:800;color:${colors.text};line-height:1.3;">` +
    `分享 Markdown<br/>不再裂图</div>` +
    `<div style="margin-top:10px;font-size:13px;color:${colors.sub};line-height:1.5;">` +
    `一个文件，带走全部图文。<br/>纯本地运行，零上传。</div>` +
    `</div>` +
    // 右侧：产品截图（模拟编辑器）
    `<div style="width:240px;height:140px;background:${colors.cardBg};border:1px solid ${colors.border};` +
    `border-radius:10px;overflow:hidden;flex-shrink:0;">` +
    `<div style="display:flex;align-items:center;gap:4px;padding:8px 10px;border-bottom:1px solid ${colors.border};` +
    `background:${colors.bg};">` +
    `<span style="width:7px;height:7px;border-radius:50%;background:#ff5f57;"></span>` +
    `<span style="width:7px;height:7px;border-radius:50%;background:#febc2e;"></span>` +
    `<span style="width:7px;height:7px;border-radius:50%;background:#28c840;"></span>` +
    `</div>` +
    `<div style="padding:10px 12px;font-size:11px;line-height:1.7;color:${colors.sub};` +
    `font-family:ui-monospace,'SF Mono',Menlo,monospace;">` +
    `<span style="color:${colors.text};font-weight:700;"># Hello</span><br/>` +
    `打包 <span style="color:${colors.accent};">.mdpkg</span> 文件<br/>` +
    `分享给朋友 ✨` +
    `</div></div>` +
    `</div>` +
    // 底部 URL CTA
    `<div style="padding:14px 24px;border-top:1px solid ${colors.border};` +
    `display:flex;align-items:center;justify-content:space-between;">` +
    `<span style="font-size:15px;font-weight:600;color:${colors.accent};">${INVITE_SITE_URL}</span>` +
    `<div style="display:flex;align-items:center;gap:8px;">` +
    `<span style="font-size:11px;color:${colors.sub};">${BYLINE_TEXT}</span>` +
    `<a href="${BYLINE_BASE_URL}/?ref=md-invite" style="padding:4px 10px;border-radius:6px;` +
    `background:${colors.accent};color:#fff;font-size:12px;text-decoration:none;">立即打开</a>` +
    `</div></div>` +
    `</div>`;

  return {
    type: 'promo',
    label: '网站宣传卡',
    html,
    width: INVITE_CARD_WIDTH,
    height: INVITE_CARD_HEIGHT,
    scheme,
  };
}

/**
 * 模板 4：极简名片卡 —— @nickname · MD-Bundle · 一行描述。
 * 布局：极简居中，大量留白，文字即设计。
 */
function buildMinimalCard(opts: BuildInviteCardOptions): InviteCardTemplate {
  const scheme = opts.scheme ?? 'paper';
  const colors = SCHEMES.minimal[scheme](opts.theme ?? 'dark');
  const { nickname } = opts;

  const html =
    `<div style="position:relative;width:${INVITE_CARD_PORTRAIT_WIDTH}px;height:${INVITE_CARD_PORTRAIT_HEIGHT}px;` +
    `box-sizing:border-box;background:${colors.bg};border-radius:20px;` +
    `display:flex;flex-direction:column;align-items:center;justify-content:center;` +
    `padding:48px 40px;${FONT}">` +
    // 顶部细线装饰
    `<div style="position:absolute;top:48px;left:50%;transform:translateX(-50%);` +
    `width:32px;height:2px;background:${colors.accent};border-radius:1px;"></div>` +
    // 昵称（视觉主角）
    `<div style="font-size:36px;font-weight:900;color:${colors.accent};letter-spacing:-0.02em;` +
    `margin-top:20px;">@${esc(nickname)}</div>` +
    // 分隔
    `<div style="display:flex;align-items:center;gap:12px;margin:20px 0;">` +
    `<div style="width:24px;height:1px;background:${colors.border};"></div>` +
    `<span style="font-size:13px;color:${colors.sub};letter-spacing:0.1em;">MD-BUNDLE</span>` +
    `<div style="width:24px;height:1px;background:${colors.border};"></div>` +
    `</div>` +
    // 一行描述
    `<div style="font-size:15px;color:${colors.text};text-align:center;line-height:1.6;max-width:220px;">` +
    `一个文件，带走全部图文。</div>` +
    // 底部 URL + 品牌
    `<div style="position:absolute;bottom:44px;left:0;right:0;text-align:center;">` +
    `<div style="font-size:14px;font-weight:500;color:${colors.accent};letter-spacing:0.02em;">${INVITE_SITE_URL}</div>` +
    `<div style="font-size:10px;color:${colors.sub};margin-top:6px;letter-spacing:0.08em;">` +
    `<a href="${BYLINE_BASE_URL}/?ref=md-invite" style="color:${colors.sub};text-decoration:none;">${BYLINE_TEXT}</a></div>` +
    `</div>` +
    `</div>`;

  return {
    type: 'minimal',
    label: '极简名片卡',
    html,
    width: INVITE_CARD_PORTRAIT_WIDTH,
    height: INVITE_CARD_PORTRAIT_HEIGHT,
    scheme,
  };
}

/** 所有模板构建器（固定顺序，供 pickTemplate 随机选择）。 */
const TEMPLATE_BUILDERS: ReadonlyArray<(opts: BuildInviteCardOptions) => InviteCardTemplate> = [
  buildProductCard,
  buildQuoteCard,
  buildPromoCard,
  buildMinimalCard,
];

/** 所有可用方案名（按模板类型索引）。 */
export const AVAILABLE_SCHEMES: Record<InviteTemplateType, readonly string[]> = {
  product: Object.keys(SCHEMES.product),
  quote: Object.keys(SCHEMES.quote),
  promo: Object.keys(SCHEMES.promo),
  minimal: Object.keys(SCHEMES.minimal),
};

/**
 * 构建指定类型的邀请分享卡。
 * @param type 模板类型。
 * @param opts 构建选项（昵称/主题/方案）。
 * @returns 完整卡片模板描述。
 */
export function buildInviteCard(
  type: InviteTemplateType,
  opts: BuildInviteCardOptions,
): InviteCardTemplate {
  switch (type) {
    case 'product':
      return buildProductCard(opts);
    case 'quote':
      return buildQuoteCard(opts);
    case 'promo':
      return buildPromoCard(opts);
    case 'minimal':
      return buildMinimalCard(opts);
  }
}

/**
 * 随机选择一张卡片模板（可注入 RNG 供测试）。
 * @param opts 构建选项（昵称/主题）。
 * @param rng 可选 RNG 注入（默认 Math.random）。
 * @returns 随机选中的卡片模板。
 */
export function pickTemplate(
  opts: BuildInviteCardOptions,
  rng: Rng = Math.random,
): InviteCardTemplate {
  const idx = Math.floor(rng() * TEMPLATE_BUILDERS.length);
  return TEMPLATE_BUILDERS[idx](opts);
}

/**
 * 所有 4 张模板（每种一张，默认方案）—— 供预览/批量生成。
 * @param opts 构建选项（昵称/主题）。
 * @returns 全部 4 张卡片模板。
 */
export function allTemplates(opts: BuildInviteCardOptions): InviteCardTemplate[] {
  return TEMPLATE_BUILDERS.map((build) => build(opts));
}

/** 网站 URL（卡片上展示的邀请目标）。 */
export { INVITE_SITE_URL };
