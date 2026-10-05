# 交接 — `editor-fidelity-2` 后续（剩余 5 票）

> 生成：2026-10-05 ｜ 仓库：`md-bundle` ｜ 分支：`main` ｜ 上一会话：执行 HANDOFF.md 的 31 项豆包保真修复
> 用法：新会话直接读本文，按 §3 的 DAG 从 frontier 起票续跑。

---

## 0. 一句话

change `editor-fidelity-2`（spec issue **#320**）已落地 **5/10 票**（`1.1` 基建、`2.1` 块手柄+图标、`2.2` 块菜单、`2.7` 命令面板、`2.9` 编辑基底），全部经 CI（build-test / e2e / evidence-check / vendor-drift）绿并合并。**剩余 5 票**：`2.3` 插入菜单、`2.4` 表格、`2.5` 色板、`2.6` 高亮块、`2.8` 交互编排。用 `change-workflow` G1 续跑即可。

---

## 1. 当前状态

- **已合并**（main）：`#365`(G0 规格+一致性制品)、`#367`(1.1)、`#368`(2.1)、`#366`(2.9)、`#369`(2.2)、`#370`(2.7)。open PR = 0。
- **已关闭票**：`#355 #356 #357 #362 #364`（标签已清 `ready-for-agent`，DQ-8 合规）。
- **剩余票（open, ready-for-agent, ui-surface）**：`#358 #359 #360 #361 #363`。
- **change 目录**：`openspec/changes/editor-fidelity-2/`（proposal / design / tasks.md / conformance.json / token-ledger.md / baseline/ / specs/）。
- `tasks.md` 已勾选 `1.1 2.1 2.2 2.7 2.9`（5/10）。

---

## 2. 依赖 DAG（剩余票）

| 票 | task | 依赖 | 现状 |
|---|---|---|---|
| **#358** | 2.3 插入菜单（F-02 分栏入口可用 / U-10 `/fN` / G-01 分类列表 / G-04 在下方添加›） | 2.1 ✅ | **可开工**（2.1/2.2 均已合并） |
| **#360** | 2.5 色板（U-06 统一 A 字体色+背景色 / G-02 数量色值） | 2.2 ✅ | **可开工** |
| **#361** | 2.6 高亮块（U-02 类型去重 / G-03 emoji 选择器） | 2.2 ✅ | **可开工** |
| **#363** | 2.8 交互编排（F-07 滚动消退 / U-03 视口夹取 / U-07 离栈即收） | 2.2 ✅ | **可开工** |
| **#359** | 2.4 表格（F-03 行列热点 / F-04 边界层不遮编辑 / G-09 格内手柄→插入菜单） | 2.2 ✅, 2.3 ⏳ | **待 #358 合并** |

> frontier = **#358 / #360 / #361 / #363**。四票文件不重叠，可并行；但**并行子代理会共用同一工作树**（本会话踩过：两票编辑混到一条分支）——并行时务必用 `git worktree` 或**串行**。**建议串行单票**更稳。

---

## 3. 每票验收锚点（机读，勿手填）

锚点集在 `openspec/changes/editor-fidelity-2/conformance.json`（38 需求 / 61 锚点，`cw-tickets-check.sh` C1-C8 + 锚点机检全绿）。逐票锚点前缀：

- `#358` → `R-INSERT-*`（`/f3` 命中、分类列表、三入口、无残留）
- `#359` → `R-TABLE-*`（hover 门控、边界不遮单元格中心、格内手柄）
- `#360` → `R-COLOR-*`（**字体色 A×8**：`#ebebeb #f0000e #f2962c #f0b622 #419e34 #20b2aa #4c88ff #8a5cf6`；背景色 16）
- `#361` → `R-CALLOUT-*`（类型 label 唯一）
- `#363` → `R-CHOREO-*`（离栈收、视口夹取、滚动消退）

---

## 4. 本会话实测的陷阱与教训（务必先读，避免重蹈）

