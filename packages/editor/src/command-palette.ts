/* MD-Bundle Command Palette — Cmd+K fuzzy search with pinyin support.
 *
 * Architecture:
 * - Module-level `WeakMap<EditorView, PaletteState>` holds the open palette
 *   per view, matching the slash menu pattern (slash.ts).
 * - `openCommandPalette` / `closeCommandPalette` are the entry points.
 * - Fuzzy matching: subsequence match + pinyin first-letter match.
 * - Recently used commands are tracked in a module-level array and sorted first.
 * - Keyboard navigation: ArrowUp/Down, Enter, Escape.
 */

import { EditorView, ViewPlugin, keymap, type ViewUpdate } from '@codemirror/view';
import { Prec, type Extension } from '@codemirror/state';
import { getThemeColor } from './theme';
import { commandRegistry } from './commands';

// --- Pinyin first-letter map (common Chinese chars) ----------------------------
// Maps individual CJK characters to their pinyin first letter.
// Covers common chars used in command labels. Extend as needed.
const PINYIN_MAP: Record<string, string> = {
  文: 'w', 字: 'z', 编: 'b', 辑: 'j', 强: 'q', 大: 'd', 小: 'x',
  提: 't', 删: 's', 除: 'c', 添: 't', 加: 'j', 入: 'r', 表: 'b',
  格: 'g', 链: 'l', 接: 'j', 查: 'c', 看: 'k', 调: 'd', 用: 'y',
  互: 'h', 动: 'd', 态: 't', 主: 'z', 显: 'x', 示: 's', 例: 'l',
  快: 'k', 建: 'j', 分: 'f', 项: 'x', 折: 'z', 样: 'y', 模: 'm',
  认: 'r', 功: 'g', 控: 'k', 制: 'z', 色: 's', 材: 'c', 设: 's',
  定: 'd', 位: 'w', 页: 'y', 面: 'm', 保: 'b', 存: 'c', 恢: 'h',
  复: 'f', 在: 'z', 重: 'c', 新: 'x', 测: 'c', 试: 's', 变: 'b',
  码: 'm', 库: 'k', 展: 'z', 开: 'k', 关: 'g', 比: 'b', 较: 'j',
  同: 't', 替: 't', 禁: 'j', 启: 'q', 量: 'l', 进: 'x', 行: 'x',
  确: 'q', 是: 's', 否: 'f', 男: 'n', 女: 'n', 纯: 'c', 净: 'j',
  标: 'b', 降: 'j', 升: 's', 高: 'g', 低: 'd', 清: 'q', 结: 'j',
  构: 'g', 造: 'z', 风: 'f', 增: 'z', 框: 'k', 前: 't', 后: 'h',
  找: 'z', 本: 'b', 来: 'l', 选: 'x', 择: 'z', 参: 'c', 你: 'n',
  逆: 'n', 序: 'x', 组: 'z', 合: 'h', 单: 'd', 多: 'd', 列: 'l',
  网: 'w', 络: 'l', 安: 'a', 全: 'q', 平: 'p', 论: 'l', 证: 'z',
  搜: 's', 索: 's', 到: 'd', 回: 'h', 应: 'y', 缓: 'h', 即: 'j',
  将: 'j', 覆: 'f', 盖: 'g', 南: 'n', 春: 'c', 景: 'j', 象: 'x',
  直: 'z', 间: 'j', 难: 'n', 静: 'j', 含: 'h', 隐: 'y', 藏: 'c',
  正: 'z', 常: 'c', 超: 'c', 级: 'j', 极: 'j', 限: 'x', 初: 'c',
  始: 's', 终: 'z', 止: 'z', 完: 'w', 整: 'z', 基: 'j', 础: 'c',
  部: 'b', 自: 'z', 手: 's', 协: 'x', 助: 'z', 说: 's', 明: 'm',
  帮: 'b', 于: 'y', 我: 'w', 们: 'm', 反: 'f', 馈: 'k', 议: 'y',
  件: 'j', 夹: 'j', 类: 'l', 型: 'x', 名: 'm', 称: 'c', 路: 'l',
  径: 'j', 旧: 'j', 源: 'y', 目: 'm', 区: 'q', 域: 'y', 先: 'x',
  照: 'z', 缩: 's', 放: 'f', 旋: 'x', 转: 'z', 翻: 'f', 倾: 'q',
  斜: 'x', 圆: 'y', 角: 'j', 阴: 'y', 影: 'y', 渐: 'j', 透: 't',
  过: 'g', 滤: 'l', 糊: 'h', 锐: 'r', 化: 'h', 噪: 'z', 点: 'd',
  像: 'x', 素: 's', 饱: 'b', 和: 'h', 亮: 'l', 度: 'd', 对: 'd',
  彩: 'c', 填: 't', 充: 'c', 描: 'm', 边: 'b', 轮: 'l', 廓: 'k',
  图: 't', 片: 'p', 视: 's', 频: 'p', 音: 'y', 书: 's', 签: 'q',
  注: 'z', 脚: 'j', 尾: 'w', 引: 'y', 代: 'd', 公: 'g', 式: 's',
  题: 't', 段: 'd', 落: 'l', 插: 'c', 移: 'y', 粘: 'z', 贴: 't',
  剪: 'j', 切: 'q', 撤: 'c', 销: 'x', 做: 'z', 末: 'm', 首: 's',
  上: 's', 下: 'x', 左: 'z', 右: 'y', 内: 'n', 外: 'w', 顶: 'd',
  底: 'd', 中: 'z', 心: 'x', 垂: 'ch', 水: 'sh', 宽: 'k', 厚: 'h',
  深: 'sh', 浅: 'q', 粗: 'c', 细: 'x', 划: 'h', 嵌: 'q', 套: 't',
  叠: 'd', 收: 's', 起: 'q', 锁: 's', 解: 'j', 刷: 'sh', 载: 'z',
  更: 'g', 导: 'd', 出: 'c', 打: 'd', 印: 'y', 预: 'y', 览: 'l',
  发: 'f', 布: 'b', 享: 'x', 航: 'h', 菜: 'c', 工: 'g', 具: 'j',
  栏: 'l', 状: 'z', 信: 'x', 息: 'x', 警: 'j', 告: 'g', 错: 'c',
  误: 'w', 成: 'g', 等: 'd', 待: 'd', 取: 'q', 消: 'x', 闭: 'b',
  退: 't', 档: 'd', 置: 'z', 通: 't', 观: 'g', 体: 't', 局: 'j',
  侧: 'c', 屏: 'p', 窗: 'ch', 口: 'k', 弹: 't', 画: 'h', 板: 'b',
  历: 'l', 史: 'sh', 记: 'j', 录: 'l', 释: 'sh', 考: 'k', 资: 'z',
  料: 'l', 按: 'a', 钮: 'n', 输: 'sh', 拉: 'l', 滑: 'h', 块: 'k',
  向: 'x', 条: 't', 话: 'h', 非: 'f', 滚: 'g', 排: 'p', 筛: 'sh',
  果: 'g', 空: 'k', 另: 'l', 为: 'w', 扩: 'k', 压: 'y', 并: 'b',
  拆: 'ch', 差: 'ch', 异: 'y', 冲: 'ch', 突: 't', 版: 'b', 检: 'j',
  装: 'zh', 卸: 'x', 义: 'y', 一: 'y', 键: 'j', 步: 'b', 备: 'b',
  份: 'f', 还: 'h', 原: 'y', 站: 'zh', 最: 'z', 近: 'j', 捷: 'j',
  方: 'f', 命: 'm', 令: 'l', 马: 'm', 齐: 'j',
};

