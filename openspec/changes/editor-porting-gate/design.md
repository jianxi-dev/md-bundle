# Design — editor-porting-gate

## 背景

三条红线各自的失败模式不同，设计必须对症：

- 红线 1 缺的是**证据形态**。过去「自测全绿」反复被独立探针推翻，原因是用例断言了实现自身的行为（presence / 元素存在），而不是**源码字节**。
- 红线 2 缺的是**独立复核**。票都关了，但关闭理由是修复者自己跑的测试；QG-5 要求验证者跑自己的探针。
- 红线 3 缺的是**渲染源**。callout 编辑期有草稿，渲染态却只读解析值，两者在 widget 重建时短暂分叉。

## 决策

### D1 往返矩阵：真实输入驱动 + 源码整体 diff

矩阵每条用例的结构固定：

1. 打开页面，载入一份**覆盖全部块类型的基线文档**（内容固定，作为矩阵夹具）；
2. 用真实按键 / 指针执行一次操作（点击手柄 → 菜单项、`/` 菜单、格子内输入等）；
3. 读取 `EditorView.state.doc.toString()`；
4. 断言两级：
   - **操作区**：等于期望片段（逐字符）；
   - **非操作区**：与基线逐字节相同（`prev.replace(opRange, ...) === next` 的行级等价）。

拒绝的替代方案：只断言「块变成 H2」（presence）。它无法发现余下源码被改写。

矩阵覆盖 11 类操作：块转换、列表/待办、引用、代码块、callout、表格单元格、表格插行列、分栏、行内格式、文字颜色、图片/链接/分割线。

### D2 P0 复核：复用既有目标 spec 当探针

不新建 `verify-*` 静态文档（高频迭代仓里必然腐烂，且与 e2e 平行漂移）。做法：

- 菜单栈 → `submenu-stack-387.spec.ts` + `issue-390-shortcuts-slidein.spec.ts`
- 表格 → `table-hotspot-gating-385.spec.ts` + `table-hotspot-fidelity2.spec.ts`
- 图标与菜单结构 → `block-handle-icon.spec.ts` + `block-menu-fidelity2.spec.ts`

验证者本人跑一遍，原始输出（通过清单 + 用例数）写入门槛清单现状表与票面。发现回归 → 按 DQ 建 `[bug]` 票，不在本 change 内顺手改设计。

### D3 callout：draft-first 渲染

现状：`CalloutWidget.toDOM` 用解析值 `this.content` 渲染；草稿存在 per-view `dirtyCallouts` 里，只在 flush 后进入文档。widget 被重建（任何 view update 都可能）时，草稿仍在 map 里，卡片却回落到旧解析值——这就是「移开显示旧态」。

改为 **draft-first**：`toDOM` 渲染前先查草稿，有草稿用草稿值渲染。点击解析同时修正：

- 现有实现按 ordinal 取 `querySelectorAll('.cm-callout')[index]`，重建后索引可能错位；
- 改为在 mousedown 时记录目标卡片的稳定标识（块起始 offset），下一帧按 offset 反查卡片，命中不到就不开。

### D4 chore 先行

工作区有 13 个未提交改动（工具链 1.12.3 → 1.13.0 升级、证据 json、`test_runtime_smoke.py`）。`pr-automation.sh` 的 `--resume-branch` 要求所有工作区改动都在 `--files` 白名单内，否则拒收。先单独提一个 chore PR 把它们落盘，后续票的 PR 才干净。

`.pi-glla/*`（agent 会话状态）每次会话都变，改为忽略并从索引移除，否则每张票的 PR 都会被它卡住。

## 风险与取舍

| 风险 | 处置 |
|---|---|
| 矩阵夹具本身写错，导致假绿 | 夹具与期望片段同时进仓库，断言两级（操作区 + 非操作区）互相约束 |
| callout 改动引入新的写回竞态 | 单测覆盖 draft-first 渲染 + e2e 覆盖输入即时可见（`callout-edit.spec.ts` 扩展） |
| 复核只跑既有 spec，覆盖不到已关闭票的新回归 | 三类共 6 个 spec，均为上一轮修复新增的回归用例；清单里写明所用命令，可复跑 |
| 往返矩阵首次运行可能大面积红 | 红项本身就是交付物（红线 1 的证据），按 DQ-3 先红后绿修复 |

## 验收

- `pnpm -r test`：editor 949 + web 416 全绿（红线 4）。
- `playwright test test/roundtrip-source-fidelity.spec.ts`：11 条全绿。
- 门槛清单现状表：红线 1–4 逐条标绿并附证据指针。
