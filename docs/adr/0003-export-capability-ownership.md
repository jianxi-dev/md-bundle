# ADR-0003: 导出能力归属准则（上游引擎 vs 本地薄层）

> 状态：**已接受**（2026-09-13，export-deliverables-alignment change）。
> 决策者：jianxi-dev 产品组。

## 背景

md-bundle 导出菜单六项（.md / .mdpkg / docx / html / png / zip），早期 zip 与 md 为自研（zip = mdpkg 字节改扩展名，md = 编辑器源码逐字节下载）。随着上游 mdpkg 引擎（v0.2.0.0+）提供 `toZip`、`toMarkdown`、`toDocx` 等标准转换 API，且其 README 明确定位"导出为引擎职责"，消费侧自研与上游实现并存的状态已不可持续。

docx 迁移先例（change `mdpkg-docx-export-capability`，2026-09-13 归档）证明了该模型：自研 592 行 → 本地薄封装 86 行，产物与 CLI 字节一致。为避免未来每新增一种格式就重新争论一次"该自研还是接上游"，本 ADR 固化归属判定准则与能力清单。

## 决定

**归属判定准则**：

> CLI 与 Web（及未来任何宿主）应当产出相同字节 / 结构的格式转换 → 上游 mdpkg 引擎；依赖本产品渲染管线、主题、品牌或交互的交付物 → 本地薄层。

简言之：跨工具字节一致的格式转换归上游；渲染、品牌、交互归本地。

**能力归属清单**：

| 归属 | 能力 | 说明 |
|------|------|------|
| 上游 | md、mdpkg、html、zip、docx | 格式转换，CLI / Web 字节一致 |
| 本地渲染 | HTML 导出、PNG 长图、分享卡 | `@md-bundle/renderer` + 主题 + byline 品牌（ADR-0002 红线） |
| 本地交互 / IO | 保存路由（FSA 三路径）、下载触发、菜单 UI、警告文案 | 产品交互层 |
| 上游明确不做 | PDF | 浏览器打印兜底（上游 README + 集成文档） |

**语义模型**：

- **保存**（save）= 存取工作文档（.md / .mdpkg 草稿，持句柄回写或下载）。
- **导出**（export）= 生成可交付物（格式转换产物，与工作文档分离）。

该语义切割反映在界面命名上：保存按钮不变；导出入口与菜单项统一为「导出交付物」+「产物名 (格式)」句式（见 design.md D4）。

## 理由

自研格式转换的代价高：需独立维护 CLI / Web 双端字节一致性、include 展开、frontmatter 处理、资产打包等逻辑，且任何上游修复（如 docx 的 03e7a64）不会自动惠及本地副本。上游引擎以单一实现覆盖所有宿主，消费侧仅保留 files Map 组装与下载触发等薄层，认知与维护成本最低。

HTML 导出、PNG 长图、分享卡依赖本地渲染管线（`@md-bundle/renderer`）、主题 token、byline 品牌注入，这些是产品差异化的核心，不应也不会由上游引擎承担。

PDF 上游明确不做（浏览器打印兜底），本地不引入 PDF 渲染库，保持与上游路线图一致。

## 被否选项

| 选项 | 否决理由 |
|------|----------|
| 继续自研 zip / md，仅接上游 docx | 双轨并存：同一职责两套实现，上游修复无法自动同步，字节一致性需人工维护 |
| 所有格式全部本地渲染（含 docx / zip） | 放弃上游已验证的跨宿主一致性，重复劳动；与 docx 先例方向相反 |
| 上游接管 HTML / PNG / 分享卡 | 上游引擎定位为格式转换，不含渲染 / 主题 / 品牌；强加会污染上游职责边界 |

## 后果

- 新增导出格式时，先按判定准则归类：跨工具字节一致 → 接上游；依赖渲染 / 品牌 / 交互 → 本地薄层。
- 上游引擎升级时，优先核对 toZip / toMarkdown / toDocx 等导出 API 变更，本地薄层通常无需修改。
- 本地导出代码（`exportMdpkg.ts`、`exportDocx.ts` 等）保持同构：files Map 组装 → 引擎调用 → Blob → 下载。
- PDF 需求以浏览器打印满足，不引入额外渲染依赖。

## 关联

- ADR-0001：格式与产品命名（v1 基线）
- ADR-0002：编辑范式与渲染管线重构（共享渲染器红线）
- 上游集成文档：`packages/mdpkg/docs/md-bundle-integration.md`
- 先例 change：`mdpkg-docx-export-capability`（2026-09-13 归档）
- OpenSpec：`openspec/changes/export-deliverables-alignment/`
