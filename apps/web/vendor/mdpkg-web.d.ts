// Vendored from jianxi-dev/mdpkg @ 59d5df2d4fa76152f25acf6425cb78530ccb0225 (v0.3.0.0+, docx quality fixes + toHtml/openFiles/openMarkdown web entry)
// Ambient type declaration for the vendored mdpkg-web.js ESM bundle.
// The bundle is a plain .js file (no allowJs in tsconfig) — this .d.ts gives
// TypeScript the module surface without touching the vendored bytes.
// Types mirror the upstream source (packages/mdpkg/web/mdpkg-web.ts + src/manifest.ts).
// Do NOT edit mdpkg-web.js; if the upstream API changes, update this file to match.

export interface Manifest {
  format: 'mdpkg';
  spec_version: string;
  entrypoint?: string;
  encoding?: 'utf-8';
  extensions?: { symbols?: 'off' | 'core' | 'extended'; include?: boolean };
  extensions_required?: string[];
  resources: {
    path: string;
    media_type: string;
    size: number;
    sha256: string;
    source_url?: string;
  }[];
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  externalCount: number;
}

export interface OpenOptions {
  /** 符号扩展开关（默认 true，跟随 manifest.extensions.symbols） */
  symbols?: boolean;
}

export interface OpenFilesOptions extends OpenOptions {
  /** include 展开开关（缺省跟随 manifest.extensions.include；无 manifest 时默认展开） */
  include?: boolean;
}

export interface OpenResult {
  files: Map<string, Uint8Array>;
  manifest: Manifest | null;
  validation: ValidationResult;
  /** 完整自包含 HTML 文档（含 <!doctype> 与内联样式）。渲染阶段失败时为 null */
  html: string | null;
  /** 渲染是否发生降级（浏览器端无文件系统，仅作提示） */
  degraded: boolean;
  /** 渲染阶段错误（校验错误见 validation.errors）。成功时为 null */
  error: string | null;
}

export interface ExpandResult {
  text: string;
  sources: { file: string }[];
  count: number;
}

export declare class MdeError extends Error {
  code: string;
}

/** 打开 .mdpkg：解包 → 校验 → 渲染。非 ZIP / 0 条目直接 throw MdeError（调用方需 try/catch） */
export declare function openMdpkg(bytes: Uint8Array, opts?: OpenOptions): Promise<OpenResult>;

/** 编辑后重新打包：删除旧 manifest.json 并按规范重建，返回新的 .mdpkg 字节流 */
export declare function packMdpkg(files: Map<string, Uint8Array>, prevManifest?: Manifest): Uint8Array;

/** 任意文件 Map 直开（目录/多条目拖入统一入口，lenient 渲染，include 缺省展开） */
export declare function openFiles(files: Map<string, Uint8Array>, opts?: OpenFilesOptions): Promise<OpenResult>;

/** 单 .md 文件直开（无需打包，include 关闭、<<< 降级为可见文本） */
export declare function openMarkdown(name: string, bytes: Uint8Array, opts?: OpenOptions): Promise<OpenResult>;

/** 包 → 完整自包含 HTML 字符串（主题/样式内联，用于预览 iframe） */
export declare function toHtml(files: Map<string, Uint8Array>, opts?: OpenOptions): string;

/** 读取入口 Markdown 原文（include 未展开）。预览源码用 */
export declare function readEntrySource(files: Map<string, Uint8Array>, entry?: string): string;

/** Uint8Array → base64（浏览器/Node 统一实现） */
export declare function toBase64(data: Uint8Array): string;

/** include 展开（与 CLI 共用实现），返回展开文本与来源清单 */
export declare function expand(files: Map<string, Uint8Array>, entry: string): ExpandResult;

/** 生成 manifest：机器事实重算，作者意图继承 */
export declare function buildManifest(files: Map<string, Uint8Array>, prev?: Manifest): Manifest;

// --- DOCX / ZIP / Markdown export (upstream bbc1f1c web entry re-exports) ---

export interface DocxOptions {
  /** 符号扩展开关（默认 true，跟随 manifest.extensions.symbols，与 HTML 路径一致） */
  symbols?: boolean;
  /** 图片默认宽度（EMU，1 英寸 = 914400），默认 6 英寸 */
  imageWidthEmu?: number;
  /** 图片默认高度（EMU），默认按 4:3（宽 × 0.75） */
  imageHeightEmu?: number;
}

export interface ZipExportOptions {
  /** 自定义 README 内容；缺省用内置中文模板 */
  readme?: string;
}

export interface MarkdownExportOptions {
  /** include 展开开关：缺省跟随 manifest.extensions.include（无 manifest 时默认展开）；显式 false 不展开（<<< 降级为可见文本） */
  include?: boolean;
}

/** DOCX 导出（OOXML 最小写入器，浏览器/Node 通用）。渲染错误抛 MdeError（调用方需 try/catch） */
export declare function toDocx(files: Map<string, Uint8Array>, opts?: DocxOptions, onWarning?: (msg: string) => void): Uint8Array;

/** Zip 导出（buildZipExport 别名）：包 → 标准 zip 交付物（include 展开、无 manifest.json、附 README.md） */
export declare function toZip(pkg: Map<string, Uint8Array>, opts?: ZipExportOptions): Uint8Array;

/** Markdown 导出：入口文档展开后单文件文本（符号保持源文本，不转换） */
export declare function toMarkdown(files: Map<string, Uint8Array>, opts?: MarkdownExportOptions): string;