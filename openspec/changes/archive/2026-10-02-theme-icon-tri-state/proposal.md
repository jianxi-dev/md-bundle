## Why

主题切换按钮当前使用单一静态图标（半月形），用户无法从图标直观判断当前所处的主题状态（浅色/深色/跟随系统）。通过三态图标（太阳/月亮/半月）提供即时视觉反馈，提升可用性。

## What Changes

- **Toolbar.tsx**：`ICON.theme` 从单一图标拆分为三个状态图标（`themeLight`/`themeDark`/`themeSystem`）
- **Toolbar.tsx**：新增 `themeProp` prop（`'system' | 'dark' | 'light'`），按钮根据该值渲染对应图标
- **App.tsx**：向 Toolbar 传入 `themePref` 状态
- **Toolbar.tsx**：按钮 `title`/`aria-label` 动态显示当前状态（如"当前：浅色（点击切换到深色）"）

## Capabilities

### New Capabilities

- `theme-icon-tri-state`: 主题切换按钮根据当前偏好状态显示对应图标（太阳=浅色、月亮=深色、半月=跟随系统）

### Modified Capabilities

- `md-bundle-web`: 主题切换按钮的视觉表现从静态图标升级为状态感知图标

## Impact

- **代码文件**: `apps/web/src/components/Toolbar.tsx`（图标定义 + 按钮渲染），`apps/web/src/App.tsx`（传参）
- **测试**: 现有 Toolbar 测试可能需要更新断言；新增图标状态切换测试
- **依赖**: 无新增依赖（内联 SVG）
- **风险**: risk-low（纯 UI 改动，无逻辑变更）
