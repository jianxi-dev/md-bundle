import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';
import { Toolbar } from './components/Toolbar';

// jsdom 的 File 不实现 arrayBuffer()，openFile 的真实读取在 test/openFile.test.ts（node env）覆盖。
// 这里 mock 掉 openFile 以确定性验证「打开 → 默认预览」的接线。
vi.mock('./lib/openFile', () => ({
  openFile: vi.fn(async () => ({ kind: 'md', name: 'hello.md', content: '# Hello\n\n正文段落' })),
}));

afterEach(cleanup);

describe('App', () => {
  it('renders the shell: landing nav + slogan + file dropzone (empty state)', () => {
    render(<App />);
    expect(screen.getByTestId('landing-nav')).toBeInTheDocument();
    expect(screen.getByText('MD-Bundle')).toBeInTheDocument();
    const slogan = screen.getByTestId('hero-slogan');
    expect(slogan).toBeInTheDocument();
    expect(slogan.textContent).toMatch(/分享 Markdown/);
    expect(slogan.textContent).toMatch(/文本与图片/);
    expect(screen.getByTestId('dropzone')).toBeInTheDocument();
    expect(screen.getByTestId('file-input')).toHaveAttribute('accept', '.md,.mdpkg');
    expect(screen.getByText('选择或拖入文件', { exact: true })).toBeInTheDocument();
  });

  it('opens a .md document → new tab defaults to preview mode (preview pane visible) + copy-body button present', async () => {
    render(<App />);
    const file = new File(['# Hello\n\n正文段落'], 'hello.md', { type: 'text/markdown' });
    fireEvent.change(screen.getByTestId('file-input'), { target: { files: [file] } });

    // 打开后应出现页签条；预览 pane 默认可见（display: block），编辑器 pane 隐藏
    await waitFor(() => expect(screen.getByTestId('tab-strip')).toBeInTheDocument());
    expect(screen.getByTestId('tab-strip').textContent).toContain('hello.md');
    expect(screen.getByTestId('mode-pane-preview')).toHaveStyle({ display: 'block' });
    expect(screen.getByTestId('mode-pane-editor')).toHaveStyle({ display: 'none' });
    // 复制正文为图片按钮存在
    expect(screen.getByTestId('copy-body-image-btn')).toBeInTheDocument();
  });
});

describe('Toolbar', () => {
  const baseProps = {
    canSave: true,
    sourceKind: 'md' as const,
    onSave: vi.fn(),
    onExport: vi.fn(),
    onOpenFile: vi.fn(),
  };

  it('renders the copy-body-as-image button next to 打开, with title/aria-label = 复制正文为图片', () => {
    const onCopyBodyAsImage = vi.fn();
    render(<Toolbar {...baseProps} onCopyBodyAsImage={onCopyBodyAsImage} />);
    const btn = screen.getByTestId('copy-body-image-btn');
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute('title', '复制正文为图片');
    expect(btn).toHaveAttribute('aria-label', '复制正文为图片');
  });

  it('clicking 复制正文为图片 fires onCopyBodyAsImage', () => {
    const onCopyBodyAsImage = vi.fn();
    render(<Toolbar {...baseProps} onCopyBodyAsImage={onCopyBodyAsImage} />);
    fireEvent.click(screen.getByTestId('copy-body-image-btn'));
    expect(onCopyBodyAsImage).toHaveBeenCalledTimes(1);
  });

  it('export button keeps title 导出 and renders the external-link arrow glyph', () => {
    render(<Toolbar {...baseProps} />);
    const exportBtn = screen.getByTestId('export-btn');
    expect(exportBtn).toHaveAttribute('title', '导出');
    expect(exportBtn).toHaveAttribute('aria-label', '导出');
    // 图标是 stroke SVG（无 rect 文档壳 + 内部下箭头，改用外部链接箭头）
    const svg = exportBtn.querySelector('svg');
    expect(svg).not.toBeNull();
  });

  it('save button defaults to 下载 (no FSA) without fsaAvailable prop', () => {
    render(<Toolbar {...baseProps} />);
    const saveBtn = screen.getByTestId('save-btn');
    expect(saveBtn).toHaveAttribute('aria-label', '下载文档');
    expect(screen.getByTestId('save-btn-label').textContent).toBe('下载');
  });

  it('save button shows 保存 + accent class when fsaAvailable', () => {
    render(<Toolbar {...baseProps} fsaAvailable />);
    const saveBtn = screen.getByTestId('save-btn');
    expect(saveBtn).toHaveAttribute('aria-label', '保存文档');
    expect(saveBtn.className).toContain('accent');
    expect(screen.getByTestId('save-btn-label').textContent).toBe('保存');
  });

  it('save button shows 保存 when canPersist (even without fsaAvailable)', () => {
    render(<Toolbar {...baseProps} canPersist />);
    expect(screen.getByTestId('save-btn-label').textContent).toBe('保存');
  });
});