/** Get pinyin first letters for a Chinese string. Falls back to lowercase. */
function pinyinFirstLetters(text: string): string {
  const chars = [...text];
  const letters: string[] = [];
  for (const ch of chars) {
    const code = ch.codePointAt(0) ?? 0;
    // CJK Unified Ideographs range
    if (code >= 0x4e00 && code <= 0x9fff) {
      // Try the map; if not found, use the char itself as fallback
      const py = PINYIN_MAP[ch];
      letters.push(py ?? ch.toLowerCase());
    } else {
      letters.push(ch.toLowerCase());
    }
  }
  return letters.join('');
}

// --- Fuzzy matching ------------------------------------------------------------

interface MatchResult {
  score: number;
  positions: number[];
}

/**
 * Subsequence fuzzy match: returns a score + matched positions if `query`
 * is a subsequence of `text`. Lower score = better match (earlier positions).
 */
function fuzzyMatch(query: string, text: string): MatchResult | null {
  if (query.length === 0) return { score: 0, positions: [] };
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const positions: number[] = [];
  let ti = 0;
  let score = 0;
  for (let qi = 0; qi < lowerQuery.length; qi++) {
    const ch = lowerQuery[qi];
    let found = false;
    while (ti < lowerText.length) {
      if (lowerText[ti] === ch) {
        positions.push(ti);
        // Penalize gaps between matched chars
        score += qi > 0 ? (ti - positions[qi - 1]) : ti;
        ti++;
        found = true;
        break;
      }
      ti++;
    }
    if (!found) return null;
  }
  return { score, positions };
}

/**
 * Pinyin first-letter match: e.g. "wz" matches "文字加粗" (wen zi jia cu).
 * Returns MatchResult or null.
 */
