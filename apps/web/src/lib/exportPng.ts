// 已迁入 @md-bundle/app-kit/export（#509）；此处保留同名出口，避免一次性改动。
// 真正接线见 #512。
export type {
  ExportPngOptions,
  MeasureHeight,
  SvgFromHtmlOptions,
  SvgToPngBlobOptions,
} from '@md-bundle/app-kit/export/exportPng';
export {
  FOOTER_PADDING,
  exportPngFromMarkdown,
  measureHtmlHeight,
  svgFromHtml,
  svgToPngBlob,
  toWellFormedXhtml,
  withCenteredByline,
} from '@md-bundle/app-kit/export/exportPng';
