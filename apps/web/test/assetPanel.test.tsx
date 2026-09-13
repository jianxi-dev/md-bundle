// AssetPanel 主题可读性回归测试（缺陷 #74）—— 浅色主题下标题/文件名/未引用标记
// 必须走主题 token，而非硬编码的暗色专用前景（text-slate-* / text-white 等），
// 否则浅底上的近白文字不可读。此处锁定「回归类别」而非某个具体 token。
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AssetPanel } from '../src/components/AssetPanel';

// vitest 未开 globals:true → testing-library 不会自动 cleanup，必须显式调用
afterEach(cleanup);

const ASSET = {
  name: 'shot.png',
  size: 2048,
  dataUrl: 'data:image/png;base64,AAAA',
};

// 主题前景变量：text-[var(--fg)] / text-[var(--fg-2)] / text-[var(--muted)] 等
const THEME_TEXT = /text-\[var\(--[a-z0-9-]+\)\]/;
// 硬编码的暗色专用前景 —— 浅底不可读
const FIXED_LIGHT = /text-(slate|gray|zinc|neutral|stone|white)\b/;

function renderPanel(documentText = ''): void {
  render(
    <AssetPanel
      assets={[ASSET]}
      documentText={documentText}
      onDelete={vi.fn()}
      onReplace={vi.fn()}
    />,
  );
}

describe('AssetPanel 主题 token', () => {
  it('标题与文件名使用主题前景变量，而非硬编码浅色', () => {
    renderPanel();
    const heading = screen.getByRole('heading', { name: /资源清单/ });
    const name = screen.getByTitle(ASSET.name);

    for (const el of [heading, name]) {
      expect(el.className).toMatch(THEME_TEXT);
      expect(el.className).not.toMatch(FIXED_LIGHT);
    }
  });

  it('缩略图带主题边框，浅底仍有边界', () => {
    renderPanel();
    const img = screen.getByRole('img', { name: ASSET.name });
    expect(img.className).toMatch(/border-\[var\(--border\)\]/);
  });

  it('未引用标记使用主题告警色，而非固定 amber 前景', () => {
    renderPanel();
    const badge = screen.getByTestId('orphan-count');
    expect(badge.className).toMatch(/text-\[var\(--warn\)\]/);
    expect(badge.className).not.toMatch(/text-amber-/);
  });
});
