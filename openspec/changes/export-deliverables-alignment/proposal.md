## Why

md-bundle 的 `.zip` 与 `.md` 导出目前是自研实现，与上游 mdpkg 引擎（v0.2.0.0 起已纳入职责）的 `toZip`/`toMarkdown` 能力割裂——`.zip` 实为 mdpkg 字节改扩展名，`.md` 实为源码逐字节副本，均非引擎定义的标准交付物。同时「保存」与「导出」在用户心智里混淆。docx 先例（change `mdpkg-docx-export-capability`，2026-09-13 归档）已验证「格式转换归上游、本地留薄封装」模式可行，本 change 复用同一模式覆盖 zip/md，并固化归属准则到 ADR-0003。

## What Changes

- `.zip` 导出改走上游 `toZip`：标准 zip 交付物（include 展开、无 manifest.json、附 README.md）。**BREAKING**：产物不再是 mdpkg 字节改扩展名。
- `.md` 导出改走上游 `toMarkdown`：include 展开后的单文件文本（无 include 文档等价于源码文本）。保留含图丢图警告。
- 新增 ADR-0003「导出能力归属」（`docs/adr/0003-export-capability-ownership.md`）：固化「跨工具一致的格式转换 → 上游引擎；渲染/品牌/交互 → 本地」判定准则 + 能力归属清单。
- 界面语义统一：导出入口 tooltip/aria/分组标头 →「导出交付物」；菜单项 →「产物名 (格式)」句式（Markdown 单文件 (.md) / 自包含包 (.mdpkg) / Word 文档 (.docx) / 网页 (.html) / 长图 (.png) / 压缩包 (.zip)）。保存按钮文案不变。
- spec 同步：`md-bundle-web` 导出需求从「五格式」更新为「六格式」（含 .zip），zip/md 行为描述对齐上游语义。

## Capabilities

### New Capabilities

- `export-capability-ownership`: ADR-0003 导出的能力归属准则（跨工具格式转换 vs 本地渲染/品牌/交互的判定测试）。

### Modified Capabilities

- `md-bundle-web`: 导出需求行为变更——`.zip` 走 `toZip` 标准交付物、`.md` 走 `toMarkdown` 展开单文件；菜单项文案更新；spec 格式清单五→六。

## Impact

- 代码：`apps/web/src/lib/export*.ts`（zip/md 路径改调上游）、`apps/web/src/App.tsx`（`handleExport` case 'md'/'zip'）、`apps/web/src/components/Toolbar.tsx`（导出菜单项文案 + saveLabel 语义澄清）。
- 测试：`apps/web/test/export*.test.ts`（zip/md 断言替换为真实字节校验）、e2e 导出菜单文案断言更新。
- 文档：`docs/adr/0003-export-capability-ownership.md`（新增）。
- 依赖：无新增；本地 vendored `mdpkg-web.js`（v0.3.0.0）已声明 `toZip`/`toMarkdown`。
- 上游：无变更（复用既有引擎能力）。