function pinyinMatch(query: string, text: string): MatchResult | null {
  if (query.length === 0) return { score: 0, positions: [] };
  const letters = pinyinFirstLetters(text);
  const lowerQuery = query.toLowerCase();
  const positions: number[] = [];
  let li = 0;
  let score = 0;
  for (let qi = 0; qi < lowerQuery.length; qi++) {
    const ch = lowerQuery[qi];
    let found = false;
    while (li < letters.length) {
      if (letters[li] === ch) {
        positions.push(li);
        score += qi > 0 ? (li - positions[qi - 1]) : li;
        li++;
        found = true;
        break;
      }
      li++;
    }
    if (!found) return null;
  }
  return { score, positions };
}

// --- Recently used tracking ----------------------------------------------------

const MAX_RECENT = 10;
let recentlyUsed: string[] = [];

function markUsed(id: string): void {
  recentlyUsed = [id, ...recentlyUsed.filter((x) => x !== id)];
  if (recentlyUsed.length > MAX_RECENT) {
    recentlyUsed = recentlyUsed.slice(0, MAX_RECENT);
  }
}

function isRecent(id: string): boolean {
  return recentlyUsed.includes(id);
}

// --- Palette state -------------------------------------------------------------

interface PaletteState {
  open: boolean;
  query: string;
  selected: number;
  matches: MatchEntry[];
  dom: HTMLDivElement | null;
}

interface MatchEntry {
  id: string;
  label: string;
  icon?: string;
  keyBinding?: string | null;
  score: number;
  recent: boolean;
}

const palettes = new WeakMap<EditorView, PaletteState>();

// --- Search logic --------------------------------------------------------------

function searchCommands(query: string): MatchEntry[] {
  const all = commandRegistry.all();
  const entries: MatchEntry[] = [];

  for (const cmd of all) {
    // Try direct fuzzy match on label
    const direct = fuzzyMatch(query, cmd.label);
    if (direct) {
      entries.push({
        id: cmd.id,
        label: cmd.label,
        icon: cmd.icon,
        keyBinding: cmd.keyBinding,
        score: direct.score - (isRecent(cmd.id) ? 1000 : 0),
        recent: isRecent(cmd.id),
      });
      continue;
    }
    // Try pinyin match
    const py = pinyinMatch(query, cmd.label);
    if (py) {
      entries.push({
        id: cmd.id,
        label: cmd.label,
        icon: cmd.icon,
        keyBinding: cmd.keyBinding,
        score: py.score + 100 - (isRecent(cmd.id) ? 500 : 0),
        recent: isRecent(cmd.id),
      });
    }
  }

  // Sort: recency first, then score
  entries.sort((a, b) => {
    if (a.recent !== b.recent) return a.recent ? -1 : 1;
    return a.score - b.score;
  });
  return entries;
}

// --- DOM rendering -------------------------------------------------------------

function renderPalette(view: EditorView, state: PaletteState): void {
  if (!state.dom) return;
  state.dom.textContent = '';

  // Search input
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Type a command...';
  input.value = state.query;
  input.style.width = '100%';
  input.style.padding = '8px 12px';
  input.style.border = 'none';
  input.style.outline = 'none';
  input.style.background = 'transparent';
  input.style.color = getThemeColor('dark', 'text');
  input.style.fontSize = '14px';
  input.style.boxSizing = 'border-box';
  input.addEventListener('input', () => {
    state.query = input.value;
    state.matches = searchCommands(state.query);
    state.selected = 0;
    renderPalette(view, state);
  });
  // Prevent CM6 from stealing keystrokes while typing in the input
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === 'Escape') {
      e.stopPropagation();
    }
  });
  state.dom.appendChild(input);

  // Separator
  const sep = document.createElement('div');
  sep.style.height = '1px';
  sep.style.background = getThemeColor('dark', 'border');
  state.dom.appendChild(sep);

  // Results list
  const list = document.createElement('div');
  list.style.maxHeight = '300px';
  list.style.overflowY = 'auto';

  if (state.matches.length === 0) {
    const empty = document.createElement('div');
    empty.textContent = 'No commands found';
    empty.style.padding = '12px';
    empty.style.color = getThemeColor('dark', 'text-secondary');
    empty.style.fontSize = '13px';
    empty.style.textAlign = 'center';
    list.appendChild(empty);
  }

  state.matches.forEach((entry, i) => {
    const row = document.createElement('div');
    row.className = 'mdb-palette-item';
    row.style.padding = '6px 12px';
    row.style.cursor = 'pointer';
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '8px';
    if (i === state.selected) {
      row.setAttribute('data-selected', 'true');
      row.style.background = 'rgba(123, 134, 234, 0.18)';
    }

    const icon = document.createElement('span');
    icon.textContent = entry.icon ?? '';
    icon.style.width = '18px';
    icon.style.fontSize = '13px';
    icon.style.color = getThemeColor('dark', 'primary');
    row.appendChild(icon);

    const label = document.createElement('span');
    label.textContent = entry.label;
    label.style.flex = '1';
    label.style.fontSize = '13px';
    row.appendChild(label);

    if (entry.keyBinding) {
      const kb = document.createElement('kbd');
      kb.textContent = entry.keyBinding;
      kb.style.fontSize = '11px';
      kb.style.padding = '1px 6px';
      kb.style.border = `1px solid ${getThemeColor('dark', 'border')}`;
      kb.style.borderRadius = '3px';
      kb.style.color = getThemeColor('dark', 'text-secondary');
      row.appendChild(kb);
    }

    row.addEventListener('mousedown', (e) => {
      e.preventDefault();
      executeEntry(view, entry);
    });

    list.appendChild(row);
  });

  state.dom.appendChild(list);

  // Focus the input after render
  requestAnimationFrame(() => input.focus());
}

