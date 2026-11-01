# @md-bundle/app-kit

网页端与 Clairis 共用的应用层能力包。四个子入口加一个 vendor 入口，覆盖 `.mdpkg` 打开与打包、导出（HTML / PNG 长图 / .mdpkg / docx）、目录大纲、图片剪贴板。包本身不渲染 UI，唯一例外是 `./outline/OutlineMenu` 那个浮层组件。

这份文档写给没参与过这次迁移的工程师，以及 Clairis 侧的接手指引。文档里每个导出名、每个参数、每个返回类型都能在 `packages/app-kit/src/**` 里逐字对上；核对不了的地方会写「见 `packages/app-kit/src/<file>`」，不猜。

## 一、入口清单

子入口以 `packages/app-kit/package.json` 的 `exports` 字段为准，逐字一致：

| import 路径 | 提供什么 | 谁在用 |
|---|---|---|
| `@md-bundle/app-kit` | 仅类型出口：`ClipboardWriter` / `ExportFormat` / `FilePayload` / `OpenPackageResult` / `OutlineHeading` / `OutlineNavigator` / `SaveFile` | 只需要契约类型的消费方 |
| `@md-bundle/app-kit/mdpkg` | `openPackage` / `readEntrySource` / `MdeError` / `Manifest` / `OpenOptions` / `OpenResult` / `ValidationResult` | 网页端打开 `.mdpkg`（`apps/web/src/lib/openFile.ts`） |
| `@md-bundle/app-kit/vendor` | vendored `mdpkg-web.js` 的原始出口（`packMdpkg` / `toDocx` / `toZip` / `toMarkdown` / `openMdpkg` / `openFiles` / `openMarkdown` / `toHtml` / `expand` / `buildManifest` / `toBase64`） | 网页端导出 zip / markdown（`apps/web/src/App.tsx`） |
| `@md-bundle/app-kit/export` | 导出管线的 barrel，聚合下面 `./export/*` 的全部出口 | 浏览器渲染进程内、需要多个导出能力的消费方 |
| `@md-bundle/app-kit/export/*` | 单模块子路径（`asset` / `byline` / `dataUrl` / `download` / `exportDocx` / `exportHtml` / `exportMdpkg` / `exportPng` / `exportRenderer` / `katexFonts`） | 只要一个能力、不想连带拉进 CM6 的消费方（Electron 主进程、node 单测） |
| `@md-bundle/app-kit/outline` | 大纲聚合入口：`extractHeadings` / `createOutlineNavigator` / `OutlineMenu` / `OutlineMode` / `OutlineEditorView` / `OutlineNavigatorSources` / `OutlineMenuProps` | 网页端（`apps/web/src/App.tsx`） |
| `@md-bundle/app-kit/outline/headings` | `extractHeadings` / `OutlineHeading` | 只要解析函数的消费方 |
| `@md-bundle/app-kit/outline/OutlineMenu` | `OutlineMenu` 组件 / `OutlineMenuProps` | 网页端（`apps/web/src/App.tsx`） |
| `@md-bundle/app-kit/clipboard` | `copyImageToClipboard` / `browserClipboardWriter` | 网页端「复制正文为图片」（`apps/web/src/App.tsx`）与分享卡（`apps/web/src/lib/shareCard.ts`） |

两个已知的坑：

1. `./export` 这个 barrel 会经 `@md-bundle/editor` 的设计令牌把 CM6 拉进 import 图（`exportPng.ts` 与 `exportHtml.ts` 都从 `@md-bundle/editor` 取 `getThemeColor` / `ThemeName`）。纯函数或打包能力的消费方，例如 Electron 主进程、node 单测，应当走 `./export/<module>` 子路径，别用 barrel。
2. `./export/*` 是通配到 `.ts` 的（`"./export/*": "./src/export/*.ts"`）。`outline` 目录含 `.tsx`，所以 outline 的三个入口是逐条枚举的，不是通配。

## 二、子入口契约

### 2.1 `./mdpkg`

```ts
export type { Manifest, OpenOptions, OpenResult, ValidationResult } from '../vendor/mdpkg-web.js';
export type OpenPackageResult = OpenResult | { error: string };

export async function openPackage(bytes: Uint8Array, opts?: OpenOptions): Promise<OpenPackageResult>;
export { readEntrySource, MdeError } from '../vendor/mdpkg-web.js';
```

`openPackage` 是 async，且永不抛错。底层 `openMdpkg` 的「非 ZIP / 0 条目直接 throw `MdeError`」行为被收敛成确定性结果对象：成功返回完整 `OpenResult`，打开失败返回 `{ error: string }`。错误文案已中文化，不透出 `MDPKG-E###` 技术码（映射表见 `packages/app-kit/src/mdpkg.ts` 的 `translateVendorError`）。

`readEntrySource` 与 `MdeError` 直接来自 vendored bundle，未包装。`readEntrySource` 在入口缺失时抛 `MdeError`，调用方需自行 try/catch。

