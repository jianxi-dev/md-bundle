## Context

- 现状：docx 导出为 `apps/web/src/lib/exportDocx.ts`（592 行）——自研 `parseMarkdown`/`parseInline` 正则解析 + `docx` npm 库（`^9.7.1`）组装 OOXML，`buildDocxDocument` 内部导出仅供测试。UI 接线完整（Toolbar `export-docx`/`more-export-docx` testid + App.tsx `handleExport` case `'docx'` → `wire.onExportResult(format, true)` 喂徽章），6 个 Vitest 单测覆盖 blob 产出/文件名注入。但解析覆盖不全（无嵌套列表/任务列表/删除线），与 mdpkg 生态割裂（不消费 files Map、不走 symbols/include 管线）。
- 上游：`jianxi-dev/mdpkg` commit `59e15c8`（2026-09-05，v0.2.0.0）新增 `packages/mdpkg/src/docx.ts` 零依赖 OOXML 写入器：`toDocx(files: Map<string, Uint8Array>, opts?: DocxOptions, onWarning?: (msg) => void): Uint8Array`。remark-parse + remark-gfm 解析，原生组装 `[Content_Types].xml`/`document.xml`/`styles.xml`/`numbering.xml`/`word/media/*`，`packRaw`（fflate）打 ZIP。浏览器/Node 双端（仅 TextEncoder/TextDecoder）。上游 web 入口 `mdpkg-web.ts` 已导出 `toDocx` + `DocxOptions`（同时新增 `toZip`/`toMarkdown`）。
- 缺口：本仓库 vendored `apps/web/vendor/mdpkg-web.js` 早于 `59e15c8`，**不含** `toDocx`；`mdpkg-web.d.ts` 亦无 docx 声明。
- 生态约束（AGENTS.md）：vendored bundle 字节级一致、绝不手改；跨包只走包名；测试 `*.test.ts` = Vitest；错误确定性契约（不抛/不白屏）；新增依赖需论证。

## Goals / Non-Goals

**Goals:**
- 采用上游 `toDocx`：将 vendored 引擎更新至含 docx 导出的上游 commit，`exportDocx.ts` 重写为薄封装，获得 remark-gfm 保真（嵌套列表 8 层编号、GFM 任务列表、删除线、表格边框、图片嵌入 `word/media/`）与 symbols 展开。
- 移除 `docx` npm 依赖；docx 导出与其他导出（mdpkg）同源同一 files Map 组装直觉（`document.md` + 资产原始字节）。
- 公开面不破坏：`exportDocx(opts)` 签名（`markdown/title/assets/download/filename`）与 App.tsx 调用点保持一致；UI 文案、testid、徽章事件不变。
- 规格同步：spec 出口需求扩为五格式；hero 格式范围文案加入 Word；模拟/单测覆盖真实 docx 字节（ZIP magic、media 条目、空文档、frontmatter 剥离）。

**Non-Goals:**
- 不接线上游同日新增的 `toZip`/`toMarkdown` 导出（仅随 .d.ts 声明透出类型）。
- 不实现上游没有的能力：SVG 图片嵌入（降级 alt + warning 是本变更接受的行为）；复杂 HTML 保留（script/style 丢弃）。
- 不改 mdpkg manifest schema、不改 vendored 引擎逻辑、不引入新第三方依赖。
- 不做浏览器端懒加载优化（vendored bundle 仍顶层静态引入，体积增长记录在案即可）。

## Decisions

1. **重新 vendor 上游引擎（任务 1）**：从 `jianxi-dev/mdpkg` 检出 ≥ `59e15c8` 的 commit，构建其 web bundle（上游 `mdpkg-web.ts` 构建产物），**字节级替换** `apps/web/vendor/mdpkg-web.js`；锁定精确 commit 并记录来源（header 注释或 docs 备注）。选型？用上游构建产物而非本地手改：AGENTS.md 明确「NEVER edit vendor/mdpkg-web.js（byte-identical upstream bundle）」，本决定维持该不变量。若上游 web 构建方式不可得，回退方案：以包内 source 增量提取 `docx.ts` 相关代码并手工并入 vendored——不采用（破坏字节级一致性，风险高）。
2. **.d.ts 与上游对齐（任务 2）**：`mdpkg-web.d.ts` 补齐上游 web 入口新增导出：`toDocx(files, opts?, onWarning?)`、`DocxOptions`（`symbols?`、`imageWidthEmu?`、`imageHeightEmu?`），以及同日新增的 `toZip`/`toMarkdown` 类型（仅声明不接线，防未来需重新对齐）。头注释更新「镜像上游 commit <hash>」。
3. **exportDocx.ts 重写为薄封装（任务 3）**：保留 `ExportDocxOptions`/`exportDocx` 公开契约与 `DEFAULT_DOCX_FILENAME`；内部改为：
   - frontmatter 剥离（保留现有行为——上游 docx 路径依赖 include 管线才剥，薄封装显式剥，行为与现网一致）；
   - 复用 `exportMdpkg` 的 files Map 组装模式（`ENTRY_FILENAME='document.md'` + `dataUrlToBytes`），资产 `name` 为键——`lib/assets.ts` 约定图片引用 `![name](name.png)`，与 Map 键天然匹配；
   - `toDocx(files, { symbols: true })` → `Uint8Array` → `new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })` → 注入的 `download` 缝；
   - `onWarning` 参数透传（App.tsx 当前不传，保持可不传）。`buildDocxDocument` 内部导出随重写移除。
   - 调用点兼容：App.tsx `case 'docx'` 传参不变（`title` 字段保留于类型中供未来/兼容）。
