// 邀请链接随机昵称生成器（任务 26）。
// 昵称在分享动作发生时生成并写入 URL（邀请人署名）；服务端零存储。
// 词库 × 形容词组合 → 趣味昵称（「文字打包师」「拼图手」「深夜排版员」「格式狂人」）。
// RNG 注入缝：测试注入确定性序列，生产用 Math.random。

/** RNG 函数类型：返回 [0, 1) 浮点数。 */
export type Rng = () => number;

/** 昵称词库：职业/身份词。 */
export const BASE_NOUNS = [
  '文字打包师',
  '拼图手',
  '深夜排版员',
  '格式狂人',
  '图文收集家',
  '片段缝合师',
  '像素诗人',
  '文档裁缝',
  '代码说书人',
  '表格园艺师',
  '引用猎人',
  '列表建筑师',
] as const;

/** 形容词前缀词库。 */
export const ADJECTIVES = [
  '快乐',
  '神秘',
  '慵懒',
  '执着',
  '温柔',
  '暴躁',
  '认真',
  '随性',
  '低调',
  '狂热',
  '清醒',
  '迷糊',
] as const;

/** 图案装饰名（CSS/SVG 徽章用，与昵称随机同步）。 */
export const BADGE_PATTERNS = ['star', 'ripple', 'gradient', 'dots', 'wave'] as const;
export type BadgePattern = (typeof BADGE_PATTERNS)[number];

/**
 * 生成随机昵称：`<形容词><名词>` 组合（如「快乐文字打包师」）。
 * @param rng 可选 RNG 注入（测试用确定性序列；默认 Math.random）。
 * @returns 昵称字符串。
 */
export function randomNickname(rng: Rng = Math.random): string {
  const adj = ADJECTIVES[Math.floor(rng() * ADJECTIVES.length)];
  const noun = BASE_NOUNS[Math.floor(rng() * BASE_NOUNS.length)];
  return `${adj}${noun}`;
}

/**
 * 随机选一个徽章图案名（与昵称同 RNG 调用顺序可复现）。
 * @param rng 可选 RNG 注入。
 * @returns 图案名。
 */
export function randomBadgePattern(rng: Rng = Math.random): BadgePattern {
  return BADGE_PATTERNS[Math.floor(rng() * BADGE_PATTERNS.length)];
}

/** 网站域名（CTA 下方展示）。 */
export const INVITE_SITE_URL = 'bundle.jianxi.me';

/** 邀请卖点文案。 */
export const INVITE_VALUE_POINTS = [
  { icon: '🔒', label: '纯本地零上传', desc: '文件不离开浏览器' },
  { icon: '📦', label: '一键单文件', desc: '.mdpkg 图文打包' },
  { icon: '📋', label: '复制即分享', desc: '一个文件带走全部' },
] as const;
