# 需求输入包 — `editor-fidelity-2`

> **change**：`editor-fidelity-2`
> **spec issue**：[#320](https://github.com/jianxi-dev/md-bundle/issues/320)（需求定义面 + Parent；本 change 承接其未完成的保真 User Stories）
> **建立日期**：2026-10-04
> **L-1 契约门**：本文 = 进入拆票前的**需求输入包**，须满足五条契约（来源可追溯 / 空白显式化 / 一手证据 / 冲突显式 / 验收锚点）。任一违反 → 补齐后重验，不得进入拆票。
> **唯一来源**：`docs/doubao-editor-study/ui-gap-and-target.md`（差距基准）+ `docs/agents/cw-fidelity-verified-defects.md`（实测缺陷目录）。

---

## 一、四要素映射（What / Why / Scope / Non-goals）

| 要素 | 内容 | 引用 |
|---|---|---|
| **What**（做什么） | 把上一轮 `editor-fidelity` 交付后用户实测发现的 **31 项编辑态保真偏差**按「面」补齐：图标系统、块手柄、块菜单、插入菜单、表格、色板、高亮块、命令面板、交互编排、编辑基底。以原型 token / 图标表 / 几何 / hover 门控为可证伪判据。 | `ui-gap-and-target.md` §7（31 项索引）、§6（第二轮巡检）；`cw-fidelity-verified-defects.md` §1 |
| **Why**（为何） | `editor-fidelity` 16/16 勾选、CI 全绿、已归档，但用户打开即见约 31 处与豆包原型不符。根因：**规格从未被翻译成可证伪断言**；**测试以「实现自身行为」为断言**（把偏差写成预期）；**截图对照门禁「有定义、无机检、靠自证」**。 | `HANDOFF.md` §1；`cw-fidelity-verified-defects.md` §2；`quality-gates.md` §一 |
| **Scope**（范围） | 31 项（F-01..U-10、G-01..G-13，剔除不成立的 G-11）按「面」分批实施 + 独立验证。含新增**原型一致性测试层**（token / 图标 / 几何 / hover 门控断言）与 **conformance.json 一致性制品**。 | `ui-gap-and-target.md` §7；`cw-fidelity-verified-defects.md` §4、§5 |
| **Non-goals**（不做） | 分享/协作/同步块/多维表格族/团队协作块/进阶小组件/AI 类（承接 `optimization-source.md` §2.2）；三模式工作区、多页签、FSA、主题三态、邀请链接不动。**C-01（CW 门禁）由 CW 工具包侧维护，本 change 不开发**——但需在流程中**验证新门禁可机检**。 | `optimization-source.md` §2.2；`ui-gap-and-target.md` §5 |

**边界校验（QG-7）**：本 change 每条 task 若能在**不修改 `apps/web`** 的前提下被满足 → 切错，退回重切。全部 task 以"打开页面…之后…"为用户可观测锚点。

---

## 二、L-1 五契约

### 契约 1 — 来源可追溯（每个规格条目可指回一手材料）

| 面 | 项 | 一手来源指针 |
|---|---|---|
| 块手柄 | F-01 / F-05 / F-06 / G-13 | 原型 `.hnd`（L69–73，42×26 药丸）；`ui-gap-and-target.md` §2.2、§6.2 |
| 块菜单 | F-08 / F-09 / G-05 / G-06 / G-07 / G-08 / G-12 / U-04 / U-09 | 原型 `.menu`/`.mi`（L76–79，236px / 32px）；`functional-spec.md` §4.3、§4.6、§7.1 |
| 插入菜单 | F-02 / G-01 / G-04 / U-10 | `functional-spec.md` §5.1–§5.4；`ui-gap-and-target.md` §2.4、§6.G-01 |
| 表格 | F-03 / F-04 / G-09 | `functional-spec.md` §7.2–§7.4；`ui-gap-and-target.md` §2.5、§6.G-09 |
| 色板 | U-06 / G-02 | 原型 `fontColors`/`bgColors`（L456–457、L460）；`functional-spec.md` §4.5 |
| 高亮块 | U-02 / G-03 | `ui-gap-and-target.md` §2.7、§6.G-03；`functional-spec.md` §8.1 |
| 命令面板 | U-08 / G-10 | `functional-spec.md` §2（菜单行高 32px / 字 12px）；`ui-gap-and-target.md` §2.10 |
| 交互编排 | F-07 / U-03 / U-07 | `functional-spec.md` §P0；`ui-gap-and-target.md` §2.11、§6.2 |
| 编辑基底 | U-01 | `ui-gap-and-target.md` §2.1；`cw-fidelity-verified-defects.md` U-01 |
| 图标词汇 | F-01（横切） | 原型 `data-icon` 集合（DataSheetOutlined / DocColumnsOutlined / CalloutOutlined / DisorderListOutlined …）；`functional-spec.md` §3.2 |

### 契约 2 — 空白显式化（未观察项标 `open-question` 并**阻断**引用它的规格）

| open-question | 阻断的规格条目 | 处置 |
|---|---|---|
| 字体色 A 色板**格数**：原型 8 格（L456 8 项）vs 文档「默认+8」= 9 | 色板 U-06/G-02 的「字体色 A×N」 | 以原型机读值为准（**8**），文档「默认+8」记为冲突 C-2；若用户另有裁决再改 |
| 块菜单动作项 `上移/下移` 是否改为拖拽（G-12） | 块菜单 G-12 | 本案**保留上移/下移**（现实现已有），仅补豆包动作项集；改拖拽列为后续 open-question，不阻断本 change |
| 「分栏入口」三入口是否**含格内手柄**为第三入口 | 插入菜单 F-02/G-04 | 本案三入口 = 空行「+」/ 块菜单「在下方添加›」/ `/`；格内手柄入口归表格票 G-09 |

### 契约 3 — 一手证据（不是二手转述）

| 证据 | 位置 |
|---|---|
| 豆包功能规格（含截图索引） | `docs/doubao-editor-study/functional-spec.md` |
| 可交互原型（token / 几何来源） | `.lavish/doubao-editor-spec-v2.html`（`:root` L8–18；`.hnd` L69；`.menu` L76；色板 L456–460） |
| 本仓差距基准（31 项索引） | `docs/doubao-editor-study/ui-gap-and-target.md` §7 |
| 实测缺陷目录（含验收判据） | `docs/agents/cw-fidelity-verified-defects.md` §1 |
| 现状源码 | `packages/editor/src/{block-handle,block-handle-dom,icons,slash,command-palette-dom,empty-line-entry}.ts`、`decorations/{table,callout,columns}.ts` |
| 二手可视化评审面 | `.lavish/defect-review.html`、`.lavish/verify-vs-prototype.html`（辅证，非一手） |

### 契约 4 — 冲突显式（与既有事实相悖的项，必须写明）

| # | 冲突 | 处置 |
|---|---|---|
| C-1 | G-11（`类型›` 出现在非高亮块）**经复核不成立**（该项 `display:none` 正确） | **剔除**，不拆票；作为回归基线 |
| C-2 | 字体色 A 格数：原型 8 vs 文档「默认+8」= 9 | 以原型**8**为准（机读制品优先），记为冲突；见契约 2 |
| C-3 | 六项「正向确认」非缺陷（格内手柄→插入菜单、表格多格选区、行内装饰、分栏渲染/栏沟、网格图标） | **不拆缺陷票**；列为**回归基线**，改动后不得回归 |
| C-4 | 上一轮 `editor-fidelity` 已把斜杠菜单做成「图标网格 + 二级 flyout」；豆包为**分类列表** | 本 change 显式**反转形态为分类列表**（G-01）；票面注明"反转 editor-fidelity 网格形态" |
| C-5 | 块菜单**宽 144 / 项高 28**（现实现）vs 236 / 32（原型） | 票面按 236 / 32 重设；旧值仅作 before 证据 |
| C-6 | 原型 HTML 属 `.lavish/`（gitignored，不入库） | conformance baseline 截图**入库**于 `openspec/changes/editor-fidelity-2/baseline/`，附来源 URL + 时间戳 |

### 契约 5 — 验收锚点（可判真伪）

| 锚点 | 判据 |
|---|---|
| 双形态规格 | 人读层 = proposal/design/AC；机读层 = `openspec/changes/editor-fidelity-2/conformance.json`（每 requirement ≥1 anchor，含具体期望值 + 来源 + 断言类型） |
| 三分类 AC（QG-1） | 每张用户可见票 AC 含 **存在 / 生命周期 / 保真**，格式见 `quality-gates.md` §四 |
| 断言阶梯（QG-4） | 渲染/装饰/插入/浮层类 ≥ **文本相等**；可取消/可关闭类 ≥ **状态往返** |
| 视觉探针（QG-5） | 交互票多态截图（状态覆盖矩阵 **≥4 态**）+ 多模态复核结论；落 `.artifacts/<票号>/state-coverage.json`（入库） |
| e2e 绑定（QG-2） | 用户可见变更必须新增/扩展 `apps/web/test/*.spec.ts` |
| T1/T2/T3（CI） | ui-surface 票触发 `evidence-check.yml`：T1 确定量 vs conformance / T2 感知 vs baseline / T3 状态机 |

---

## 三、门禁自检结论

| 契约 | 结论 | 依据 |
|---|---|---|
| 1 来源可追溯 | ✅ | §二·契约 1 每面 → 原型行号 / 规格节 / 源码指针 |
| 2 空白显式化 | ✅ | §二·契约 2 三处 open-question 且标注阻断范围 |
| 3 一手证据 | ✅ | §二·契约 3 原型 + 规格 + 源码审计 |
| 4 冲突显式 | ✅ | §二·契约 4 六条冲突（C-1 剔除、C-4 形态反转、C-5 旧值） |
| 5 验收锚点 | ✅ | §二·契约 5 双形态 + 三分类 + 断言阶梯 + 视觉探针 + T1/T2/T3 |

**结论**：五契约齐备 → 允许进入阶段二 `openspec-propose` 与 G0-POST 拆票。

---

## 四、新 CW 门禁的验证靶场（本 change 的额外目的）

本 change 即新 CW 1.10.0「机制化门禁」的验收靶场。须验证：

1. **双形态规格 + 锚点门（M0）**：`conformance.json` 通过 `cw-tickets-check.sh` 的锚点机检（完备/无孤儿/可断言/来源非空）。
2. **一致性制品 + baseline 哈希锁（M0'）**：baseline 从原型程序化生成、哈希锁定。
3. **机检截图证据（IC-2）**：`pr-automation.sh` 对 ui-surface 票硬校验 `state-coverage.json`（≥4 态），缺失退 1。
4. **CI 三层核验（IC-4/IC-5）**：`evidence-check.yml` 触发 ui-surface 票的 T1/T2/T3。
5. **发现闭环（QG-8）**：本轮新发现即时转 issue / 规格条目。
