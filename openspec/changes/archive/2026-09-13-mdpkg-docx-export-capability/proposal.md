## Why

上游 `jianxi-dev/mdpkg` 于 commit `59e15c8`（2026-09-05，v0.2.0.0）新增了零依赖的 OOXML 导出器 `toDocx(files, opts?, onWarning?)`（remark-gfm 解析 + 原生 OOXML 组装，嵌套列表/任务列表/删除线/图片嵌入齐全）。本项目的 docx 导出目前是 `apps/web/src/lib/exportDocx.ts`（592 行）：自研正则解析器 + `docx` npm 库，CommonMark 覆盖不全（无嵌套列表/任务列表/删除线），且与 mdpkg 生态割裂（不消费 files Map、不走 symbols/include 管线）。当前 vendored `mdpkg-web.js` 早于该 commit，未包含 `toDocx`。本变更采用上游能力并替换本地实现，统一导出管线、提升 docx 保真度、移除 `docx` 依赖。

## What Changes

- **重新 vendor 上游引擎**：将 `apps/web/vendor/mdpkg-web.js` 更新至包含 `toDocx` 的上游 commit（≥ `59e15c8`，实装时锁定精确 commit 并记录），字节级一致、不手改。
- **更新类型声明**：`apps/web/vendor/mdpkg-web.d.ts` 补齐上游 web 入口新增导出（`toDocx`、`DocxOptions` 等），镜像上游源码。
- **重写 `apps/web/src/lib/exportDocx.ts`**：移除自研解析器与 `docx` 库，改为上游 `toDocx` 的薄封装 —— 沿用 `exportMdpkg` 的 files Map 组装模式（`document.md` + 资产原始字节），调用 `toDocx` 得 `Uint8Array` → Blob → `download`。保留 `exportDocx(opts)` 公开签名（`markdown/title/assets/download/filename`），App.tsx 调用点不变。
- **测试重写**：`apps/web/test/exportDocx.test.ts` 改为验证经由上游 `toDocx` 产出的真实 docx 字节（ZIP PK magic、media 条目、空文档、文件名注入、frontmatter 剥离、复杂 markdown 结构）；沿用 vendored bundle 在 node 环境的 `document.createElement` stub 模式。
- **移除依赖**：删 `apps/web/package.json` 中 `docx`（^9.7.1），更新 lockfile。
- **规格同步**：export 需求从「四种格式」扩为「五种格式」（新增 Word `.docx`），含失败路径确定性语义（不抛异常/不白屏）与 hero 格式范围文案同步。

## Capabilities

### New Capabilities
<!-- 本变更不引入新能力域；docx 导出归属既有 md-bundle-web 能力。 -->

### Modified Capabilities
- `md-bundle-web`: 「格式驱动的 Markdown 源码导出」需求行为变更 —— 五格式（`.md`/`.mdpkg`/Word `.docx`/HTML/PNG 长图），docx 经由上游 `toDocx` 引擎导出、图片以 OOXML media 嵌入、空文档产出合法非空 docx、失败走确定性错误结果（不崩不白屏）；「首页 hero 与格式范围」需求中的格式范围行文案同步加入 Word。

## Impact

- **代码**：`apps/web/vendor/mdpkg-web.js`（字节级替换，上游构建产物）、`apps/web/vendor/mdpkg-web.d.ts`（新增 `toDocx`/`DocxOptions` 声明）；`apps/web/src/lib/exportDocx.ts`（重写为薄封装，`buildDocxDocument` 内部导出随移除）；`apps/web/src/App.tsx`（调用点不变）；`apps/web/test/exportDocx.test.ts`（重写）。
- **依赖**：移除 `apps/web` 的 `docx` npm 依赖；上游引擎自带 OOXML 组装（`fflate` 打包），无新增第三方依赖。
- **行为收益**：获得 remark-gfm 解析（嵌套列表 8 层编号、GFM 任务列表、删除线、表格边框、图片嵌入 `word/media/`）；symbols 展开默认开启（对齐上游 CLI）；SVG 图片降级为 alt 文本 + warning（上游 v1 限制，与现状一致）。
- **已知取舍**：上游 docx 路径不剥离 YAML frontmatter（依赖 include 管线）→ 薄封装保留现有 frontmatter 剥离；上游 web 入口同时导出 `toZip`/`toMarkdown`，本变更仅采用 `toDocx`，其余随 .d.ts 声明但不接线。
- **文档**：bug 台账（`docs/agents/defect-status-report.md` 130-134 行、`docs/agents/bug-registry-260907.md` Bug #1 "导出不支持 docx"）为过期状态，实装后同步为已实现；`packages/docs/md-bundle-integration.md`（已记录上游 `toDocx` API）无需改动。