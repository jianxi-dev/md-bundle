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

/** 读取入口 Markdown 原文（include 未展开）。预览源码用 */
export declare function readEntrySource(files: Map<string, Uint8Array>, entry?: string): string;

/** Uint8Array → base64（浏览器/Node 统一实现） */
export declare function toBase64(data: Uint8Array): string;

/** include 展开（与 CLI 共用实现），返回展开文本与来源清单 */
export declare function expand(files: Map<string, Uint8Array>, entry: string): ExpandResult;

/** 生成 manifest：机器事实重算，作者意图继承 */
export declare function buildManifest(files: Map<string, Uint8Array>, prev?: Manifest): Manifest;