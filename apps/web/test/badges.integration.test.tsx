// 徽章接线集成测试（任务 6.4）—— 三层：
// 1. wireBadgeEvents 接线缝：4.1 成功信号 → 徽章事件的映射正确性（store + spy）。
// 2. useBadges 钩子：recordAndToast 解锁 → toast 文案；重复触发不重复弹；升级行；自动消失。
// 3. BadgeToast 组件：role=status 渲染 + 稀有度着色。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createBadgeStore, type BadgeStore, type Rarity } from '../src/lib/badges';
import { BadgeToast } from '../src/components/BadgeToast';
import { useBadges, wireBadgeEvents } from '../src/lib/useBadges';

function fakeStorage(): Pick<Storage, 'getItem' | 'setItem'> {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => {
      m.set(k, v);
    },
  };
}

function Harness(): JSX.Element {
  const { toast, recordAndToast, dismiss } = useBadges();
  return (
    <div>
      <button onClick={() => recordAndToast('file-opened')}>open</button>
      <button onClick={() => recordAndToast('pack-saved')}>pack</button>
      <button onClick={() => recordAndToast('export-succeeded')}>export</button>
      {toast && <BadgeToast text={toast.text} rarity={toast.rarity} onDismiss={dismiss} />}
    </div>
  );
}

describe('wireBadgeEvents（6.4 接线缝）', () => {
  it('pack-saved 仅在 saveDocument 返回 mdpkg 时触发', () => {
    const store = createBadgeStore(fakeStorage());
    const recordSpy = vi.spyOn(store, 'recordEvent');
    const handlers = {
      onSaveSuccess: vi.fn(),
      onPngExportSuccess: vi.fn(),
      onExportSuccess: vi.fn(),
      onFileOpen: vi.fn(),
    };
    const wire = wireBadgeEvents(store, handlers);

    wire.onSaveResult('mdpkg');
    expect(recordSpy).toHaveBeenCalledWith('pack-saved');
    expect(handlers.onSaveSuccess).toHaveBeenCalledTimes(1);
    expect(handlers.onSaveSuccess.mock.calls[0][0].unlocked[0].id).toBe('first-pack');

    wire.onSaveResult('md');
    wire.onSaveResult(null);
    expect(recordSpy).toHaveBeenCalledTimes(1); // 'md'/null 均不触发
  });

  it('png 成功 → png-exported + export-succeeded 双事件；其它格式成功 → 仅 export-succeeded', () => {
    const store = createBadgeStore(fakeStorage());
    const recordSpy = vi.spyOn(store, 'recordEvent');
    const handlers = {
      onSaveSuccess: vi.fn(),
      onPngExportSuccess: vi.fn(),
      onExportSuccess: vi.fn(),
      onFileOpen: vi.fn(),
    };
    const wire = wireBadgeEvents(store, handlers);

    wire.onExportResult('png', true);
    expect(recordSpy).toHaveBeenCalledWith('png-exported');
    expect(recordSpy).toHaveBeenCalledWith('export-succeeded');
    expect(handlers.onPngExportSuccess).toHaveBeenCalledTimes(1);
    expect(handlers.onExportSuccess).toHaveBeenCalledTimes(1);

    recordSpy.mockClear();
    handlers.onExportSuccess.mockClear();
    wire.onExportResult('md', true);
    wire.onExportResult('html', true);
    wire.onExportResult('mdpkg', true);
    expect(recordSpy).not.toHaveBeenCalledWith('png-exported');
    expect(recordSpy).toHaveBeenCalledTimes(3); // 每次成功各一次 export-succeeded
    expect(handlers.onExportSuccess).toHaveBeenCalledTimes(3);
  });

  it('导出失败（ok=false）→ 无任何事件', () => {
    const store = createBadgeStore(fakeStorage());
    const recordSpy = vi.spyOn(store, 'recordEvent');
    const handlers = {
      onSaveSuccess: vi.fn(),
      onPngExportSuccess: vi.fn(),
      onExportSuccess: vi.fn(),
      onFileOpen: vi.fn(),
    };
    const wire = wireBadgeEvents(store, handlers);

    wire.onExportResult('png', false);
    wire.onExportResult('md', false);
    expect(recordSpy).not.toHaveBeenCalled();
    expect(handlers.onPngExportSuccess).not.toHaveBeenCalled();
    expect(handlers.onExportSuccess).not.toHaveBeenCalled();
  });

  it('打开成功 → file-opened', () => {
    const store = createBadgeStore(fakeStorage());
    const recordSpy = vi.spyOn(store, 'recordEvent');
    const handlers = {
      onSaveSuccess: vi.fn(),
      onPngExportSuccess: vi.fn(),
      onExportSuccess: vi.fn(),
      onFileOpen: vi.fn(),
    };
    const wire = wireBadgeEvents(store, handlers);

    wire.onFileOpened();
    expect(recordSpy).toHaveBeenCalledWith('file-opened');
    expect(handlers.onFileOpen).toHaveBeenCalledTimes(1);
  });
});

