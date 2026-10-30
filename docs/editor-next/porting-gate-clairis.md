# md-bundle → Clairis 编辑器移植门槛（Go/No-Go 清单）

> **用途**：定义 `@md-bundle/editor` 移植进 Clairis（桌面旗舰仓库 `lqtdys/clairis`）前，本仓必须达到的功能质量红线。达到即触发 Clairis 侧移植 proposal。
> **背景**：Clairis 计划借鉴豆包实现 WYSIWYG 编辑。本仓 `packages/editor` 与 Clairis 技术路线同构（CM6 装饰式"活的源码"），决定**内核层移植、编排层重写**。豆包行为基线见本仓 `docs/doubao-editor-study/` + Clairis `docs/research/competitors/豆包在线文档编辑器-WYSIWYG功能侦察.md`。
> **日期**：2026-10-06（创建）｜2026-10-30（红线 2 复核、计数复跑、路径修正）

---

## 一、移植策略（已定）

| 层 | 内容 | 决定 |
|---|---|---|
| 内核层 | decorations（heading/list/boldItalic/code/quote/table/columns/callout/image/hr）、block-model、slash、smart-input、keybindings | **移植**（含 949 单测随行进 Clairis `src/__tests__`） |
| 编排层 | block-handle / 菜单栈 / 浮层 / 色板 UI / hover 门控 | **重写**（按 `docs/doubao-editor-study/ui-gap-and-target.md` §4 目标态清单在 Clairis 侧新写，不照搬现状） |
| renderer 依赖 | `@md-bundle/editor` → `@md-bundle/renderer` 耦合 | 移植过程中解耦成接口，或 Clairis 连带接收管线（不阻塞启动） |

## 二、Go/No-Go 红线（全部满足才移植）

### 红线 1：源码无损往返（最硬，毁数据=不可接受）
任何 WYSIWYG 操作（块转换、表格编辑、callout、颜色、分栏）后，底层 Markdown 源码**内容零丢失、用户原有格式零改写**——装饰层坏了只是显示问题，源码写坏是数据事故。

**验收**：一份覆盖全部块类型的测试文档，逐操作后 diff 源码，仅允许出现该操作的预期变更。需有自动化往返测试（当前缺口：未系统验证，无往返测试证据）。

### 红线 2：P0 缺陷清零（依 `docs/doubao-editor-study/ui-gap-and-target.md` §7 缺陷索引）
编排层 P0 全部关闭，三类重点：

1. **菜单栈语义**：U-03（近底部不弹出）、U-07（离栈不消退 + retarget 重弹）、U-09（菜单位置错）、F-05（手柄未滑入即弹菜单）
2. **表格交互**：F-03（行列热点错位/常显）、F-04（隐形边界层吞点击）、F-09/G-06（表格块菜单无专属项）
3. **图标/菜单结构**：F-01（统一图标词汇）、F-08/G-08（转为网格 10/10）、G-13（手柄图标随块型即时切换）

### 红线 3：open p1 清零
当前 #381（高亮块编辑后不实时更新，p1）必须关闭。**p2 及以下可带病移植**（在 Clairis 侧登记为已知缺陷跟进），p1 不行——它影响基本编辑可信度。

### 红线 4：回归资产可迁移
- 949 单测全绿（**已达成**，2026-10-06 复跑通过）且随代码一起移植；
- 豆包对照验收（截图 vs 原型并排 + 多模态复核）流程可在 Clairis 复用。

### 加分项（不阻塞）：renderer 解耦
见上表。移植中解决即可。

## 三、现状对照（2026-10-30 实测）

| 门槛 | 现状 | 证据 |
|---|---|---|
| 红线 1 源码无损 | ⏳ 矩阵在建 | change `editor-porting-gate` task 1.1 / 1.2（#420 / #421） |
| 红线 2 P0 清零 | ✅ 独立复核通过 | 6 个目标 spec 共 34 用例 passed，见 §五 |
| 红线 3 p1 清零 | ⏳ #381 open | 修复在 change task 1.3（#422）；#396 同源并入 |
| 红线 4 回归资产 | ✅ 已复跑 | renderer 118 / editor 949 / web 416 passed |
| 加分项 renderer | ❌ 仍耦合 | 不阻塞移植，Clairis 侧连带接收管线即可 |

> 2026-10-06 版记「红线 2 ❌ 12+ 项 open」已过期：子票 #356–#364 与 #376–#395 陆续合并后，issue 侧无 open 的 p0。本节改用独立探针复核，不再以票据状态推定。

## 四、触发流程

1. 本仓收尾 change：按红线 1–3 拆票修复（走 CW G0–G4 门禁），本清单为验收标准；
2. 全绿后通知 Clairis 侧 → Clairis 起 `/opsx-propose` 移植 change（内核层先行：标题/列表/todo/行内格式/引用/代码块为第一批，对照豆包验收通过后再移表格/分栏/颜色）；
3. 移植适配点（Clairis 侧已知约束）：CSS manifest 检查（`cm-*` class 必须有 CSS）、测试仅收集 `src/__tests__`、三 Zustand store 架构、Tauri 桌面环境。

## 五、红线 2 复核记录（2026-10-30）

方法：验证者本人跑 P0 三类目标 spec，不采信票据的「已关闭」。

```
pnpm --filter @md-bundle/web exec playwright test \
  test/submenu-stack-387.spec.ts \
  test/issue-390-shortcuts-slidein.spec.ts \
  test/table-hotspot-gating-385.spec.ts \
  test/table-hotspot-fidelity2.spec.ts \
  test/block-handle-icon.spec.ts \
  test/block-menu-fidelity2.spec.ts
→ 34 passed (19.8s)
```

| 类别 | spec | 用例数 | 覆盖的缺陷项 |
|---|---|---|---|
| 菜单栈 | `submenu-stack-387.spec.ts` | 6 | U-03 视口夹取/翻转、U-07 离栈即收 + 去 retarget、U-09 顶端对齐、F-05 滑入才显 |
| 菜单栈 | `issue-390-shortcuts-slidein.spec.ts` | 4 | F-05 选区工具栏/⌘K 滑入即显示、菜单快捷键口径 |
| 表格 | `table-hotspot-gating-385.spec.ts` | 5 | F-03 热点位置与 hover 门控、F-04 边界层不吞点击、末列手柄 |
| 表格 | `table-hotspot-fidelity2.spec.ts` | 8 | F-03/F-04 几何断言、G-09 格内手柄、F-09/G-06 表格专属项 |
| 图标与菜单结构 | `block-handle-icon.spec.ts` | 5 | F-01 图标词汇、G-13 图标随块型切换 |
| 图标与菜单结构 | `block-menu-fidelity2.spec.ts` | 6 | F-08/G-08 转为网格 10 项、G-07 236/32、G-05/G-06 上下文分型、U-09 对齐 |

本轮未发现回归。若后续任一 spec 转红，按缺陷流程开 `[bug]` 票，红线 2 回到 ❌。
