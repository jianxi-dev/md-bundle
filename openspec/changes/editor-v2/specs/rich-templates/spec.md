## ADDED Requirements

### Requirement: Callout 类型
系统 SHALL 支持 12+ 种 Callout 类型，每种有独特颜色和图标。

#### Scenario: 渲染 Callout
- **WHEN** 文档包含 `> [!info] 提示`
- **THEN** 渲染为蓝色左边框 + ℹ️ 图标 + 提示内容

#### Scenario: 折叠 Callout
- **WHEN** 文档包含 `> [!tip]- 可折叠`
- **THEN** 渲染为可点击展开/收起的提示块

### Requirement: 视觉模板
系统 SHALL 支持 Hero Banner、Card Grid、Timeline 等布局模板。

#### Scenario: Hero Banner
- **WHEN** 文档包含 `::: {.hero}`
- **THEN** 渲染为居中 + 渐变背景 + 大标题

#### Scenario: Card Grid
- **WHEN** 文档包含 `::: {.card-grid cards:3}`
- **THEN** 渲染为 3 列等宽卡片网格

### Requirement: HTML 块安全嵌入
系统 SHALL 允许嵌入安全的 HTML 子集，禁止危险标签。

#### Scenario: 允许的 HTML
- **WHEN** 文档包含 `<mark>高亮</mark>`
- **THEN** 正常渲染为黄色高亮文本

#### Scenario: 禁止的 HTML
- **WHEN** 文档包含 `<script>alert(1)</script>`
- **THEN** script 标签被剥离

### Requirement: CSS-only 组件
系统 SHALL 支持 CSS-only 交互组件（无 JS）。

#### Scenario: 折叠块
- **WHEN** 文档包含 `<details><summary>标题</summary>内容</details>`
- **THEN** 点击标题展开/收起内容