```ts
import { openPackage } from '@md-bundle/app-kit/mdpkg'

const result = await openPackage(bytes)
if ('error' in result) {
  // result.error 是中文提示，可直接展示
} else {
  // result.html / result.files / result.manifest / result.validation
}
```

### 2.2 `./export`

分两类：纯函数与需要 DOM 或注入的函数。

纯函数（无副作用，node 单测可直接跑）：

```ts
export function inlineImages(html: string, assets: Asset[]): string;
export function dataUrlToBytes(dataUrl: string): Uint8Array;
export function bytesToDataUrl(bytes: Uint8Array, mime: string): string;
export function resolveAssetDataUrl(assets: Asset[], path: string): string | null;
export function bylineHref(ref: string): string;
export function bylineFooterHtml(ref = 'md-html'): string;
export function bylineCornerBadgeHtml(ref = 'md-png'): string;
export function bylineCenteredBadgeHtml(ref = 'md-png'): string;
export function hasKatex(html: string): boolean;
```

`dataUrlToBytes` 对畸形输入确定性抛错（缺逗号、缺 `;base64` 标记、载荷含非法 base64 字符），绝不静默产出损坏字节。`resolveAssetDataUrl` 的匹配口径：剥 `./` 前缀，先精确匹配完整路径，再按 basename 匹配；绝对 URL（http/https/file）返回 `null`。

需要 DOM 或注入的：

```ts
export async function buildHtmlDocument(opts: BuildHtmlDocumentOptions): Promise<string>;
export async function exportPngFromMarkdown(opts: ExportPngOptions): Promise<Blob>;
export function exportMdpkg(opts: ExportMdpkgOptions): Uint8Array;
export async function exportDocx(opts: ExportDocxOptions): Promise<ExportDocxResult>;
```

`buildHtmlDocument` 是 async，因为 KaTeX 字体内联要 fetch。它复用 `@md-bundle/renderer` 的 `renderMarkdown`（唯一净化管线），图片引用按资产清单解析为 data URI，解析不了的 `<img>` 整段移除。

`exportPngFromMarkdown` 的三个 seam：

```ts
export interface ExportPngOptions extends BuildHtmlDocumentOptions {
  width?: number;
  scale?: number;
  measureHeight?: MeasureHeight;
  createCanvas?: (width: number, height: number) => HTMLCanvasElement;
  makeImage?: () => HTMLImageElement;
}
export type MeasureHeight = (html: string, width: number) => number;
```

node 单测必须注入这三个 seam（jsdom 无布局引擎，`scrollHeight` 恒 0；无 canvas / Image 实现）。浏览器走默认实现。空文档（全空白）确定性 reject `'文档为空，无法导出 PNG。'`。

`exportDocx` 的 `download` seam 与结果契约：

```ts
export interface ExportDocxOptions {
  markdown: string;
  title?: string;
  assets?: Asset[];
  download?: (blob: Blob, filename: string, createObjectUrl?: CreateObjectUrl) => void;
  filename?: string;
  onWarning?: (msg: string) => void;
}
export type ExportDocxResult = { ok: true } | { ok: false; error: string };
```

`exportDocx` 永不抛出，任何异常收敛为 `{ ok: false; error }`。默认 `download` 是 `downloadBlob`，测试注入 spy 断言字节与文件名。

`exportMdpkg` 是同步返回 `Uint8Array`，不是 Promise。`packMdpkg` 本身是同步的：

```ts
export interface ExportMdpkgOptions {
  markdown: string;
  assets: Asset[];
  prevManifest?: Manifest;
  extraFiles?: Map<string, Uint8Array>;
}
export function exportMdpkg(opts: ExportMdpkgOptions): Uint8Array;
```

ZIP 写入、manifest 重建、sha256、固定 mtime 全部由上游 `packMdpkg` 负责，本模块零 zip / hash 逻辑。`prevManifest` 透传用于「打开后重打包」时继承 entrypoint / extensions / source_url。

### 2.3 `./outline`

```ts
export function extractHeadings(markdown: string): OutlineHeading[];

export interface OutlineNavigatorSources {
  getView(): OutlineEditorView | null;
  getPreview(): HTMLElement | null;
}
export function createOutlineNavigator(sources: OutlineNavigatorSources): OutlineNavigator;

export interface OutlineMenuProps {
  mode: OutlineMode;
  documentText: string;
  editorView: OutlineEditorView | null;
  previewRef: React.RefObject<HTMLDivElement | null>;
  navigator?: OutlineNavigator;
}
export function OutlineMenu(props: OutlineMenuProps): JSX.Element;
```

`extractHeadings` 是纯函数，code-fence aware：提取 ATX 标题（`#` 到 `######`），跳过 ``` 代码块内的 `#` 行。

`createOutlineNavigator` 从一个「结构化编辑器视图 + 预览容器」组合出 `OutlineNavigator`。`OutlineEditorView` 是 CM6 视图的最小接口，不依赖 `@codemirror/view` 类型。

