// lib/save.test.ts —— 保存模型契约（决策 #42）。
// 覆盖：① handle 路径写回（不返回 diskHandle）；② save-as 路径返回新 diskHandle；
// ③ 无 FSA 下载路径（不返回 diskHandle）；④ 用户取消 → {ok:false, error:'cancelled'}。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saveDocument, decideSaveKind } from './save';
import type { Asset } from './assets';

// ── mdpkg 序列化依赖 vendor 动态导入 —— 用 mock 规避（serializeDocument 内部调用 exportMdpkg） ──
vi.mock('./exportMdpkg', () => ({
  exportMdpkg: vi.fn(() => new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00])),
}));

vi.mock('./export', () => ({
  exportMd: vi.fn(() => true),
}));

vi.mock('./download', () => ({
  downloadBlob: vi.fn(),
}));

function makeHandle(name: string): FileSystemFileHandle {
  return {
    name,
    kind: 'file',
    getFile: vi.fn(),
    createWritable: vi.fn(async () => ({
      write: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
      abort: vi.fn(async () => undefined),
    })),
    isSameEntry: vi.fn(),
  } as unknown as FileSystemFileHandle;
}

describe('saveDocument', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    (window as unknown as Record<string, unknown>).showSaveFilePicker = undefined;
    (window as unknown as Record<string, unknown>).showDirectoryPicker = undefined;
    (window as unknown as Record<string, unknown>).showOpenFilePicker = undefined;
  });

  function installFsaPickers() {
    const createdHandle = makeHandle('test.md');
    (window as unknown as Record<string, unknown>).showSaveFilePicker = vi.fn(async () => createdHandle);
    (window as unknown as Record<string, unknown>).showDirectoryPicker = vi.fn(async () => ({} as FileSystemDirectoryHandle));
    (window as unknown as Record<string, unknown>).showOpenFilePicker = vi.fn(async () => [createdHandle]);
  }

  it('路径①：持 diskHandle 写回 → ok + via=handle，不返回 diskHandle', async () => {
    const handle = makeHandle('existing.md');
    const result = await saveDocument({
      markdown: '# Hello',
      assets: [],
      sourceKind: 'md',
      diskHandle: handle,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.via).toBe('handle');
      expect(result.diskHandle).toBeUndefined();
    }
  });

  it('路径②：FSA 可用 + 无句柄 → save-as 返回新 diskHandle', async () => {
    installFsaPickers();
    const createdHandle = makeHandle('new.md');
    ((window as unknown as Record<string, unknown>).showSaveFilePicker as ReturnType<typeof vi.fn>).mockResolvedValue(createdHandle);

    const result = await saveDocument({
      markdown: '# Save As',
      assets: [],
      sourceKind: 'md',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.via).toBe('save-as');
      expect(result.diskHandle).toBe(createdHandle);
    }
  });

  it('路径③：无 FSA → download，不返回 diskHandle', async () => {
    // 不注入 pickers → isFsaAvailable() 返回 false
    const result = await saveDocument({
      markdown: '# Download',
      assets: [],
      sourceKind: 'md',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.via).toBe('download');
      expect(result.diskHandle).toBeUndefined();
    }
  });

  it('用户取消 showSaveFilePicker → {ok:false, error:cancelled}', async () => {
    installFsaPickers();
    const abortError = new DOMException('用户取消', 'AbortError');
    ((window as unknown as Record<string, unknown>).showSaveFilePicker as ReturnType<typeof vi.fn>).mockRejectedValue(abortError);

    const result = await saveDocument({
      markdown: '# Cancel',
      assets: [],
      sourceKind: 'md',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('cancelled');
    }
  });
});

describe('decideSaveKind', () => {
  it('有 assets → mdpkg', () => {
    const asset: Asset = { name: 'a.png', size: 100, dataUrl: 'data:image/png;base64,AAAA' };
    expect(decideSaveKind({ assets: [asset], sourceKind: 'md' })).toBe('mdpkg');
  });
  it('sourceKind=mdpkg + 无 assets → mdpkg', () => {
    expect(decideSaveKind({ assets: [], sourceKind: 'mdpkg' })).toBe('mdpkg');
  });
  it('sourceKind=md + 无 assets → md', () => {
    expect(decideSaveKind({ assets: [], sourceKind: 'md' })).toBe('md');
  });
});
