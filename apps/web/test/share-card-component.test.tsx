// 分享卡组件测试（任务 6.2）—— jsdom 环境。栅格化（canvas/Image）在 jsdom 不可用，
// 因此 mock shareCardAsImage（复制 seam 注入点）与 downloadBlob，验证组件接线：
// 禁用态（disabled prop / 无文档数据）、点击 → 复制成功状态、复制失败 → 下载兜底。
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ShareCard } from '../src/components/ShareCard';
import { shareCardAsImage } from '../src/lib/shareCard';
import { downloadBlob } from '../src/lib/download';

vi.mock('../src/lib/shareCard', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../src/lib/shareCard')>();
  return { ...mod, shareCardAsImage: vi.fn() };
});

vi.mock('../src/lib/download', () => ({ downloadBlob: vi.fn() }));

const mockedShare = vi.mocked(shareCardAsImage);
const mockedDownload = vi.mocked(downloadBlob);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const PROPS = {
  title: '我的文档',
  markdown: '# 标题\n\n正文',
  stats: { chars: 42, images: 2 },
};

describe('ShareCard', () => {
  it('renders the button and enables it when document data exists', () => {
    render(<ShareCard {...PROPS} />);
    const btn = screen.getByTestId('share-card-btn');
    expect(btn).toBeEnabled();
    expect(btn).toHaveTextContent('复制为图片');
  });

  it('disables the button when the disabled prop is set', () => {
    render(<ShareCard {...PROPS} disabled />);
    expect(screen.getByTestId('share-card-btn')).toBeDisabled();
  });

  it('disables the button when there is no document data (canShare false)', () => {
    render(<ShareCard title="" markdown="" stats={{ chars: 0, images: 0 }} />);
    expect(screen.getByTestId('share-card-btn')).toBeDisabled();
  });

  it('click with copy success → status 已复制到剪贴板 + onCopied fired', async () => {
    const onCopied = vi.fn();
    mockedShare.mockResolvedValue({ copied: true, blob: new Blob() });
    render(<ShareCard {...PROPS} onCopied={onCopied} />);
    fireEvent.click(screen.getByTestId('share-card-btn'));
    expect(await screen.findByTestId('share-card-status')).toHaveTextContent('已复制到剪贴板');
    expect(onCopied).toHaveBeenCalledTimes(1);
    expect(mockedDownload).not.toHaveBeenCalled();
  });

  it('click with copy failure → downloads share-card.png fallback + onDownloaded fired', async () => {
    const onDownloaded = vi.fn();
    const blob = new Blob(['x'], { type: 'image/png' });
    mockedShare.mockResolvedValue({ copied: false, blob });
    render(<ShareCard {...PROPS} onDownloaded={onDownloaded} />);
    fireEvent.click(screen.getByTestId('share-card-btn'));
    expect(await screen.findByTestId('share-card-status')).toHaveTextContent('已下载 share-card.png');
    expect(mockedDownload).toHaveBeenCalledWith(blob, 'share-card.png');
    expect(onDownloaded).toHaveBeenCalledTimes(1);
  });

  it('click with rejection → error status, no crash', async () => {
    mockedShare.mockRejectedValue(new Error('文档为空'));
    render(<ShareCard {...PROPS} />);
    fireEvent.click(screen.getByTestId('share-card-btn'));
    expect(await screen.findByTestId('share-card-status')).toHaveTextContent('文档为空');
  });

  it('showPreview renders the card HTML preview', () => {
    render(<ShareCard {...PROPS} showPreview />);
    const preview = screen.getByTestId('share-card-preview');
    expect(preview).toBeTruthy();
    expect(preview.innerHTML).toContain('我的文档');
    expect(preview.innerHTML).toContain('?ref=md-share');
  });
});