`OutlineMenu` 的 props 里 `navigator` 是可选的。提供时，编辑 / 源码模式的滚动交给它；`editorView` 仍然必须传入 —— 「当前高亮哪个标题」要用它的 viewport，预览滚动也要用 `previewRef`。不提供则整个组件沿用内置实现。

边界：注入实现只接管编辑 / 源码模式。预览态走组件内置的 DOM 元素路径，因为 `@md-bundle/renderer` 的净化白名单剥离 `id`，全仓没有标题锚点生成器，`scrollToHeading(id)` 对未自带锚点的消费方是 no-op（`id` 为空时直接返回，不抛错）。

### 2.4 `./clipboard`

```ts
export const browserClipboardWriter: ClipboardWriter;
export async function copyImageToClipboard(
  png: Blob,
  writer: ClipboardWriter = browserClipboardWriter,
): Promise<boolean>;
```

契约是永不抛错，成功返回 `true`，失败返回 `false`。调用方据此走兜底下载。`browserClipboardWriter` 是浏览器默认实现（`ClipboardItem` + `navigator.clipboard.write`），缺 API 或写入被拒时返回 `false`。`copyImageToClipboard` 在边界处再兜一层 try/catch，注入实现也不例外。

## 三、消费示例

### 3.1 网页端（现状）

摘自 `apps/web/src/App.tsx`。

大纲导航的 `useMemo`（第 198 到 205 行）：

```ts
const outlineNavigator: OutlineNavigator = useMemo(
  () =>
    createOutlineNavigator({
      getView: () => editorViewState,
      getPreview: () => previewRef.current,
    }),
  [editorViewState],
)
```

`copyImageToClipboard` 的失败兜底分支（第 956 到 974 行）：

```ts
const handleCopyBodyAsImage = async () => {
  if (!activeTab) return
  try {
    const blob = await exportPngFromMarkdown({
      markdown: activeTab.source,
      assets: activeTab.assets,
      theme: resolveEffectiveTheme(themePref),
    })
    const copied = await copyImageToClipboard(blob)
    if (copied) {
      showInviteCardStatus('正文已复制为图片')
    } else {
      downloadBlob(blob, `${docBase}.png`)
      showInviteCardStatus('正文图片已下载')
    }
  } catch (e) {
    showInviteCardStatus(e instanceof Error ? e.message : '正文复制为图片失败')
  }
}
```

### 3.2 Clairis / Electron

```ts
// 示意，未在本仓编译
import { copyImageToClipboard, type ClipboardWriter } from '@md-bundle/app-kit/clipboard'
import { createOutlineNavigator, type OutlineEditorView } from '@md-bundle/app-kit/outline'

// 主进程 clipboard.writeImage 包成 ClipboardWriter
const electronClipboardWriter: ClipboardWriter = async (png) => {
  const native = nativeImage.createFromBuffer(await blobToArrayBuffer(png))
  if (native.isEmpty()) return false
  clipboard.writeImage(native)
  return true
}

await copyImageToClipboard(blob, electronClipboardWriter)

// 编辑器实例包成 OutlineEditorView + createOutlineNavigator
const navigator = createOutlineNavigator({
  getView: () => clairisEditorView, // 结构满足 OutlineEditorView 即可
  getPreview: () => previewContainer,
})
```

文件写入用 `SaveFile` seam，不要复用浏览器的 `downloadBlob`：

```ts
// 示意，未在本仓编译
import type { FilePayload, SaveFile } from '@md-bundle/app-kit'

const saveFile: SaveFile = async ({ name, blob }: FilePayload) => {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  await fs.promises.writeFile(resolvePath(name), bytes)
}
```

## 四、为什么不能各抄一份

PNG 长图：`foreignObject` + `canvas.toBlob` + 高度测量三处 seam，两边各写一套就是两套各自的字体回退 / 截断 bug。`exportPng` 里那串 `toWellFormedXhtml` 的 void 元素与 bare attr 处理、表格 `table-layout: fixed` 的截断修复，都是踩出来的。

`.mdpkg`：字节一致性是格式要求。`packMdpkg` 的 sha256、固定 mtime、manifest 重建必须同一个实现，否则同一个包两边打出来不同字节。

剪贴板 / 大纲滚动：两端差异只在注入实现。把差异关进 seam，剩下的公共逻辑只有一份。

## 五、变更记录

| 票 | 落了哪块 |
|---|---|
| #507 | 骨架与契约（`contracts.ts` + `index.ts` 类型出口） |
| #508 | mdpkg（`openPackage` / `readEntrySource` / `MdeError`） |
| #509 | 导出（`export/*` 十一个模块） |
| #510 | 大纲（解析 + 浮层 + 滚动注入） |
| #511 | 剪贴板（`copyImageToClipboard` 可注入） |
| #512 | 网页端接线（`apps/web` 改为直接消费 app-kit） |
| #513 | 本文件 |
