// 主题三态偏好（任务 25）：'system' | 'dark' | 'light'。
// 持久化到 localStorage（key: md-bundle.theme），系统态跟随 matchMedia。
// 导出 resolveEffectiveTheme 供 shareCard 等取当前实际主题色。
import { getThemeColor, type ThemeName } from '@md-bundle/editor';

export type ThemePreference = 'system' | 'dark' | 'light';

export const THEME_STORAGE_KEY = 'md-bundle.theme';

const VALID: readonly ThemePreference[] = ['system', 'dark', 'light'];

/** 读取持久化偏好；非法值 / 不可用 → 回退 'system'。 */
export function loadThemePreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw && (VALID as readonly string[]).includes(raw)) {
      return raw as ThemePreference;
    }
  } catch {
    // localStorage 不可用（隐私模式）→ 默认 system
  }
  return 'system';
}

/** 持久化偏好；不可用时静默忽略。 */
export function saveThemePreference(pref: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // 存储不可用 → 不持久化，不抛错
  }
}

/** 系统当前是否偏好暗色。 */
export function systemPrefersDark(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
}

/** 解析三态偏好为实际主题名（'dark' | 'light'）。 */
export function resolveEffectiveTheme(pref: ThemePreference): ThemeName {
  if (pref === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return pref;
}

/** 把实际主题名同步到 document.documentElement.data-theme。 */
export function applyThemeToDocument(theme: ThemeName): void {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = theme;
  }
}

/** 初始化主题（应用启动时调用一次）：读偏好 → 解析 → 同步到 DOM。 */
export function initTheme(): ThemePreference {
  const pref = loadThemePreference();
  applyThemeToDocument(resolveEffectiveTheme(pref));
  return pref;
}

/** 监听系统主题变化；仅在偏好为 'system' 时回调。 */
export function watchSystemTheme(callback: () => void): () => void {
  if (typeof matchMedia !== 'function') return () => {};
  const mq = matchMedia('(prefers-color-scheme: dark)');
  const handler = () => callback();
  mq.addEventListener('change', handler);
  return () => mq.removeEventListener('change', handler);
}

/** 取当前有效主题色（供 shareCard 等使用）。 */
export function currentThemeColor(colorName: Parameters<typeof getThemeColor>[1]): string {
  return getThemeColor(resolveEffectiveTheme(loadThemePreference()), colorName);
}
