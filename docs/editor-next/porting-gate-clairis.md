# md-bundle → Clairis 编辑器移植门槛（Go/No-Go 清单）

> **用途**：定义 `@md-bundle/editor` 移植进 Clairis（桌面旗舰仓库 `lqtdys/clairis`）前，本仓必须达到的功能质量红线。达到即触发 Clairis 侧移植 proposal。
> **背景**：Clairis 计划借鉴豆包实现 WYSIWYG 编辑。本仓 `packages/editor` 与 Clairis 技术路线同构（CM6 装饰式"活的源码"），决定**内核层移植、编排层重写**。豆包行为基线见本仓 `docs/doubao-editor-study/` + Clairis `docs/research/competitors/豆包在线文档编辑器-WYSIWYG功能侦察.md`。
> **日期**：2026-10-06

---

## 一、移植策略（已定）

| 层 | 内容 | 决定 |
|---|---|---|
| 内核层 | decorations（heading/list/boldItalic/code/quote/table/columns/callout/image/hr）、block-model、slash、smart-input、keybindings | **移植**（含 949 单测随行进 Clairis `src/__tests__`） |
| 编排层 | block-handle / 菜单栈 / 浮层 / 色板 UI / hover 门控 | **重写**（按 `ui-gap-and-target.md` 目标态清单在 Clairis 侧新写，不照搬现状） |
| renderer 依赖 | `@md-bundle/editor` → `@md-bundle/renderer` 耦合 | 移植过程中解耦成接口，或 Clairis 连带接收管线（不阻塞启动） |

## 二、Go/No-Go 红线（全部满足才移植）

### 红线 1：源码无损往返（最硬，毁数据=不可接受）
任何 WYSIWYG 操作（块转换、表格编辑、callout、颜色、分栏）后，底层 Markdown 源码**内容零丢失、用户原有格式零改写**——装饰层坏了只是显示问题，源码写坏是数据事故。

**验收**：一份覆盖全部块类型的测试文档，逐操作后 diff 源码，仅允许出现该操作的预期变更。需有自动化往返测试（当前缺口：未系统验证，无往返测试证据）。

### 红线 2：P0 缺陷清零（依 `ui-gap-and-target.md` §7 缺陷索引）
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

## 三、现状对照（2026-10-06）

| 门槛 | 现状 |
|---|---|
| 红线 1 源码无损 | ❌ 无往返测试证据 |
| 红线 2 P0 清零 | ❌ 12+ 项 open |
| 红线 3 p1 清零 | ❌ #381 open |
| 红线 4 回归资产 | ✅ 949 测试全绿 |
| 加分项 renderer | ❌ 依赖耦合 |

## 四、触发流程

1. 本仓收尾 change：按红线 1–3 拆票修复（走 CW G0–G4 门禁），本清单为验收标准；
2. 全绿后通知 Clairis 侧 → Clairis 起 `/opsx-propose` 移植 change（内核层先行：标题/列表/todo/行内格式/引用/代码块为第一批，对照豆包验收通过后再移表格/分栏/颜色）；
3. 移植适配点（Clairis 侧已知约束）：CSS manifest 检查（`cm-*` class 必须有 CSS）、测试仅收集 `src/__tests__`、三 Zustand store 架构、Tauri 桌面环境。
