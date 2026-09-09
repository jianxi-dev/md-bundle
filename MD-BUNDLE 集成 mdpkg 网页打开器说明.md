# MD-BUNDLE 集成 mdpkg 网页打开器 · 说明

> 本文档是 mdpkg 网页打开器（`web/` 浏览器端管线）集成到 **md-bundle** 网页工具时的交接说明。
> 面向后续真正开始写 md-bundle 前端代码时的开发者。
>
> 来源仓库：`jianxi-dev/mdpkg`（`packages/mdpkg/`）。本文档生成时测试全绿（81 CLI + 7 web = 88）。

---

## 1. 这是什么

`mdpkg` 的浏览器端打开器，把一条在 Node/CLI 里「解包 → 校验 → include 展开 → 渲染（消毒）→ 内联」的完整管线**全部搬进浏览器**，零 Node 依赖（fflate + unified 生态均为纯 JS）。

打开一个 `.mdpkg` 后，你得到：

- 一份**完整自包含的 HTML 文档**（图片已 data URI 内联，可直接塞进 `<iframe>`）
- 一份**校验报告**（格式合法性、sha256、引用闭包、外部引用计数）
- 包内**条目清单**（路径 + 字节数）

### 管线（与 CLI 一致，规范 §8.1）

```
解包 → 校验 → include 展开 → 解析 → 符号转换 → 渲染（消毒）→ 内联
```

也就是说：**浏览器里的结果和 CLI `mdpkg render` 输出一致**。这是「网页预览」与「本地渲染」保持同构的前提。

---

## 2. 三个产物文件（在 `jianxi-dev/mdpkg` 的 `packages/mdpkg/web/`）

| 文件 | 格式 | 大小 | 全局符号 | 用途 |
|------|------|------|----------|------|
| `mdpkg-web.ts` | 源码 | — | — | 直接引用（若你的打包器支持 TS） |
| `mdpkg-web.js` | ESM | 717 KB | 无（`import`） | `<script type="module">` 或 import 引入 |
| `mdpkg-web.iife.js` | IIFE | 761 KB | `window.MdpkgWeb` | `<script src>` 直接全局引入 |

> 已有 `mdpkg-web.iife.js` 压缩验证：约 761 KB → 压缩后约 325 KB（实测数字见 §5.2）。
> 当前 `web/` 里**尚未落盘压缩产物**，只有未压缩的 `mdpkg-web.js` / `mdpkg-web.iife.js`。

---

## 3. 集成方式（两种，任选其一）

### 方式 A：`<script>` 全局引入（最快）

```html
<script src="./mdpkg-web.iife.js"></script>
<script>
  // 读取 .mdpkg 文件内容（Uint8Array）
  const bytes = new Uint8Array(await file.arrayBuffer());
  const r = await MdpkgWeb.openMdpkg(bytes);   // r 是 Promise<OpenResult>
  if (r.error) {
    // 渲染阶段错误（如入口文件损坏）——见 §4
  }
  // 预览：把 r.html 塞进 iframe
  iframe.srcdoc = r.html;
  // 校验报告：r.validation（见 §4）
</script>
```

### 方式 B：ESM 引入（配合你的构建工具）

```js
// 把 `mdpkg-web.js` 放进你的仓库，然后
import { openMdpkg } from './mdpkg-web.js';

const buf = new Uint8Array(await file.arrayBuffer());
const r = await openMdpkg(buf);
```

> 官方演示页 `demo.html` 用的是**方式 A**（IIFE + `window.MdpkgWeb`）。
> 若你的打包器把依赖也打进包，建议直接引 `mdpkg-web.ts` 源码，让构建工具统一处理。

---

## 4. API 签名

### `openMdpkg(bytes: Uint8Array, opts?: OpenOptions): Promise<OpenResult>`

