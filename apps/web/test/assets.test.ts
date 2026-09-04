// 资源清单纯逻辑 + 图片提取通道的单测（任务 3.1）。
// 覆盖：去重改名（含扩展名保留）、删除、同名替换、hasImageAssets、
// wireReferences（`name.png` 与 `./name.png` 两种变体）、findReference/stripReferences、
// 剪贴板/拖拽提取、filesToAssets（dataURL + 超限跳过）。
import { describe, expect, it } from 'vitest';
import {
  MAX_ASSET_BYTES,
  addAssets,
  findReference,
  hasImageAssets,
  removeAsset,
  replaceAsset,
  stripReferences,
  uniqueName,
  wireReferences,
  type Asset,
} from '../src/lib/assets';
import { filesToAssets, imagesFromClipboard, imagesFromDataTransfer } from '../src/lib/importImages';

const asset = (name: string, size = 100): Asset => ({
  name,
  size,
  dataUrl: `data:image/png;base64,${name}`,
});

const pngFile = (name: string, bytes = 8): File =>
  new File([new Uint8Array(bytes)], name, { type: 'image/png' });

describe('uniqueName / addAssets', () => {
  it('uniqueName: 无冲突原样返回', () => {
    expect(uniqueName('a.png', new Set(['b.png']))).toBe('a.png');
  });

  it('uniqueName: 冲突 → name_1.png（保留扩展名）', () => {
    expect(uniqueName('a.png', new Set(['a.png']))).toBe('a_1.png');
    expect(uniqueName('a.jpg', new Set(['a.jpg', 'a_1.jpg']))).toBe('a_2.jpg');
  });

  it('addAssets: 空清单 + 新文件 → 全部入库', () => {
    const r = addAssets([], [asset('a.png'), asset('b.jpg')]);
    expect(r.assets.map((a) => a.name)).toEqual(['a.png', 'b.jpg']);
    expect(r.additions).toEqual(['a.png', 'b.jpg']);
    expect(r.skipped).toEqual([]);
  });

  it('addAssets: 重名 → 自动改名，原资产不被覆盖', () => {
    const existing = [asset('a.png')];
    const r = addAssets(existing, [asset('a.png'), asset('b.png')]);
    expect(r.assets.map((a) => a.name)).toEqual(['a.png', 'a_1.png', 'b.png']);
    expect(r.assets[0].dataUrl).toBe(existing[0].dataUrl); // 原资产字节未动
    expect(r.additions).toEqual(['a_1.png', 'b.png']);
  });

  it('addAssets: 连续重名 → a_1.png, a_2.png', () => {
    const r = addAssets([asset('a.png')], [asset('a.png'), asset('a.png')]);
    expect(r.assets.map((a) => a.name)).toEqual(['a.png', 'a_1.png', 'a_2.png']);
  });

  it('addAssets: 超限 → skipped，不入库', () => {
    const r = addAssets([], [asset('big.png', MAX_ASSET_BYTES + 1), asset('ok.png')]);
    expect(r.skipped).toEqual(['big.png']);
    expect(r.assets.map((a) => a.name)).toEqual(['ok.png']);
  });

  it('addAssets: 纯函数 —— 原清单不被修改', () => {
    const existing = [asset('a.png')];
    addAssets(existing, [asset('b.png')]);
    expect(existing.map((a) => a.name)).toEqual(['a.png']);
  });
});

