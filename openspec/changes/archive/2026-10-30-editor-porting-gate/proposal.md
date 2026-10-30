## Why

`@md-bundle/editor` 要移植进 Clairis（内核层移植、编排层重写），门槛清单 `docs/editor-next/porting-gate-clairis.md` 定下 4 条红线。当前 3 条不达标或状态不明：

- **红线 1（源码无损往返）没有任何证据**。现有测试只验证 `setValue → getValue` 原样往返（`packages/editor/test/editor.test.ts:41`、`public-api.test.ts:237`），没有任何用例验证「执行一次 WYSIWYG 操作后，源码只有该操作的预期变更」。装饰层坏了只是显示问题，源码写坏是数据事故。
- **红线 2（P0 清零）的现状表过期**。清单写于 2026-10-06，记「12+ 项 open」；子票 #356–#364 与 #376–#395 合并后，issue 侧已无 open 的 p0。但「已关闭」不等于「真修好」——`docs/agents/quality-gates.md` 记录的教训是 9 个 PR 里 8 个对应用层零改动、CI 仍全绿。
- **红线 3（p1 清零）**：#381 仍 open。三次 triage 都未能稳定复现用户描述的现象，用户把可复现部分并到 #396，但期望行为明确：输入即时反映到卡片、点击稳定进入编辑。

## What Changes

- **往返基线矩阵**：新增 e2e 套件，用真实按键与指针执行 11 类 WYSIWYG 操作，逐类 diff 源码，断言操作区等于期望片段、非操作区逐字节不变。矩阵即红线 1 的验收物，红项按缺陷流程修复。
- **P0 独立复核**：按清单三类重点（菜单栈、表格交互、图标与菜单结构）跑独立探针，把原始输出写入门槛清单的现状表，替换过期的「❌ 12+ open」。
- **callout 编辑链路**：编辑草稿立即反映到渲染态，widget 重建时不回落旧值；点击稳定进入编辑；据此关闭 #381 / #396。
- **门槛清单落盘**：清单入仓、修正悬空引用（`ui-gap-and-target.md` 实际在 `docs/doubao-editor-study/`）、现状表改为实测结论。

## Capabilities

### New Capabilities

- `editor-source-fidelity`：WYSIWYG 操作的源码无损往返契约（矩阵、断言分级、可复跑）。

### Modified Capabilities

- `editor-callout-editing`：编辑草稿即时反映到渲染态 + 点击稳定进入编辑。

## Impact

- 代码：`packages/editor/src/decorations/callout.ts`（草稿渲染与点击解析）、`packages/editor/test/`（单测）、`apps/web/test/`（e2e 矩阵）、`docs/editor-next/`（清单与现状）。
- 数据：无 schema 变化。往返矩阵若抓到源码损失，修复集中在装饰层的写回逻辑，不触碰 mdpkg 格式。
- 风险：callout 改动集中在单一装饰器；往返矩阵是新增测试，不影响运行时。`risk-medium`。

## 关联

- spec issue：#417
- 门槛清单：`docs/editor-next/porting-gate-clairis.md`
- 缺陷索引：`docs/doubao-editor-study/ui-gap-and-target.md` §7