1. **子代理模型不稳**：`nemotron` 常 503、`longcat` 会退化循环（零产出）。单票常需 **2-3 轮**（原文 + 修复）。失败**复用同一 `task_id`** 续跑，别新起。
2. **必须跑全量 e2e**：子代理常只跑本票 spec，漏掉共享面回归。本会话 #357 就因此漏了 4 个 spec（30s 超时）与 1 个共享命令回归。
3. **改共享文件前先 grep 全仓引用**：`packages/editor/src/commands.ts` 的 turn-into 命令集被**选区浮条**复用；#357 误改它破坏了选区浮条 → 已 revert。凡改 `commands.ts` / `block-handle-ops.ts` / `icons.ts` 须全量 e2e。
4. **标签改名同步所有 spec**：`getByRole('button',{name:'X'})` 用**子串**匹配——`复制` 会误命中 `复制链接`，需 `exact:true`。改名后 grep `apps/web/test/*.spec.ts` 同步。
5. **图标改名**：改 `data-icon` 名必须同步 `icons.ts` `ICON_REGISTRY`（否则属性对、**字形回退**到 DragHandleOutlined → 测试绿但视觉错），并更新 `packages/editor/test/block-handle.test.ts` 期望。
6. **证据 schema**：交互票必须用 `./scripts/cw-evidence.sh record-state .artifacts/<票号> --state <s> --screenshot <f> --assertion passed` 产**标准 schema**（`state/screenshot/assertion`），≥4 态。别自造 `{name,status}`（CI 不校验字段，但违反规范）。
7. **表格块级检测**：Lezer 解析器**无 GFM Table 扩展** → `block-model` 永不产出 `table` 块；2.1 用行级 regex（`isTableLine`）兜底图标。#359 应**根治**（启用 GFM Table 扩展，或统一 regex SSOT），否则表格多能力受限。
8. **`.gitignore` 已白名单** `.artifacts/**/state-coverage.json`（IC-2）；截图不入库。
9. **新出现 `scripts/cw-conformance.sh`**（`anchors.md` → `conformance.json` 的 scaffold/generate/lock/verify）——新 CW 能力；可考虑把现有 `conformance.json` 迁移为 `anchors.md` 源 + `lock`（baseline 哈希）以启用 `verify`。
10. **不要改 `apps/web/vendor/mdpkg-web.js`**；不引入新依赖（`pnpm-lock` 变更需谨慎，CI 有 vendor-drift 检查）。

---

## 5. 复跑 / 门禁命令

```bash
pnpm --filter @md-bundle/web dev          # dev server :4173（e2e 依赖）
pnpm -r typecheck && pnpm -r lint && pnpm -r test
pnpm --filter @md-bundle/web test:e2e      # 全量（~10min；务必跑，勿只跑本票）
./scripts/cw-tickets-check.sh --change editor-fidelity-2        # 拆票/锚点机检
./scripts/cw-evidence.sh record-state <dir> --state <s> --screenshot <f> --assertion passed
./scripts/decisions-log.sh add <阶段> <决策> <理由> <证据> <结果>
```

单票流程：`git checkout -b feat/editor-fidelity-2-<task>-<slug> origin/main` → 实施（`implement`/`tdd`）→ 全量 e2e → `code-review` → 证据 → `pr-automation.sh --resume-branch`（或手建 PR，`fixes #N` + `ui-surface` + `risk-medium` 标签）→ CI 绿 → **人工合并**（risk-medium 门）。

---

## 6. 建议 skills（新会话调用）

- **`change-workflow`**：G0-G4 gate 总编排（续跑走 G1；收尾走 G4）。
- **`openspec-apply-change` / `implement` / `tdd`**：按 change tasks 实施。
- **`code-review` / `review`**：G1 出口双轴审查。
- **`playwright`**（或 `/browser-skill`）：QG-5 视觉探针 / 多态截图。
- **`evidence-capture`（规范，非 skill）**：证据分层 + 多态矩阵。
- 单票委派：`task(category="unspecified-high", ...)`；模型抖动时复用 `task_id` 续跑。

---

## 7. 引用（勿重复，直接读）

| 内容 | 路径 / URL |
|---|---|
| change 规格（人读） | `openspec/changes/editor-fidelity-2/{proposal,design,tasks}.md` |
| 一致性制品（机读） | `openspec/changes/editor-fidelity-2/conformance.json` + `baseline/manifest.json` |
| token 台账 | `openspec/changes/editor-fidelity-2/token-ledger.md` |
| 需求输入包（L-1） | `docs/requirements/editor-fidelity-2/input-package.md` |
| 差距基准（31 项索引） | `docs/doubao-editor-study/ui-gap-and-target.md` |
| 缺陷目录（含验收判据） | `docs/agents/cw-fidelity-verified-defects.md` |
| 豆包功能规格 | `docs/doubao-editor-study/functional-spec.md` |
| 交互原型（token/几何来源） | `.lavish/doubao-editor-spec-v2.html` |
| 原始交接 | `docs/doubao-editor-study/HANDOFF.md` |
| 质量门禁 | `docs/agents/quality-gates.md` + `docs/agents/evidence-capture.md` |
| 决策日志（本地） | `.artifacts/decisions.tsv` |

---

## 8. G4 收口提醒（5 票全合并后）

- 全部 task `[x]` + 关联 PR 全合并 → `openspec-archive-change` 归档 `editor-fidelity-2`；
- `conformance.lock` 校验 baseline 哈希；六态黑盒巡检；
- 关闭 spec issue **#320**（`gh issue close 320 --comment "change 已收口"`）；
- 剩余队列盘点（`gh issue list --state open`）。