function executeEntry(view: EditorView, entry: MatchEntry): void {
  closeCommandPalette(view);
  markUsed(entry.id);
  commandRegistry.execute(entry.id, view);
}

// --- Open / Close --------------------------------------------------------------

export function openCommandPalette(view: EditorView): boolean {
  if (palettes.get(view)?.open) return false;

  const palette = document.createElement('div');
  palette.className = 'mdb-command-palette';
  palette.setAttribute('data-theme', 'dark');
  palette.style.position = 'absolute';
  palette.style.insetInlineEnd = '12px';
  palette.style.insetBlockStart = '12px';
  palette.style.width = '360px';
  palette.style.maxWidth = 'calc(100% - 24px)';
  palette.style.background = getThemeColor('dark', 'bg-secondary');
  palette.style.border = `1px solid ${getThemeColor('dark', 'border')}`;
  palette.style.borderRadius = '8px';
  palette.style.boxShadow = '0 8px 32px rgba(0,0,0,0.4)';
  palette.style.zIndex = '2000';
  palette.style.overflow = 'hidden';

  const state: PaletteState = {
    open: true,
    query: '',
    selected: 0,
    matches: searchCommands(''),
    dom: palette,
  };
  palettes.set(view, state);
  renderPalette(view, state);

  if (view.dom.style.position === 'static' || view.dom.style.position === '') {
    view.dom.style.position = 'relative';
  }
  view.dom.appendChild(palette);
  return true;
}

export function closeCommandPalette(view: EditorView): boolean {
  const state = palettes.get(view);
  if (!state?.open) return false;
  if (state.dom && state.dom.parentNode) {
    state.dom.parentNode.removeChild(state.dom);
  }
  palettes.delete(view);
  return true;
}

// --- Keyboard navigation -------------------------------------------------------

export function paletteSelectNext(view: EditorView): boolean {
  const state = palettes.get(view);
  if (!state?.open || !state.dom) return false;
  state.selected = Math.min(state.selected + 1, state.matches.length - 1);
  renderPalette(view, state);
  return true;
}

export function paletteSelectPrev(view: EditorView): boolean {
  const state = palettes.get(view);
  if (!state?.open || !state.dom) return false;
  state.selected = Math.max(state.selected - 1, 0);
  renderPalette(view, state);
  return true;
}

export function paletteApply(view: EditorView): boolean {
  const state = palettes.get(view);
  if (!state?.open || !state.dom) return false;
  const entry = state.matches[state.selected];
  if (!entry) return false;
  executeEntry(view, entry);
  return true;
}

export function paletteClose(view: EditorView): boolean {
  return closeCommandPalette(view);
}

// --- ViewPlugin: close on doc change / destroy ---------------------------------

const paletteCloserPlugin = ViewPlugin.define((view) => ({
  update(u: ViewUpdate): void {
    if (u.docChanged && palettes.get(u.view)?.open) {
      closeCommandPalette(u.view);
    }
  },
  destroy(): void {
    closeCommandPalette(view);
  },
}));

// --- Keymap: Cmd+K to open, arrows + Enter + Escape when open -----------------

/**
 * Command palette keymap extension. Binds Cmd+K/Ctrl+K to open the palette,
 * and ArrowUp/Down/Enter/Escape to navigate/apply/close when open.
 */
export function commandPaletteKeymap(): Extension {
  return [
    Prec.high(
      keymap.of([
        {
          key: 'Mod-k',
          run: (view) => {
            const state = palettes.get(view);
            if (state?.open) {
              closeCommandPalette(view);
              return true;
            }
            return openCommandPalette(view);
          },
        },
        { key: 'ArrowDown', run: (view) => paletteSelectNext(view) },
        { key: 'ArrowUp', run: (view) => paletteSelectPrev(view) },
        { key: 'Enter', run: (view) => paletteApply(view) },
        { key: 'Escape', run: (view) => paletteClose(view) },
      ]),
    ),
    paletteCloserPlugin,
  ];
}
