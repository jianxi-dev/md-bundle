## Context

md-bundle 当前导出菜单六项（.md/.mdpkg/docx/html/png/zip），其中 docx 已走上游 `toDocx`（先例：change `mdpkg-docx-export-capability`，2026-09-13 归档），但 `.zip` 与 `.md` 仍是自研：`.zip` = mdpkg 字节改扩展名（与 `.mdpkg` 同字节），`.md` = 编辑器源码逐字节下载。上游 mdpkg 引擎（v0.2.0.0）已提供 `toZip`（标准 zip 交付物：include 展开、无 manifest、附 README）与 `toMarkdown`（include 展开的单文件文本），且 README 明确定位导出为引擎职责。本地 vendored `mdpkg-web.js`（v0.3.0.0, bbc1f1c）已声明这两个 API，接线无需重 vendor。

## Goals / Non-Goals

**Goals:**
- `.zip` 导出产物 = 上游 `toZip` 标准交付物（与 docx 同源：files Map → 引擎 → Blob → 下载）。
- `.md` 导出产物 = 上游 `toMarkdown` 展开单文件（保留含图丢图警告）。
- ADR-0003 固化归属准则 + 能力归属清单（含 PDF/PNG 明确归本地/浏览器打印）。
- 界面语义：导出入口 →「导出交付物」，菜单项 →「产物名 (格式)」句式；保存按钮不变。
- spec 同步：`md-bundle-web` 导出需求六格式 + zip/md 行为对齐上游语义。

**Non-Goals:**
- 重 vendor 上游引擎（当前版本已够用，可选后续独立 change）。
- HTML / PNG / 分享卡导出改造（保留本地渲染管线，ADR-0002 红线）。
- PDF 导出（上游明确不做，浏览器打印兜底）。
- 拖拽缺陷修复（独立缺陷流程，issue #105）。
- 保存按钮能力态逻辑变更（FSA 三路径不变）。

## Decisions

### D1. zip/md 路径统一为「files Map 组装 → 上游引擎 → Blob → 下载」

与 docx 先例完全同构：`exportDocx.ts` 已示范「剥离 frontmatter → 组装 files Map（`document.md` + 资产原始字节 + extraFiles）→ 调引擎 → Uint8Array → Blob → `download` 缝」。zip/md 复用同一模式，仅替换引擎调用与 MIME/文件名。

**Alternatives considered:**
- 保留自研 + 加参数：拒绝。与 docx 先例不一致，且上游已保证 CLI/Web 双端字节一致（上游集成文档明确要求消费侧复用）。
- 新增独立 `exportZip.ts`/`exportMd.ts` 薄封装（而非改 `App.tsx` 内联）：与 `exportDocx.ts`/`exportMdpkg.ts` 同构，降低认知成本。**Chosen**：zip 改动量小（替换 `App.tsx` case 'zip' 的一行 `exportMdpkg` 调用 → `toZip`），md 替换 `exportMd` 调用 → `toMarkdown`；不新增文件，保持与既有 `handleExport` switch 结构一致。

### D2. `.md` 语义升级为「展开单文件」而非「逐字节源码」

上游 `toMarkdown(files, opts)` = include 展开 + 符号保持源文本不转换。对无 include 文档，产出 ≈ 源码文本（可能因 include 管线有微小差异，如 frontmatter 处理）；对含 include 的包，产出展开后的可分发单文件。含图丢图警告保留（toMarkdown 不携带图片）。

**Alternatives considered:**
- 保留逐字节源码 + 新增「展开单文件」为第七项：拒绝。菜单膨胀，且「.md」用户预期就是「给我一份 md」，展开单文件更符合交付语义。
- 拆为「Markdown 源码 (.md)」+「Markdown 单文件 (.md expanded)」两项：拒绝。过度拆分，单一项覆盖即可（无 include 时二者等价）。

### D3. ADR-0003 归属准则

判定测试：「CLI 与 Web（及未来任何宿主）应当产出相同字节/结构的格式转换 → 上游引擎；依赖本产品渲染管线、主题、品牌或交互的交付物 → 本地薄层」。

能力归属清单：
- 上游：md/mdpkg/html/zip/docx（格式转换，跨工具一致）。
- 本地渲染：HTML 导出（`@md-bundle/renderer` + 主题 + byline 品牌，ADR-0002 红线）、PNG 长图、分享卡。
- 上游明确不做：PDF（浏览器打印兜底，README + 集成文档）。
- 本地交互/IO：保存路由（FSA 三路径）、下载触发、菜单 UI、警告文案。

### D4. 界面命名

导出入口（tooltip/aria/移动端分组标头）→「导出交付物」；菜单项统一「产物名 (格式)」句式。理由：「交付物」与上游对 `toZip` 的官方描述（「标准 zip 交付物」）同词；菜单项读起来是「一份可交出去的东西」而非「另一种存法」，与保存按钮（「保存」/「下载」= 存取工作文档）心智切开。

**Alternatives considered:**
- 「导出副本」：更口语，但"副本"对 docx/html/png 这类格式转换不准确（是转换不是复制）。
- 仅改菜单项、入口保留「导出」：入口 tooltip 不变则心智切割不够彻底。**Chosen**：入口 + 菜单项同步改。

## Risks / Trade-offs

- [zip 产物变更] → 旧断言（zip 字节 == mdpkg 字节）需替换为真实 zip 标准（PK magic、含 README、无 manifest）。Mitigation：实施阶段重写 `export*.test.ts` zip 断言，e2e 文案断言同步更新。
- [md 产物变更] → 含 include 文档的 `.md` 导出从「源码」变为「展开版」。Mitigation：spec 明确行为；无 include 文档等价源码，降级可接受。
- [vendored 引擎版本] → bbc1f1c 后上游有 docx 修复（03e7a64 等），但 toZip/toMarkdown 未受影响。Mitigation：实施前核对；若有 toZip/toMarkdown 修复再决定是否重 vendor（可选后续）。
- [spec validate --strict] → 本 change 有 spec delta（md-bundle-web 导出需求），满足「至少一个 delta」条件。Mitigation：G4 正常 strict 通过。

## Migration Plan

1. 代码：`App.tsx` `handleExport` case 'md'→`toMarkdown`、case 'zip'→`toZip`；`Toolbar.tsx` 导出菜单项文案 + 入口 tooltip/aria。
2. 测试：替换 zip/md 断言；e2e 导出菜单文案断言更新。
3. 文档：ADR-0003；spec.md + spec.zh.md 同步（六格式 + zip/md 行为）。
4. 无运行时迁移（导出是纯下载动作，无持久化状态）。
5. 回滚：`git revert` 单 PR 即可（1 issue = 1 PR）。

## Open Questions

- 无。所有决策已由用户在讨论中确认（接线上游 toZip、接 toMarkdown、落 ADR、命名「导出交付物」）。