```ts
interface OpenOptions {
  /** 符号扩展开关。默认 true（跟随 manifest.extensions.symbols）。传 false 可关闭 */
  symbols?: boolean;
}

interface OpenResult {
  /** 包内全部文件（路径 → 字节）。可用它做条目清单、预览源码等 */
  files: Map<string, Uint8Array>;
  /** 解析出的 manifest（若存在）。null 表示 manifest 缺失或 JSON 解析失败 */
  manifest: Manifest | null;
  /** 校验结果 */
  validation: ValidationResult;
  /** 完整自包含 HTML 文档（含 <!doctype> 与内联样式）。渲染阶段失败时为 null */
  html: string | null;
  /** 是否发生降级。浏览器端无文件系统，仅作提示用，不代表真的降级 */
  degraded: boolean;
  /** 渲染阶段错误（校验错误不在这里，在 validation.errors）。成功时为 null */
  error: string | null;
}
```

### 行为边界（重要）

- **非 ZIP 包 / 0 条目** → 直接 `throw MdeError`（不是返回 `error` 字段）。调用方要 `try/catch`。
- **manifest 缺失或损坏** → 不抛错，`manifest: null`，仍按默认入口 `document.md` 渲染。
- **校验失败** → 不阻断渲染；校验问题在 `validation.errors` / `validation.warnings`，`html` 照常生成。由你把校验报告呈现给用户。
- **渲染失败**（如入口文件损坏）→ `html: null`，错误在 `error` 字段。

### `ValidationResult` 关键字段（来自 `validatePackage`）

```ts
{
  ok: boolean;            // errors.length === 0
  errors: string[];       // 硬错误（格式不合法、sha256 不匹配、引用外环等）
  warnings: string[];     // 软警告
  externalCount: number;  // 外部引用（http/https 链接）条数
}
```

### 其他导出

```ts
import { openMdpkg, packMdpkg, readEntrySource, toBase64, expand, buildManifest, MdeError } from './mdpkg-web.js';
import type { Manifest, ValidationResult } from './mdpkg-web.js';

/** 读取入口 Markdown 原文（include 未展开）。预览源码用。 */
readEntrySource(files, entry?: string): string
```

### 写侧（编辑后重打包）

`packMdpkg(files: Map<string, Uint8Array>, prevManifest?: Manifest): Uint8Array` —— 传入编辑后的 files（可含旧 manifest.json，函数会删除并重建），返回新的 `.mdpkg` 字节流。与 CLI `mdpkg pack` 共用同一 ZIP 逻辑（条目排序、压缩策略、固定 mtime），产出字节与 CLI 一致。校验/重算哈希均内部完成，调用方不要手动改 manifest.json。

---

## 5. 注意事项（读过再集成）

### 5.1 符号（symlink）与包中重复文件

> 「符号」在本文指 `(tm) → ™`、`--> → →` 这类**符号扩展**，与操作系统 symlink 无关。

- include 引用会**去重**：同一路径被多次 include 只保留一份，避免重复渲染。
- 符号扩展只作用于**纯文本**，渲染时应用，**不改写源文件**。

### 5.2 体积与压缩

- 未压缩约 **717 KB（ESM）**。
- `--minify` 实测可压到约 **318 KB**，体积降约 55%。
- 但当前 web/ 目录**没有落盘压缩产物**，集成前如需压缩，可考虑：
  - 在 mdpkg 侧补一个 `esbuild --minify` 的产出脚本（未实现，见 §7）；
  - 或直接用源码（`mdpkg-web.ts`）交给自己的打包器处理。

### 5.3 IIFE vs ESM 如何选

| 场景 | 选 |
|------|-----|
| 纯静态页、不想碰构建 | IIFE（`window.MdpkgWeb`） |
| 有 Vite/Webpack/Rollup | ESM / 直接引源码 |
| 多包共享、按需加载 | ESM + 分包 |

> 若 md-bundle 最终定位是「零构建的静态营销页」，IIFE 最省事；若已有构建链，直接上源码让工具链处理体积。

### 5.4 `degraded` 标志在浏览器端是**提示性**的

CLI `render` 在资源超 50 MB 时会自动降级为 `--dir`（输出文件夹）。浏览器端**没有文件系统**，降级逻辑不真实存在，`degraded` 仅作为信号保留；收到 `degraded === true` 时不要指望有 `--dir` 路径，按提示给出文案即可。