4. **测试重写（任务 4）**：`exportDocx.test.ts` 不再依赖 `docx` 库对象，改为断言真实 ZIP/docx 字节：`PK\x03\x04` magic、`[Content_Types].xml`/`word/document.xml` 存在（用轻量 ZIP 条目探测而非解压整包）、含图片时 `word/media/` 条目存在、空文档产出合法非空 docx、`filename`/默认名注入、复杂 markdown（嵌套列表/表格/删除线）产出非空 blob。vendored bundle 在 node 环境需既有 `document.createElement` stub 模式（照抄 `mdpkg.test.ts`/`exportMdpkg.test.ts` 的 80 行 stub 惯例）。删除对 `Packer`/`buildDocxDocument` 的一切引用。
5. **依赖移除（任务 5）**：`apps/web/package.json` 删 `docx`（^9.7.1），`pnpm install` 更新 lockfile；`pnpm -r build/test/typecheck/lint` 全绿验证。确认无其他文件 import `docx`（grep 验证）。
6. **规格与文案（任务 6/7）**：spec 出口需求改五格式 + docx 场景（含 SVG 降级 warning、失败确定性）；hero 需求格式范围行「export md·HTML·PNG long-image」→「export md·Word·HTML·PNG long-image」；若 Landing.tsx 实际文案引用该行则同步改文案与对应 spec（explore 预计 Landing 文案含「导出 md·HTML·PNG」字样，实装时 grep 确认）。bug 台账 `docs/agents/defect-status-report.md` + `bug-registry-260907.md` 的 Bug#1「导出不支持 docx」更新为已实现（实装为已事实存在，本变更后状态同步）。

## Risks / Trade-offs

- [vendored bundle 体积增长]（toDocx + remark-gfm 入包）→ 接受；仅一次版本升级，未到拆分阈值；CI/构建成本不变。
- [上游行为差异：符号展开默认开启、字号/字体不同（Calibri/宋体 11pt vs 现 SimSun 自定义样式）] → spec 层面以「合法 OOXML + 结构保真」为准，不做样式级像素承诺；回归测试只断言结构与可打开性。
- [SVG 图片降级为 alt 文本]（上游 v1 限制）→ 与现状一致（现实现同样跳过 SVG），spec 显式场景化，UI 不报错仅 warning。
- [frontmatter 剥离职责]：上游 include 管线剥、toDocx 不剥 → 薄封装显式剥离，测试断言 frontmatter 不出现在 `document.xml`。
- [.d.ts 与上游漂移] → 头注释锁定上游 commit；本变更声明的类型在任务 4 测试中被实际调用验证。
- [App.tsx 改动面失控] → 任务 3/4 限定「App.tsx 调用点零改动或仅透传 onWarning」，任务 6 限定文案 grep 后最小改。

## Migration Plan

1. 先 vendor 升级 + .d.ts（任务 1/2）——纯增量，不影响运行；typecheck 全绿后继续。
2. 重写 exportDocx + 测试（任务 3/4）——同一 PR 内完成，旧实现删除与新测试落地不跨提交留缝；`pnpm --filter @md-bundle/web test` 必须全绿。
3. 依赖移除 + 全量验证（任务 5）：`pnpm install` 后再跑 `pnpm -r build` + `pnpm -r test` + `pnpm -r typecheck` + `pnpm -r lint`。
4. 规格/台账同步（任务 6/7）为文档尾项；回滚策略：vendor 升级可用 git revert 单独回退，exportDocx 重写与依赖移除同提交回退。
5. Playwright e2e（`pnpm --filter @md-bundle/web test:e2e`）冒烟导出菜单含 docx 项（现有 spec 选择器不变，新增「导出 Word」用例为可选加分项，非本变更强制）。

## Open Questions

- 上游 web bundle 的精确构建命令/产物路径（任务 1 实装时从上游仓库确认，锁定 commit 后按构建步骤执行）。
- Landing.tsx hero 文案是否逐字含「导出 md·HTML·PNG」字样（任务 6 grep 确认后最小同步；若文案是 else 处的等价表述则同步措辞）。
- `title` 字段当前实现是否被真正使用（若否，重写后可标记 deprecated 但保留，避免 App.tsx 改动）。