describe('useBadges（6.4 钩子）', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('recordAndToast：解锁 → toast 文案「解锁徽章：{label}（{rarity}）」', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('open'));
    const toast = screen.getByTestId('badge-toast');
    expect(toast).toHaveTextContent('解锁徽章：首次打开（common）');
    expect(toast).toHaveAttribute('role', 'status');
  });

  it('重复触发不重复弹：dismiss 后再触发同一事件 → 无 toast', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('open'));
    expect(screen.getByTestId('badge-toast')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('badge-toast')); // dismiss
    expect(screen.queryByTestId('badge-toast')).toBeNull();

    fireEvent.click(screen.getByText('open')); // 已解锁 → 空结果 → 不弹
    expect(screen.queryByTestId('badge-toast')).toBeNull();
  });

  it('不同事件各自解锁：pack-saved → 首次打包', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('pack'));
    expect(screen.getByTestId('badge-toast')).toHaveTextContent('解锁徽章：首次打包（common）');
  });

  it('升级行：export-master 跨阶梯 → 「徽章升级：{label} → {rarity}」', () => {
    window.localStorage.setItem(
      'md-bundle.badges',
      JSON.stringify({
        version: 1,
        unlocked: ['first-open', 'first-pack', 'first-png', 'export-master'],
        tiers: {
          'first-open': 'common',
          'first-pack': 'common',
          'first-png': 'common',
          'export-master': 'rare',
        },
        exportCount: 9,
      }),
    );
    render(<Harness />);
    fireEvent.click(screen.getByText('export')); // count 9 → 10 → epic
    expect(screen.getByTestId('badge-toast')).toHaveTextContent('徽章升级：导出大师 → epic');
  });

  it('自动消失：3.5s 后 toast 关闭（fake timers）', () => {
    vi.useFakeTimers();
    render(<Harness />);
    fireEvent.click(screen.getByText('open'));
    expect(screen.getByTestId('badge-toast')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3500);
    });
    expect(screen.queryByTestId('badge-toast')).toBeNull();
  });
});

describe('BadgeToast（6.4 组件）', () => {
  afterEach(cleanup);

  it('渲染 role=status + 文案 + 稀有度颜色；点击触发 onDismiss', () => {
    const onDismiss = vi.fn();
    render(<BadgeToast text="解锁徽章：首次打开（common）" rarity="common" onDismiss={onDismiss} />);
    const toast = screen.getByTestId('badge-toast');
    expect(toast).toHaveAttribute('role', 'status');
    expect(toast).toHaveTextContent('解锁徽章：首次打开（common）');
    expect(toast).toHaveTextContent('✨');
    expect(toast.querySelector('span[style]')).toHaveStyle({ color: '#8b949e' });

    fireEvent.click(toast);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('稀有度颜色映射：rare/epic/legendary', () => {
    const cases: Array<[Rarity, string]> = [
      ['rare', '#58a6ff'],
      ['epic', '#a371f7'],
      ['legendary', '#d29922'],
    ];
    for (const [rarity, color] of cases) {
      const { unmount } = render(
        <BadgeToast text={`t-${rarity}`} rarity={rarity} onDismiss={() => {}} />,
      );
      expect(screen.getByTestId('badge-toast').querySelector('span[style]')).toHaveStyle({
        color,
      });
      unmount();
    }
  });
});