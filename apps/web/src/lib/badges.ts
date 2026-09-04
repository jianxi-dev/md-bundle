// 徽章状态机（Task 6.3）—— 纯逻辑 + 存储注入，App 接线在 6.4。
// 触发于「完成瞬间」：recordEvent 返回的 unlocked 非空 = 此刻刚解锁/升级，
// 调用方据此弹 toast；空结果 = 无新徽章（重复事件去重，绝不重复弹）。
// 持久化：每次变更写回注入的 storage（key: md-bundle.badges）；
// 损坏数据（非 JSON / 形状错误 / 版本不符）静默回退默认值，绝不 throw。
//
// 6.4 接线映射（来自 4.1 的成功信号）：
//   saveDocument 返回 'mdpkg'        → recordEvent('pack-saved')
//   handleExport 成功（resolve true） → recordEvent('export-succeeded')
//   PNG 导出成功                      → recordEvent('png-exported')
//   打开文件成功                      → recordEvent('file-opened')

/** 稀有度阶梯（升序）。 */
export const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary'] as const;
export type Rarity = (typeof RARITY_ORDER)[number];

/** 徽章 id。 */
export type BadgeId = 'first-open' | 'first-pack' | 'first-png' | 'export-master';

/** 触发事件。 */
export type BadgeEvent = 'file-opened' | 'pack-saved' | 'png-exported' | 'export-succeeded';

/** 导出阶梯：exportCount 达到 at 时 export-master 升到对应稀有度。 */
export const EXPORT_TIERS = [
  { at: 3, rarity: 'rare' },
  { at: 10, rarity: 'epic' },
  { at: 25, rarity: 'legendary' },
] as const;

/** 存储 key 与状态版本。 */
export const STORAGE_KEY = 'md-bundle.badges';
export const STATE_VERSION = 1;

/** 持久化状态（versioned）。 */
export interface BadgeState {
  version: 1;
  unlocked: BadgeId[];
  tiers: Partial<Record<BadgeId, Rarity>>;
  exportCount: number;
}

/** 单次解锁/升级条目。firstTime=true 表示首次解锁（非升级）。 */
export interface BadgeUnlock {
  id: BadgeId;
  rarity: Rarity;
  firstTime: boolean;
}

/** recordEvent 的结果 —— unlocked 非空 = 此刻有徽章解锁/升级（调用方弹 toast）。 */
export interface BadgeEventResult {
  unlocked: BadgeUnlock[];
  upgraded: { id: BadgeId; from: Rarity; to: Rarity } | null;
}

/** 存储注入缝（测试用内存 fake；浏览器传 localStorage）。 */
export type BadgeStorage = Pick<Storage, 'getItem' | 'setItem'>;

export interface BadgeStore {
  /** 当前状态（浅拷贝，外部修改不影响内部）。 */
  getState(): BadgeState;
  /** 记录一次事件；纯确定性：同状态 + 同事件 → 同结果。 */
  recordEvent(e: BadgeEvent, _opts?: unknown): BadgeEventResult;
}

const BADGE_IDS: readonly BadgeId[] = ['first-open', 'first-pack', 'first-png', 'export-master'];

function fresh(): BadgeState {
  return { version: 1, unlocked: [], tiers: {}, exportCount: 0 };
}

/** 形状校验：非对象 / 版本不符 / 字段类型错误 → 视为损坏。 */
function isValidShape(v: unknown): v is BadgeState {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  const s = v as Record<string, unknown>;
  return (
    s.version === STATE_VERSION &&
    Array.isArray(s.unlocked) &&
    typeof s.tiers === 'object' &&
    s.tiers !== null &&
    !Array.isArray(s.tiers) &&
    typeof s.exportCount === 'number'
  );
}