describe('removeAsset / replaceAsset / hasImageAssets', () => {
  it('removeAsset: 删除指定项，其余保留', () => {
    const r = removeAsset([asset('a.png'), asset('b.png')], 'a.png');
    expect(r.map((a) => a.name)).toEqual(['b.png']);
  });

  it('removeAsset: 删除不存在的名字 → 原样返回', () => {
    const list = [asset('a.png')];
    expect(removeAsset(list, 'nope.png')).toEqual(list);
  });

  it('replaceAsset: 同名换字节 —— name 不变，dataUrl/size 更新', async () => {
    const list = [asset('a.png', 100)];
    const next = await replaceAsset(list, 'a.png', pngFile('a.png', 16));
    expect(next).toHaveLength(1);
    expect(next[0].name).toBe('a.png');
    expect(next[0].size).toBe(16);
    expect(next[0].dataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('replaceAsset: 超限 → 原样返回', async () => {
    const list = [asset('a.png')];
    const big = new File([new Uint8Array(MAX_ASSET_BYTES + 1)], 'a.png', { type: 'image/png' });
    expect(await replaceAsset(list, 'a.png', big)).toEqual(list);
  });

  it('hasImageAssets: 空 → false；非空 → true', () => {
    expect(hasImageAssets([])).toBe(false);
    expect(hasImageAssets([asset('a.png')])).toBe(true);
  });
});

describe('wireReferences / findReference / stripReferences', () => {
  it('wireReferences: `![a](name.png)` 接线', () => {
    const r = wireReferences('![a](name.png)', ['name.png', 'other.png']);
    expect(r.wired).toEqual(['name.png']);
    expect(r.markdown).toBe('![a](name.png)'); // markdown 原样返回
  });

  it('wireReferences: `![a](./name.png)` 变体同样接线', () => {
    const r = wireReferences('![a](./name.png)', ['name.png']);
    expect(r.wired).toEqual(['name.png']);
  });

  it('wireReferences: 不匹配的正文原样返回、wired 为空', () => {
    const md = '# t\n\n![x](https://example.com/x.png)\n\n![y](y.gif)';
    const r = wireReferences(md, ['z.png']);
    expect(r.wired).toEqual([]);
    expect(r.markdown).toBe(md);
  });

  it('wireReferences: 多引用 + 多导入名', () => {
    const md = '![a](one.png)\n![b](./two.jpg)';
    const r = wireReferences(md, ['one.png', 'two.jpg', 'three.png']);
    expect(r.wired).toEqual(['one.png', 'two.jpg']);
  });

  it('findReference: 返回既有引用原文（含 ./ 变体）；缺失 → null', () => {
    expect(findReference('![a](./name.png)', 'name.png')).toBe('![a](./name.png)');
    expect(findReference('![a](name.png)', 'name.png')).toBe('![a](name.png)');
    expect(findReference('# t', 'name.png')).toBeNull();
  });

  it('stripReferences: 两种变体都被移除，其余正文不动', () => {
    const md = '![a](name.png) keep ![b](./name.png) end';
    expect(stripReferences(md, 'name.png')).toBe(' keep  end');
  });
});

describe('imagesFromClipboard / imagesFromDataTransfer', () => {
  it('imagesFromClipboard: 图片项 → File；文本项 → 空', async () => {
    const img = pngFile('shot.png');
    const items = [
      { kind: 'file', type: 'image/png', getAsFile: () => img },
      { kind: 'file', type: 'text/plain', getAsFile: () => pngFile('note.txt') },
    ] as unknown as DataTransferItemList;
    const files = await imagesFromClipboard(items);
    expect(files).toHaveLength(1);
    expect(files[0].name).toBe('shot.png');
  });

  it('imagesFromClipboard: 空/undefined → 空数组', async () => {
    expect(await imagesFromClipboard(null)).toEqual([]);
    expect(await imagesFromClipboard(undefined)).toEqual([]);
  });

  it('imagesFromDataTransfer: 图片/文本/目录混合 → 仅图片', async () => {
    const img = pngFile('a.png');
    const dt = {
      items: [
        { kind: 'file', type: 'image/png', getAsFile: () => img },
        { kind: 'file', type: 'text/plain', getAsFile: () => pngFile('b.txt') },
        { kind: 'directory', type: '', getAsFile: () => null },
      ],
    } as unknown as DataTransfer;
    const files = await imagesFromDataTransfer(dt);
    expect(files).toHaveLength(1);
    expect(files[0].name).toBe('a.png');
  });

  it('imagesFromDataTransfer: null → 空数组', async () => {
    expect(await imagesFromDataTransfer(null)).toEqual([]);
  });
});

describe('filesToAssets', () => {
  it('File → dataURL 资产（前缀 + size + name）', async () => {
    const { assets, skipped } = await filesToAssets([pngFile('a.png', 16)]);
    expect(skipped).toEqual([]);
    expect(assets).toHaveLength(1);
    expect(assets[0].name).toBe('a.png');
    expect(assets[0].size).toBe(16);
    expect(assets[0].dataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('超限文件 → skipped（不读 dataURL）', async () => {
    const big = new File([new Uint8Array(MAX_ASSET_BYTES + 1)], 'big.png', { type: 'image/png' });
    const { assets, skipped } = await filesToAssets([big, pngFile('ok.png')]);
    expect(skipped).toEqual(['big.png']);
    expect(assets.map((a) => a.name)).toEqual(['ok.png']);
  });
});