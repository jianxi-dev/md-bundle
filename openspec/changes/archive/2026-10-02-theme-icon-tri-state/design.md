## Context

当前 `Toolbar.tsx` 中 `ICON.theme` 是一个静态的半月形 SVG 图标。`App.tsx` 中的 `handleThemeClick` 循环切换 `system → dark → light`，但按钮图标始终不变。需要让图标反映当前主题偏好状态。

约束：
- 图标使用内联 SVG（与现有一致，零依赖）
- 不改变主题切换循环逻辑
- 不改变持久化机制

## Goals / Non-Goals

**Goals:**
- 浅色模式显示太阳图标
- 深色模式显示月亮图标
- 跟随系统显示现有半月形图标
- 图标随状态实时切换

**Non-Goals:**
- 不添加动画/过渡效果
- 不改变按钮尺寸或布局
- 不改变主题切换的循环顺序

## Decisions

### 1. 图标注入方式：prop 传入 vs 内部读取

**选择**：通过新增 `themeProp` prop 从父组件传入。

**理由**：Toolbar 已经是受控组件模式（`currentMode`、`canSave` 等均由 props 传入），保持一致性。避免 Toolbar 直接读取 localStorage 或调用 `matchMedia`，保持组件纯净可测试。

**替代方案**：Toolbar 内部调用 `loadThemePreference()` — 被拒绝，违反现有受控组件模式，且增加组件与存储的耦合。

### 2. 图标拆分策略

**选择**：`ICON.theme` 拆分为 `ICON.themeLight`、`ICON.themeDark`、`ICON.themeSystem`。

**理由**：与现有 `ICON.edit`、`ICON.save` 等命名模式一致，按状态命名清晰。

### 3. 按钮提示文案

**选择**：`title` 和 `aria-label` 动态显示当前状态 + 下一步操作。

**示例**：`title="当前：浅色（点击切换到深色）"`，`aria-label="当前浅色主题"`

## Risks / Trade-offs

- [测试更新] → 现有 Toolbar 测试中 `theme-btn` 的断言可能需要更新（图标 SVG 路径变化）
- [可访问性] → 动态 aria-label 确保屏幕阅读器用户也能感知状态变化