/** 形状合法但内容可疑时做轻量清洗（未知 id/稀有度丢弃、计数取整非负）。 */
function sanitize(v: BadgeState): BadgeState {
  const unlocked = [...new Set(v.unlocked.filter((id): id is BadgeId => (BADGE_IDS as readonly string[]).includes(id)))];
  const tiers: Partial<Record<BadgeId, Rarity>> = {};
  for (const id of BADGE_IDS) {
    const r = v.tiers[id];
    if (r !== undefined && (RARITY_ORDER as readonly string[]).includes(r)) tiers[id] = r;
  }
  return {
    version: 1,
    unlocked,
    tiers,
    exportCount: Math.max(0, Math.floor(v.exportCount)),
  };
}

/** 从存储加载；任何异常（getItem throw / 非 JSON / 形状错 / 版本不符）→ 默认值。 */
function load(storage: BadgeStorage): BadgeState {
  let raw: string | null = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return fresh();
  }
  if (raw === null) return fresh();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fresh();
  }
  if (!isValidShape(parsed)) return fresh();
  return sanitize(parsed);
}

/** 写回存储；setItem 异常静默忽略（内存态仍可用，安全降级）。 */
function persist(storage: BadgeStorage, state: BadgeState): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 存储不可用（隐私模式/配额）→ 本次不持久化，不抛错。
  }
}

/** 首次解锁：未解锁才解锁并写入结果。 */
function maybeUnlock(
  result: BadgeEventResult,
  state: BadgeState,
  id: BadgeId,
  rarity: Rarity,
): void {
  if (state.unlocked.includes(id)) return;
  state.unlocked.push(id);
  state.tiers[id] = rarity;
  result.unlocked.push({ id, rarity, firstTime: true });
}

/** 导出阶梯：exportCount 达标且稀有度更高 → 解锁或升级 export-master。 */
function applyLadder(result: BadgeEventResult, state: BadgeState): void {
  const current = state.tiers['export-master'];
  const currentIdx = current === undefined ? -1 : RARITY_ORDER.indexOf(current);
  let best: (typeof EXPORT_TIERS)[number] | null = null;
  for (const tier of EXPORT_TIERS) {
    if (state.exportCount >= tier.at) best = tier;
  }
  if (best === null) return;
  const newIdx = RARITY_ORDER.indexOf(best.rarity);
  if (newIdx <= currentIdx) return; // 未跨新阶梯 → 无变化（去重）
  state.tiers['export-master'] = best.rarity;
  if (current === undefined) {
    state.unlocked.push('export-master'); // 首次解锁：进入 unlocked 持久化
    result.unlocked.push({ id: 'export-master', rarity: best.rarity, firstTime: true });
    result.upgraded = null;
  } else {
    result.unlocked.push({ id: 'export-master', rarity: best.rarity, firstTime: false });
    result.upgraded = { id: 'export-master', from: current, to: best.rarity };
  }
}

/**
 * 创建徽章存储。now 参数保留（未来时间戳用），当前实现不依赖时间 ——
 * 同状态 + 同事件 → 同结果（纯确定性）。
 */
export function createBadgeStore(storage: BadgeStorage, _now?: () => number): BadgeStore {
  const state = load(storage);
  return {
    getState(): BadgeState {
      return { ...state, unlocked: [...state.unlocked], tiers: { ...state.tiers } };
    },
    recordEvent(e: BadgeEvent): BadgeEventResult {
      const result: BadgeEventResult = { unlocked: [], upgraded: null };
      let changed = false;
      switch (e) {
        case 'file-opened':
          maybeUnlock(result, state, 'first-open', 'common');
          changed = result.unlocked.length > 0;
          break;
        case 'pack-saved':
          maybeUnlock(result, state, 'first-pack', 'common');
          changed = result.unlocked.length > 0;
          break;
        case 'png-exported':
          // PNG 导出成功 = 一次成功导出：解锁 first-png 且计入 exportCount。
          maybeUnlock(result, state, 'first-png', 'common');
          state.exportCount += 1;
          applyLadder(result, state);
          changed = true;
          break;
        case 'export-succeeded':
          state.exportCount += 1;
          applyLadder(result, state);
          changed = true;
          break;
      }
      if (changed) persist(storage, state);
      return result;
    },
  };
}