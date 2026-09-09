// 网站邀请链接构建与解析（任务 26，决策 #45）。
// 分享对象 = 网站（不是文档）—— 链接只带 ref+by 两参数，无文档 payload。
// 昵称在分享动作发生时生成并写入 URL（邀请人署名）；服务端零存储。
import {
  randomNickname,
  randomBadgePattern,
  INVITE_SITE_URL,
  INVITE_VALUE_POINTS,
  type Rng,
} from './nicknames';

export { INVITE_SITE_URL, INVITE_VALUE_POINTS };

/** 邀请链接查询参数键。 */
export const REF_KEY = 'ref';
export const BY_KEY = 'by';
export const INVITE_REF = 'invite';

/** 邀请链接解析结果。 */
export interface InviteParams {
  /** 邀请人昵称（URL 解码后）。 */
  by: string;
  /** 徽章图案名（可选，用于视觉一致性）。 */
  pattern?: string;
}

/**
 * 构建邀请链接：在当前页面 URL 上追加 `?ref=invite&by=<昵称>`。
 * 仅含 ref+by 两参数，不携带文档 payload。
 * @param nickname 邀请人昵称（已生成）。
 * @param baseUrl 可选基础 URL（默认当前页面 location）。
 * @returns 完整邀请链接字符串。
 */
export function buildInviteUrl(nickname: string, baseUrl?: string): string {
  const base = baseUrl ?? (typeof window !== 'undefined' ? window.location.href : 'https://bundle.jianxi.me/');
  const url = new URL(base);
  // 清除已有 ref/by 参数（避免重复叠加）
  url.searchParams.delete(REF_KEY);
  url.searchParams.delete(BY_KEY);
  url.searchParams.set(REF_KEY, INVITE_REF);
  url.searchParams.set(BY_KEY, nickname);
  return url.toString();
}

/**
 * 生成完整邀请链接（昵称 + URL 一步完成）。
 * 在分享动作时调用：生成昵称 → 写入链接。
 * @param rng 可选 RNG 注入（测试用确定性序列；默认 Math.random）。
 * @param baseUrl 可选基础 URL。
 * @returns { url, nickname } 邀请链接 + 生成的昵称。
 */
export function createInviteLink(rng: Rng = Math.random, baseUrl?: string): {
  url: string;
  nickname: string;
  pattern: string;
} {
  const nickname = randomNickname(rng);
  const pattern = randomBadgePattern(rng);
  const url = buildInviteUrl(nickname, baseUrl);
  return { url, nickname, pattern };
}

/**
 * 解析当前页面 URL 的邀请参数。
 * 坏参数（缺失 ref / ref 非 invite / by 缺失或空）→ 返回 null（调用方回退普通落地页）。
 * @param search 可选 location.search（默认当前页面）。
 * @returns InviteParams | null。
 */
export function parseInviteParams(search?: string): InviteParams | null {
  const query =
    search ?? (typeof window !== 'undefined' ? window.location.search : '');
  const params = new URLSearchParams(query);

  if (params.get(REF_KEY) !== INVITE_REF) return null;

  const by = params.get(BY_KEY);
  if (!by || by.trim().length === 0) return null;

  return { by };
}

/**
 * 当前页面是否为邀请链接（ref=invite 且有有效 by 参数）。
 * 坏参数 → false（不报错，回退普通落地页）。
 */
export function isInviteLink(): boolean {
  return parseInviteParams() !== null;
}
