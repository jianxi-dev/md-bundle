# 需求输入包 — `editor-fidelity`

> **change**：`editor-fidelity`
> **spec issue**：[#320](https://github.com/jianxi-dev/md-bundle/issues/320)（需求定义面 + 对账锚点 + Parent）
> **建立日期**：2026-10-03
> **L-1 契约门**：本文 = 进入拆票前的**需求输入包**，须满足五条契约（来源可追溯 / 空白显式化 / 一手证据 / 冲突显式 / 验收锚点）。任一违反 → 补齐后重验，不得进入拆票。
> **唯一来源**：`docs/editor-next/optimization-source.md`（用户 2026-10-03 认可）。

---

## 一、四要素映射（What / Why / Scope / Non-goals）

| 要素 | 内容 | 引用 |
|---|---|---|
| **What**（做什么） | 把编辑态升级为「**预览态渲染 + 活动块源码**」（编辑=预览），并据此系统性修正手柄/块菜单/插入与快捷输入/选区工具栏/表格/高亮块/分栏/任务/视频文件/流程图/图标/快捷键显示的保真度；重设计命令面板；收口 D1–D10。 | spec issue [#320](https://github.com/jianxi-dev/md-bundle/issues/320)；`optimization-source.md` §2.1、§3、§7 |
| **Why**（为何） | 上一轮功能已"接上"但体验系统劣化：控件需点击、表格坍缩源码、callout 标题重复、菜单不关、取消残留、插入表格是玩具占位；根因 = 编辑态与预览态**两套渲染/样式分叉** + 验收停在"元素存在"。 | `#320` Problem Statement；`cw-fidelity-lifecycle-gates-proposal.md` §D1–D10；`retro-editor-v2-quality.md` |
| **Scope**（范围） | 编辑态交互与视觉保真 + 命令面板重设计 + 缺陷收口 + 以本轮作为 QG-1..QG-8 的验收靶场。工作项见 `optimization-source.md` §7（W0–W13）。 | `optimization-source.md` §7、§6.5 |
| **Non-goals**（不做） | 分享/协作/同步块/多维表格族/团队协作块/进阶小组件/AI 类；三模式、多页签、FSA、主题三态、邀请链接本轮不动。 | `optimization-source.md` §2.2；`#320` Out of Scope |

**边界校验（QG-7）**：本 change 每条 task 若能在**不修改 `apps/web`** 的前提下被满足 → 切错，退回重切。全部 task 以"打开页面…之后…"为用户可观测锚点。

---

## 二、L-1 五契约

### 契约 1 — 来源可追溯（每个规格条目可指回一手材料）

| 规格条目（节） | 关键论断 | 来源指针 |
|---|---|---|
| §3.1 块手柄 | 悬停块行淡入手柄；悬停手柄**自动展开块菜单**；命中桥接 | 截图 `r01` / `s13b` / `crop-handle`；`r08` |
| §3.2 块菜单 | 转为图标网格；`缩进和对齐 ›`、`颜色 ›` 二级；上下文分型 | 截图 `02-block-menu`、`03-menu-align`、`04-menu-color`；`data-name` |
| §3.3 插入/快捷输入 | `/` 与 `、` 触发；分类列表；表格/分栏 `›` flyout；二次过滤含二级项 | 截图 `r05`、`13-slash`、`r06-table-flyout`、`r07-col-flyout` |
| §3.4 选区工具栏 | 合并单元格、单元格背景色、字体色=彩色「A」 | 截图 `10b`、`12-cell-bg`、`04-menu-color` |
| §3.5 表格 | 格内手柄→**插入菜单**（非块菜单）；锚点在格间线；不坍缩源码 | 截图 `s13b`、`s15`、`u04-crop`、`r04c`、`06-table-menu`；教训 T-1 |
| §3.6 高亮块 | 标头不重复；类型/颜色/emoji 二级；卡片内联编辑不坍缩 | `22b`；上轮 `editor-callout-editing` |
| §3.7 分栏 | 每栏块手柄；`.dragger` 可拖拽改宽 | 截图 `u01-grid`；DOM `.dragger` / `.dragger-hot-spots` |
| §3.9 视频/流程图 | 文件卡片/播放器；mermaid 编辑预览+渲染出图，不坍缩 | 上轮 4.6；renderer mermaid 白名单 |
| §3.10 图标 | 统一 `<svg data-icon>`；块型/动作→图标映射 | 78 个真实图标已提取（`/tmp/icons-all.json` 会话产物） |
| §3.11 快捷键/命令面板 | 菜单显示键位（图标项除外）；面板单列+键位右对齐 | `command-palette.ts` / `-dom.ts` 源码审计 |
| §3.12 编辑=预览 ★ | 渲染/样式 SSOT + 活动块源码桥 + 增量渲染 | 用户反馈；`decorations/*.ts` 与 `renderer` 分叉审计 |
| §5 缺陷 D1–D10 | 逐条缺陷 | `cw-fidelity-lifecycle-gates-proposal.md` |

### 契约 2 — 空白显式化（未观察项标 `open-question` 并**阻断**引用它的规格）

| open-question | 阻断的规格条目 | 处置 |
|---|---|---|
| 中文全角「／」是否也触发插入菜单 | §3.3 触发键 | 实现前须结论，或该票标 `open-question` 阻断 |
| 二级项在筛选态如何与一级项混排 | §3.3 二次过滤 | 同上 |
| 任务行尾工具的具体形态 | §3.8 任务 | 同上 |

> 其余未观察项已在 `optimization-source.md` §3 内逐条标 `open-question`；**禁止想当然补**（QG-8 / 教训 T-2）。

### 契约 3 — 一手证据（不是二手转述）

| 证据 | 位置 |
|---|---|
| 豆包实证规格（含截图） | `docs/doubao-editor-study/functional-spec.md` |
| 截图目录（一手实拍） | `.lavish/assets/doubao/`（`r01–r08`、`s01–s15`、`u01–u04`） |
| 可交互原型 | `.lavish/doubao-editor-spec-v2.html` |
| 74+ 真实图标提取 | 会话产物 `/tmp/icons-all.json`（78 个 `<svg data-icon>`） |
| 现状源码审计 | `packages/editor/src/decorations/{table,callout,code}.ts`、`block-handle*.ts`、`slash.ts`、`smart-input.ts`、`command-palette*.ts`、`floating-toolbar.ts` |
| 缺陷与根因 | `docs/agents/cw-fidelity-lifecycle-gates-proposal.md` |

### 契约 4 — 冲突显式（与本轮变更相悖的既有事实，必须写明）

| # | 冲突 | 处置 |
|---|---|---|
| C-1 | 上一轮 `editor-doubao-parity` 任务 4.3 把命令面板改为**网格**（已完成归档），本轮 §3.11 要求**单列** → **显式反转** | 新票以单列为准；在票面注明"反转上轮 4.3 的网格形态" |
| C-2 | 上一轮 8.2 已实现"快捷键在命令面板与菜单项显示" | 本轮**验证 + 收敛**（补"仅图标项除外"）+ 面板重设计，不重复实现 |
| C-3 | 上一轮 2.x/4.x/5.x/6.x/7.x 已实现手柄/斜杠/表格/callout/分栏 | 本轮是**保真修复**（§3 逐面规格）而非从零构建；票面须区分"已存在待修"与"待增" |
| C-4 | 规格要求 `.md` 打开进**编辑**，实现落在**预览**（D1） | 随本轮修复；票面 AC 断言落点为编辑态 |
| C-5 | `optimization-source.md` 附录 A 写"QG-1..7"，实际门禁为 **QG-1..QG-8** | 以 `quality-gates.md`（QG-1..8）为准；文档笔误，不阻断 |
| C-6 | `optimization-source.md` §0 称工作流侧缺陷"已完成优化"，但 `quality-gates.md` 头部仍为 2026-09-20 | 以正文内容为准（含 QG-7/QG-8 已落地）；本轮即其验收靶场 |

### 契约 5 — 验收锚点（可判真伪）

| 锚点 | 判据 |
|---|---|
| 三分类 AC（QG-1） | 每张用户可见票 AC 含 **存在 / 生命周期 / 保真** 三行，格式见 `quality-gates.md` §四 |
| 断言阶梯（QG-4） | 渲染/装饰/插入/浮层类 ≥ **文本相等**；可取消/可关闭类 ≥ **状态往返** |
| 视觉探针（QG-5） | 关键态多态截图（状态覆盖矩阵 ≥4 态）+ 复核记录，落 `.artifacts/<票号>/` |
| e2e 绑定（QG-2） | 用户可见变更必须新增/扩展 `apps/web/test/*.spec.ts` |
| 反样本（§6.5） | 须在 G1 出口拦下 **D2 标题重复 / D3 围栏反引号 / D4 菜单不关 / D5 空态驻留 / D6 取消残留 / D7 表格坍缩**；漏到用户侧 = 门禁未闭环 |

---

## 三、门禁自检结论

| 契约 | 结论 | 依据 |
|---|---|---|
| 1 来源可追溯 | ✅ | §二·契约 1 每条规格 → 截图 / DOM / 源码指针 |
| 2 空白显式化 | ✅ | §二·契约 2 三处 `open-question` 且标注阻断范围 |
| 3 一手证据 | ✅ | §二·契约 3 截图 + 原型 + DOM 提取 + 源码审计 |
| 4 冲突显式 | ✅ | §二·契约 4 六条冲突（C-1 显式反转、C-3 已存在待修） |
| 5 验收锚点 | ✅ | §二·契约 5 三分类 + 断言阶梯 + 视觉探针 + 反样本 |

**结论**：五契约齐备 → 允许进入阶段二 `openspec-propose` 与 G0-POST 拆票。
