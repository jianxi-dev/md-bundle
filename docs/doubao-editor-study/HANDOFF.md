# 交接说明 · 豆包编辑态保真度后续任务

> 用途：**在新对话中粘贴本文（或指向本文件）**，让下一个 agent 无缝接手。
> 生成时间：2026-10-04 ｜ 仓库：`md-bundle` ｜ 分支：`main` @ `f5682b6`

---

## 0. 一句话交接

上一个 change `editor-fidelity`（16/16）已合并归档，但用户实测发现与豆包原型有 **31 项不符**。本次任务＝用 `change-workflow` 启动新 change，把这 31 项按「面」分批实施 + 独立验证。

---

## 1. 背景与根因（务必先理解）

- `editor-fidelity` 票全绿、CI 全绿、已归档，但用户打开即见约 31 处与豆包原型不符。
- 根因（已复盘，勿重蹈）：
  1. **原型规格从未被翻译成可证伪断言**（token/图标表/几何/hover 门禁都没进测试）；
  2. **测试以「实现自身行为」为断言**，把偏差写成预期（tautology）；弱断言/恒真分支/注释豁免掩盖 flake；
  3. **截图对照门禁「有定义、无机检、靠自证」**——`quality-gates.md` QG-5 与 `evidence-capture.md` 多态截图矩阵**早已生效强制**，但本 change 仅 #324 产出 `state-coverage.json`，#327–#336 全部零截图。

---

## 2. 先读（按序，必读）

| # | 文件 | 作用 |
|---|---|---|
| 1 | `docs/doubao-editor-study/ui-gap-and-target.md` | **本仓差距基准**：豆包设计 token + 功能规格 → 差在哪 / 改成什么样；**§7 为 31 项总索引** |
| 2 | `docs/agents/cw-fidelity-verified-defects.md` | **CW 移交**（只有问题+修复方案；CW 只做工作流门禁，不开发） |
| 3 | `docs/doubao-editor-study/functional-spec.md` | 豆包功能规格（原型基线，§2/§3/§4/§7 含 token·图标表·编排） |
| 4 | `.lavish/doubao-editor-spec-v2.html` | 交互原型（v3 补录；`getComputedStyle` token 来源） |
| 5 | `docs/agents/quality-gates.md` + `docs/agents/evidence-capture.md` | 质量门禁（QG/DQ，务必执行） |
| 6 | `.lavish/defect-review.html` | **可视化评审面**（31 项，可批注） |

---

## 3. 目标

用 `change-workflow`（G0–G4 五 gate）启动**一个新 change**，把 31 项按「面」分批实施 + 独立验证（QG-5 原始证据 + 多态截图 + 多模态复核）。

---

## 4. 硬要求

- **全程中文**。
- 严格走 `change-workflow`；**1 task = 1 ticket，1 issue = 1 PR**；合并后本地停在 `main`。
- **QG-1**：用户层 AC 必须引用原型 token/图标表/几何（像素位置、尺寸、`data-icon` 名称、hover 门禁），**禁止「元素存在」式 AC**。
- **QG-5**：每张交互票必须产出 `.artifacts/<票号>/state-coverage.json` + **≥4 张多态截图** + **多模态复核结论**（本次教训：截图门禁靠自证而失守）。
- 浮层/插入/渲染类票**不得**用 `no-ui-impact` 豁免生命周期与保真 AC。
- **先输出【拆票方案 + 依赖顺序 + 每票验收判据】给用户确认，确认后再开工。**

---

## 5. 环境

- dev server：`http://localhost:4173`（未起则 `pnpm --filter @md-bundle/web dev`）
- 浏览器复核：优先 `/browser-skill`（`bsk`，需扩展显示 connected）；备选 Playwright(CDP) 直连 dev server。
   - 注意：`chrome-devtools-axi` 桥接存在 `pageId undefined` 缺陷（snapshot/eval 不可用）。
- **先提交**两份未跟踪文档（见 §7）作为本 change 的输入基线。

---

## 6. 第一步

读完 §2 文档后，先**复述你理解的「31 项 → 分组票」方案**（含每票验收判据与依赖边），等用户确认，再进入 G0。

---

## 7. 当前工作区状态（交接时）

- 分支 `main`，HEAD `f5682b6`（editor-fidelity 归档提交）。
- **未跟踪（需先提交）**：
  - `docs/doubao-editor-study/ui-gap-and-target.md`
  - `docs/agents/cw-fidelity-verified-defects.md`
- `.lavish/*`（评审面与截图证据）走 gitignore，不入库。

---

## 8. 可选：仅交 CW（不开发）

若本次只想**加固工作流门禁**、不开发：加一句——
> 「本体只做工作流门禁加固，不开发；问题 + 方案见 `docs/agents/cw-fidelity-verified-defects.md`（§4 门禁加固建议）。」

---

## 9. 31 项速览（详见 §2-1 的 §7 索引）

| 面 | 编号 |
|---|---|
| 块手柄 | F-01, F-05, F-06, G-13 |
| 块菜单 | F-08, F-09, G-05, G-06, G-07, G-08, G-12, U-04, U-09 |
| 插入菜单 | F-02, G-01, G-04, U-10 |
| 表格 | F-03, F-04, G-09 |
| 色板 | U-06, G-02 |
| 高亮块 | U-02, G-03 |
| 命令面板 | U-08, G-10 |
| 交互编排 | F-07, U-03, U-07 |
| 编辑基底 | U-01 |
| 设计 token / 全局 | U-05 |
| CW 门禁 | C-01 |
| 正向确认（非缺陷） | 格内手柄 / 表格选区 / 行内装饰 / 分栏 / 网格图标 |
