// DOCX 导出 —— 上游 vendored toDocx 的薄封装（任务 3.1）。
// 职责：剥离 YAML frontmatter → 组装 files Map（document.md + 每资产原始字节）→
// 调 toDocx → Blob → 注入式下载。
// 上游 toDocx 负责 OOXML 写入 / 图片内联 / 结构保真 —— 本模块零解析、零 zip 逻辑。

import { toDocx } from '../../vendor/mdpkg-web.js';
import type { Asset } from './assets';
import { dataUrlToBytes } from './dataUrl';
import { ENTRY_FILENAME } from './exportMdpkg';
import { downloadBlob, type CreateObjectUrl } from './download';

/** 默认下载文件名。 */
export const DEFAULT_DOCX_FILENAME = 'document.docx';

export interface ExportDocxOptions {
  /** Markdown 源文本。 */
  markdown: string;
  /** 文档标题（仅接口兼容保留；上游 toDocx 无标题参数，不写入 docx 文档属性）。 */
  title?: string;
  /** 图片资产清单（图片引用按相对路径在 files Map 中解析）。 */
  assets?: Asset[];
  /** 下载实现，默认 downloadBlob —— 测试注入 spy 断言字节与文件名。 */
  download?: (blob: Blob, filename: string, createObjectUrl?: CreateObjectUrl) => void;
  /** 下载文件名，默认 'document.docx'。 */
  filename?: string;
  /** 上游非致命警告回调（SVG 降级、图片头解析失败等）。 */
  onWarning?: (msg: string) => void;
}

/** 导出结果契约 —— 绝不抛出，任何异常收敛为 { ok: false, error }。 */
export type ExportDocxResult = { ok: true } | { ok: false; error: string };

/** 剥离 YAML frontmatter（文件开头被 --- 包裹的元数据块）。 */
function stripYamlFrontmatter(md: string): string {
  const trimmed = md.replace(/^\s+/, '');
  if (!trimmed.startsWith('---')) return md;
  const lines = trimmed.split('\n');
  // 找闭合的 ---（第二行起）
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      return lines.slice(i + 1).join('\n');
    }
  }
  return md;
}

/**
 * 导出 markdown 为 .docx 文件（上游 toDocx 薄封装）。
 * @returns ExportDocxResult —— 成功 { ok: true }，失败 { ok: false, error }。
 */
export async function exportDocx(opts: ExportDocxOptions): Promise<ExportDocxResult> {
  const {
    markdown,
    assets = [],
    filename = DEFAULT_DOCX_FILENAME,
    onWarning,
  } = opts;
  const download = opts.download ?? downloadBlob;

  try {
    // 任务 3.1.1：剥离 YAML frontmatter（上游不剥离，保持现网行为）
    const stripped = stripYamlFrontmatter(markdown);

    // 任务 3.1.2：组装 files Map（复用 exportMdpkg 的 ENTRY_FILENAME 约定）
    const files = new Map<string, Uint8Array>();
    files.set(ENTRY_FILENAME, new TextEncoder().encode(stripped));
    for (const asset of assets) {
      files.set(asset.name, dataUrlToBytes(asset.dataUrl));
    }

    // 任务 3.1.3：调上游 toDocx（symbols: true 与 HTML 路径一致）
    const bytes = toDocx(files, { symbols: true }, onWarning);

    // 任务 3.1.4：Uint8Array → Blob → 注入式下载
    const copy = new Uint8Array(bytes.length);
    copy.set(bytes);
    const blob = new Blob([copy], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    download(blob, filename);

    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
