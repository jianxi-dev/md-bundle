/**
 * `@md-bundle/app-kit/export` — 导出管线公共入口。
 * 实现自 #509 由 `apps/web/src/lib/export*.ts` 迁入；web 侧老路径退化为 re-export 垫片。
 * 需要「只引一个能力、不连带拉入 CM6」的消费方走 `@md-bundle/app-kit/export/<module>` 子路径。
 */
export type { Asset } from './asset';
export { resolveAssetDataUrl } from './asset';

export { bytesToDataUrl, dataUrlToBytes } from './dataUrl';

export {
  BYLINE_BASE_URL,
  BYLINE_TEXT,
  bylineCenteredBadgeHtml,
  bylineCornerBadgeHtml,
  bylineFooterHtml,
  bylineHref,
} from './byline';

export type { CreateObjectUrl, DownloadText } from './download';
export { downloadBlob, downloadText } from './download';

export { getKatexCssInlined, hasKatex } from './katexFonts';

export { STANDALONE_RENDERER_JS, getStandaloneStyles } from './exportRenderer';

export type { BuildHtmlDocumentOptions } from './exportHtml';
export { buildHtmlDocument, inlineImages } from './exportHtml';

export type {
  ExportPngOptions,
  MeasureHeight,
  SvgFromHtmlOptions,
  SvgToPngBlobOptions,
} from './exportPng';
export {
  FOOTER_PADDING,
  exportPngFromMarkdown,
  measureHtmlHeight,
  svgFromHtml,
  svgToPngBlob,
  toWellFormedXhtml,
  withCenteredByline,
} from './exportPng';

export type { ExportMdpkgOptions } from './exportMdpkg';
export { ENTRY_FILENAME, exportMdpkg } from './exportMdpkg';

export type { ExportDocxOptions, ExportDocxResult } from './exportDocx';
export { DEFAULT_DOCX_FILENAME, exportDocx } from './exportDocx';
