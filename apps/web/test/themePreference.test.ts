// @vitest-environment node
// 主题三态偏好单元测试（任务 25）：load/save/resolve/apply 逻辑。
// node 环境（无 DOM）—— applyThemeToDocument 在 document 未定义时安全 no-op。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  loadThemePreference,
  saveThemePreference,
  resolveEffectiveTheme,
  applyThemeToDocument,
  systemPrefersDark,
  initTheme,
  watchSystemTheme,
  currentThemeColor,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from '../src/lib/themePreference';

/** 内存 localStorage 实现（node 环境无原生 localStorage）。 */
function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => map.set(k, v),
    removeItem: (k: string) => map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
}

let storage: Storage;

beforeEach(() => {
  storage = createMemoryStorage();
  vi.stubGlobal('localStorage', storage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadThemePreference', () => {
  it('returns "system" when nothing is stored', () => {
    expect(loadThemePreference()).toBe('system');
  });

  it('loads valid preferences', () => {
    for (const pref of ['system', 'dark', 'light'] as ThemePreference[]) {
      storage.setItem(THEME_STORAGE_KEY, pref);
      expect(loadThemePreference()).toBe(pref);
    }
  });

  it('falls back to "system" for invalid stored values', () => {
    storage.setItem(THEME_STORAGE_KEY, 'invalid');
    expect(loadThemePreference()).toBe('system');
  });

  it('falls back to "system" when localStorage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('disabled');
      },
      setItem: () => {},
    } as unknown as Storage);
    expect(loadThemePreference()).toBe('system');
  });
});

describe('saveThemePreference', () => {
  it('persists the preference to localStorage', () => {
    saveThemePreference('light');
    expect(storage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('does not throw when localStorage is unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
    } as unknown as Storage);
    expect(() => saveThemePreference('dark')).not.toThrow();
  });
});

describe('resolveEffectiveTheme', () => {
  it('returns "dark" for explicit dark preference', () => {
    expect(resolveEffectiveTheme('dark')).toBe('dark');
  });

  it('returns "light" for explicit light preference', () => {
    expect(resolveEffectiveTheme('light')).toBe('light');
  });

  it('resolves "system" based on matchMedia', () => {
    vi.stubGlobal('matchMedia', (query: string) =>
      query.includes('dark') ? { matches: true, addEventListener: () => {}, removeEventListener: () => {} } : { matches: false, addEventListener: () => {}, removeEventListener: () => {} },
    );
    expect(resolveEffectiveTheme('system')).toBe('dark');

    vi.stubGlobal('matchMedia', (query: string) =>
      query.includes('dark') ? { matches: false, addEventListener: () => {}, removeEventListener: () => {} } : { matches: true, addEventListener: () => {}, removeEventListener: () => {} },
    );
    expect(resolveEffectiveTheme('system')).toBe('light');
  });
});

describe('applyThemeToDocument', () => {
  it('no-ops when document is undefined (node env)', () => {
    // document is not defined in node env — should not throw
    expect(() => applyThemeToDocument('dark')).not.toThrow();
  });
});

describe('systemPrefersDark', () => {
  it('returns matchMedia result for prefers-color-scheme: dark', () => {
    vi.stubGlobal('matchMedia', (query: string) =>
      ({ matches: query.includes('dark') }) as MediaQueryList,
    );
    expect(systemPrefersDark()).toBe(true);

    vi.stubGlobal('matchMedia', () => ({ matches: false }) as MediaQueryList);
    expect(systemPrefersDark()).toBe(false);
  });
});

describe('initTheme', () => {
  it('loads preference and returns it', () => {
    storage.setItem(THEME_STORAGE_KEY, 'light');
    expect(initTheme()).toBe('light');
  });

  it('defaults to "system" when nothing stored', () => {
    expect(initTheme()).toBe('system');
  });
});

describe('watchSystemTheme', () => {
  it('returns a no-op cleanup when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined);
    const cleanup = watchSystemTheme(() => {});
    expect(() => cleanup()).not.toThrow();
  });

  it('registers listener and cleanup removes it', () => {
    const removeListener = vi.fn();
    const addListener = vi.fn();
    vi.stubGlobal('matchMedia', () =>
      ({
        matches: true,
        addEventListener: addListener,
        removeEventListener: removeListener,
      }) as unknown as MediaQueryList,
    );
    const callback = vi.fn();
    const cleanup = watchSystemTheme(callback);
    expect(addListener).toHaveBeenCalledWith('change', expect.any(Function));
    cleanup();
    expect(removeListener).toHaveBeenCalledWith('change', expect.any(Function));
  });
});

describe('currentThemeColor', () => {
  it('resolves color for the current effective theme', () => {
    storage.setItem(THEME_STORAGE_KEY, 'dark');
    expect(currentThemeColor('bg')).toBe('#0d1117');
    storage.setItem(THEME_STORAGE_KEY, 'light');
    expect(currentThemeColor('bg')).toBe('#ffffff');
  });
});