### 5.5 manifest / 校验的**安全性边界**

- 包内 `manifest.json` 与资源在同一包中 → **不做防篡改**（校验保证**完整性/一致性**：检测损坏、误传、跨平台字节漂移；不保证**恶意篡改**）。v1 无签名。
- 渲染对 HTML 做了**消毒**，但集成时应**始终用 `sandbox` 属性**隔离 iframe（官方 demo 用 `sandbox="allow-same-origin"`），并不要把文件内容拼到你自己的页面 DOM 里执行脚本。
- `<<<` include 展开做了**循环检测**（规范 §8.2），恶意包不会无限展开。

### 5.6 依赖体积来源（`ajv` + `unified` 生态）

体积大头是 `ajv`（schema 校验）和 `unified`（markdown 解析）。如果 717 KB / 318 KB 对你仍是负担，可调研方向（§7 有提，未实施）：

- 运行时才加载 schema 校验，而不是常驻；
- 用更轻的 markdown 解析器替换 `remark/unified`；
- 前提：**保持与 CLI 输出一致**，否则「浏览器预览 = 本地渲染」的承诺会破。

---

## 6. 集成最小清单（checklist）

- [ ] 把 `mdpkg-web.iife.js`（或 `.js`）拷进 md-bundle（或走构建链引源码）
- [ ] 用 `openMdpkg(new Uint8Array(await file.arrayBuffer()))` 打开包
- [ ] 用 `r.html` + `iframe.srcdoc` 做预览；iframe 加 `sandbox`
- [ ] 用 `r.validation`（`ok/errors/warnings/externalCount`）呈现校验报告
- [ ] 用 `r.files` 渲染条目清单（路径 + 大小）
- [ ] `try/catch` 包住 `openMdpkg`（非 ZIP 会 throw）
- [ ] 处理 `r.error`（渲染失败）与 `r.validation.errors`（校验失败）两条不同错误路径
- [ ] 关闭符号：`openMdpkg(bytes, { symbols: false })`

---

## 7. 待办（mdpkg 侧，供 md-bundle 集成时对齐）

以下在 mdpkg 侧**尚未实现**：

| 项 | 说明 |
|----|------|
| 压缩产物落盘 | 补一个 `esbuild --minify` 产出 `mdpkg-web.min.js(+iife)` 的脚本，让 `web/` 直接可引用压缩版 |
| 体积再压 | 探索 `ajv` / `unified` 的瘦身（运行时加载、换轻量解析器），**前提是保持与 CLI 输出一致** |
| `demo.html` 可视化验收 | demo 页逻辑已齐，但**尚无浏览器视觉回归**，首次 wear 前建议人工过一遍拖拽 → 校验 → 预览 |

> 若这些待办已推动，集成方式会随之微调（主要是引用压缩产物 + 体积说明更新），§2/§5.2 需同步刷新。

---

## 8. 相关文件速查

```
jianxi-dev/mdpkg/packages/mdpkg/
├── web/
│   ├── mdpkg-web.ts          # 浏览器 API 源码（openMdpkg / OpenResult）
│   ├── mdpkg-web.js          # ESM bundle ~717 KB
│   ├── mdpkg-web.iife.js     # IIFE bundle ~761 KB，window.MdpkgWeb
│   └── demo.html             # 官方演示（拖拽 + 校验面板 + iframe 预览，走 IIFE）
├── web.test.ts               # 浏览器管线测试（7 个，管线一致性/错误/include 展开）
├── src/
│   ├── zip-core.ts           # unpack / toBase64
│   ├── manifest.ts           # validatePackage / buildManifest / Manifest / ValidationResult
│   ├── render.ts             # render / wrapDocument（消毒 + 内联）
│   ├── include.ts            # expand
│   └── errors.ts             # MdeError / E
```

<!-- 生成契约：本文档的 API 签名、行为边界、产物清单均以 mdpkg 仓库 packages/mdpkg/web/ 当前代码为准。若 mdpkg 侧 API 变动，请同步本说明。 -->