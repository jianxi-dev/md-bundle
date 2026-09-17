# Markdown 所见即所得编辑器 — 顶级设计方案 v2

> **设计目标**：打造一款操作更简单、功能更强大、体验更具创意的 Markdown 编辑器，全面超越 WorkBuddy、豆包、Obsidian 等现有产品的编辑能力。
>
> **核心理念**：**「你看到的，就是导出的」** — 编辑态与导出态像素级同源，所有编辑操作直接在渲染态上完成。
>
> **设计铁律**：
> 1. **装饰即视图，源码即真相** — WYSIWYG 层是纯视觉装饰，落盘字节与纯 textarea 100% 一致（round-trip 不变量）
> 2. **行高恒定** — 行高只由 CSS class 决定，标记显隐不改变行高（CLS < 0.01）
> 3. **零私有语法** — 所有功能输出标准 GFM + 现有 callout 语法
> 4. **中文优先** — IME 兼容、全角标点、拼音是第一优先级需求
>
> **v2 变更说明**：基于 Momus 审查报告全面重写。修正了竞品事实错误（Sarala 有命令面板）、解决了键位冲突（Cmd+/ 唯一语义）、补齐了 IME/中文/移动端/无障碍、新增 Phase 0（块模型+风险 spike）。

---

## 0. 现状审计（我们已有什么）

方案不是从零开始。仓库已有大量基础设施：

| 已有资产 | 位置 | 方案如何复用 |
|----------|------|-------------|
| `editorDecorations()` | `packages/editor/src/decorations/` | 7 个装饰器 + IME guard + 光标抑制，Phase 1 重构而非重写 |
| `[H2]` Widget 占位 | `decorations/heading.ts` | 替换为淡色前缀方案 |
| `Decoration.replace` 隐藏 `**` | `decorations/boldItalic.ts` | 保留并扩展 |
| `decorations` Compartment | `editor.ts` | 运行时开关，语义编辑态默认开启 |
| 三模式状态机 `mode: 'edit'\|'source'\|'preview'` | `sessionStore.ts` | `edit` 重定义为语义编辑态 |
| `slashKeymap` + 6 条命令 | `slash.ts` | 扩展为统一命令注册表 |
| `renderMarkdown` + `hydrateLazyFeatures` | `@md-bundle/renderer` | 编辑态/导出态共享的 SSOT |
| 图片替换/删除/定位 | `decorations/image.ts` + `App.tsx` | 合并到统一图片工作流 |
| IME composition guard | `decorations/index.ts` | 所有新装饰必须兼容 |

---

## 一、竞品深度分析（可核验）

### 1.1 竞品编辑能力矩阵

| 能力维度 | Obsidian | Typora | Sarala | Notion | MarkFlow | MD Editor Plus | Any Markdown |
|----------|----------|--------|--------|--------|----------|----------------|--------------|
| 语法隐藏 | 当前行 | 全部 | 当前块 | N/A（非MD） | 当前行+ | 块级 | 块级 |
| 块拖拽 | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ |
| 块转换 | 插件 | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ |
| 浮动工具栏 | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| 命令面板 | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| 表格WYSIWYG | 插件 | 基础 | ❌ | ✅ | ❌ | ✅ | ✅ |
| 上下文工具栏 | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| AI集成 | 插件 | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| 源码保真 | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |

### 1.2 真正的差异化（不喊口号，可验证）

| 差异化点 | 为什么竞品做不到 | 如何验证 |
|----------|-----------------|----------|
| **编辑态 = 导出态像素级同源** | `@md-bundle/renderer` 是 HTML/PNG/预览三者的 SSOT；竞品编辑用一套、导出用另一套 | 编辑态截图 vs 导出 PNG 做 pixel-diff，偏差 = 0 |
| **本地优先 + 文档零外发** | 豆包/WorkBuddy 是云原生；Obsidian AI 需联网 | 断网状态下所有编辑功能可用；AI 走可选本地模型 |
| **中文 IME 原生** | 所有竞品以英文为主，IME 是事后补丁 | 拼音/五笔/仓颉输入零丢字；全角标点 `「」（）` 自动配对 |
| **.mdpkg 自包含包** | 竞品无此格式 | 编辑 → 打包 → 分享 → 打开，图片不裂 |

---

## 二、核心概念精确定义

### 2.0 块模型（Block Model）

> Momus 审查指出"块"从未定义——这是地基，必须先打。

**定义**：块 = Lezer Markdown AST 中一个顶层节点对应的文档区间。

```
文档 = Block₁ \n\n Block₂ \n\n ... \n\n Blockₙ

Block 类型:
  ├─ Paragraph      段落（含内联内容）
  ├─ Heading        ATX 标题（H1-H6）
  ├─ Blockquote    引用块（可嵌套）
  ├─ List          列表（有序/无序/任务），整个 list 是一个块
  ├─ FencedCode    围栏代码块
  ├─ Table         GFM 管道表格
  ├─ ThematicBreak 分割线
  ├─ Image         独立图片块
  ├─ YAMLFrontMatter 前置元数据（整体为一个块，不解析内部）
  └─ HTMLBlock     原始 HTML 块（整体为一个块）
```

**块边界规则**：
- 块之间由空行分隔
- List 的整个连续区域为一个块（含嵌套项）
- FencedCode 从 ``` 到 ``` 为一个块
- Frontmatter 从第一个 `---` 到配对的 `---` 为一个块
- 软换行（single newline inside paragraph）不分割块

**编辑后重划分**：块编辑操作完成后，以当前块 ± 2 行为范围重新解析块边界。

### 2.1 为什么不是"另一个 Live Preview"

**Obsidian Live Preview**：当前行显示源码，其他行隐藏源码。问题：用户需要先理解源码符号才能编辑。

**Typora**：完全隐藏源码，点击后直接编辑原始文本。问题：失去对精确格式的控制。

**我们的语义编辑态**：

```
┌─────────────────────────────────────────────────────────────┐
│ 非活动块（完全渲染）                                          │
│  标题就是标题（大字号加粗），没有 ## 前缀                     │
│  粗体就是粗体，没有 ** 包裹                                  │
│  链接就是蓝色可点击文字，URL 完全隐藏                         │
│  列表就是带主题色圆点的列表，没有 - 或 * 前缀                 │
│  表格就是网格表格，没有管道符                                 │
├─────────────────────────────────────────────────────────────┤
│ 活动块（光标所在块）— 语义化揭示                              │
│  标题：## 以 40% 透明度主题色前缀显示                         │
│  粗体：** 完全隐藏，文字直接加粗                              │
│  链接：文字蓝色显示，URL 在文字后以 30% 灰色小字显示          │
│  列表：圆点保持，但行首出现淡色 - 前缀                        │
│  代码：保持语法高亮，行首显示淡色 ``` 和语言标签              │
│  表格：保持网格，但单元格边框变为淡蓝色虚线                    │
└─────────────────────────────────────────────────────────────┘
```

**关键差异点**：
- Obsidian 的当前行显示**完整源码**（`##` 是纯文本色）
- 我们的当前块显示**语义化标记**（`##` 是主题色半透明前缀）
- Obsidian 的非活动行仍然暴露源码符号
- 我们的非活动块完全渲染，**零源码符号**

### 2.2 视觉规范（精确值）

| 元素 | 非活动态 | 活动态 | 过渡动画 |
|------|----------|--------|----------|
| H1-H6 标记 | 完全隐藏 | 40% 透明度主题色前缀，字号与标题相同 | 120ms ease-out |
| 粗体 `**` | 完全隐藏 | 完全隐藏（始终不可见） | 无 |
| 斜体 `*` | 完全隐藏 | 完全隐藏 | 无 |
| 删除线 `~~` | 完全隐藏 | 完全隐藏 | 无 |
| 反引号 `` ` `` | 完全隐藏 | 25% 透明度灰色背景 | 120ms |
| 链接 URL | 完全隐藏 | 30% 灰色，12px 后缀 | 150ms |
| 列表符号 | 主题色圆点/bullet | 圆点 + 淡色原始符号 | 100ms |
| 引用 `>` | 左侧 3px 主题色竖线 | 竖线 + 淡色 > 前缀 | 100ms |
| 表格 | 网格线 | 蓝色虚线网格 | 150ms |
| 分割线 | 水平线 | 水平线 + 淡色 --- | 100ms |

### 2.3 三种模式的最终定义

| 模式 | 内部名 | 定义 | 默认 |
|------|--------|------|------|
| **编辑** | `semantic` | 语义编辑态 — 非活动块完全渲染，活动块语义化揭示 | ✅ |
| **源码** | `source` | 保留现有 CodeMirror 源码编辑器，语法高亮 | |
| **预览** | `preview` | 只读渲染态，同现有 PreviewView，支持导出前确认 | |

**模式切换**：
- 工具栏 ghost 图标切换（保持现有交互）
- `Cmd/Ctrl + Shift + E` ↔ `semantic/source` 循环切换
- `Cmd/Ctrl + Shift + P` 切换到 `preview`
- 预览态点击任意位置 → 切回上次的模式（语义或源码）

---

## 三、核心功能设计

### 3.1 渐进式语法揭示引擎

#### 技术实现路径

基于 CodeMirror 6 的 `Decoration.replace` + `Decoration.mark` + `Decoration.widget`，采用 **Silkdown + Atomic Editor 的混合架构**：

```
Lezer Markdown 解析树
        │
        ▼
  Block Classifier（块分类器）
        │
        ├─ 活动块 → SemanticDecorator（语义化装饰）
        │   ├─ HeaderMark → 半透明前缀
        │   ├─ EmphasisMark → 隐藏
        │   ├─ LinkMark → 后缀 URL
        │   └─ ListMark → 圆点 + 淡色符号
        │
        └─ 非活动块 → RenderDecorator（完全渲染装饰）
            ├─ HeaderMark → 完全隐藏
            ├─ EmphasisMark → CSS 加粗/斜体
            ├─ LinkMark → 蓝色可点击
            ├─ TableNode → Widget 替换为网格
            ├─ ImageNode → Widget 替换为图片
            └─ CodeBlock → 保持高亮
```

#### 关键实现决策

1. **行高冻结**：参考 Atomic Editor 的 `freezeMousePlugin`，点击块时冻结装饰更新 100ms，防止光标移动时的布局抖动（CLS < 0.003）
2. **全量解析**：每次文档变更时调用 `ensureSyntaxTree(state, state.doc.length, 200)` 确保全文解析覆盖（Lezer 默认只解析视口附近）
3. **装饰缓存**：未变化的块复用装饰集，仅重新装饰变更块 ±2 行范围内的块
4. **原子范围**：隐藏语法标记的范围设为 `atomicRanges`，光标跳跃时跳过隐藏区域

#### 性能目标

| 文档大小 | 首次渲染 | 编辑延迟 | 内存占用 |
|----------|----------|----------|----------|
| < 1万字 | < 100ms | < 16ms | < 50MB |
| 1-10万字 | < 300ms | < 33ms | < 150MB |
| 10-50万字 | < 800ms | < 50ms | < 400MB |
| > 50万字 | 提示切换源码模式 | — | — |

### 3.2 块级操作系统

#### 3.2.1 块手柄 (Block Handle)

**实现方式**：左侧 gutter decoration（`lineDecoration`），悬停块时显示。

```
    ┌─┐
    │⠿│  ← 悬停时出现（opacity 0 → 1，150ms）
    │ │
    │ │  块内容...
    │ │
    └─┘
```

- **点击**：选中整个块 + 展开块操作菜单
- **拖拽**：启动 HTML5 Drag API，drop 时计算目标位置并移动块
- **右键**：直接展开块操作菜单

**拖拽实现细节**：
- 使用 `dragstart` 设置块范围数据（from/to）
- `dragover` 时在目标位置显示插入指示线（蓝色细线）
- `drop` 时执行 `view.dispatch` 移动文本范围
- 跨块拖拽 = 删除源范围 + 插入目标位置

#### 3.2.2 块操作菜单

**触发方式**：块手柄点击 / 右键块 / `Cmd/Ctrl + Shift + M`

```
┌──────────────────────────────┐
│ 🔄 转换为 ▾                   │
│   → 段落                      │
│   → 标题 1-6                  │
│   → 无序列表                  │
│   → 有序列表                  │
│   → 任务列表                  │
│   → 引用块                    │
│   → 代码块                    │
│ ──────────────────            │
│ 📋 复制块                     │
│ 📑 向下复制                   │
│ 🗑️ 删除块                    │
│ ✨ AI ▾                       │
│   → 续写                      │
│   → 润色                      │
│   → 翻译                      │
│   → 总结                      │
│ ──────────────────            │
│ ⬆️ 上移 / ⬇️ 下移             │
└──────────────────────────────┘
```

#### 3.2.3 块级快捷键（已解决 v1 冲突）

| 快捷键 | 操作 | 说明 |
|--------|------|------|
| `Cmd/Ctrl + Shift + ↑` | 块上移 | 与前一个同类型块交换 |
| `Cmd/Ctrl + Shift + ↓` | 块下移 | 与后一个同类型块交换 |
| `Cmd/Ctrl + Shift + D` | 复制块 | 在块下方插入副本 |
| `Cmd/Ctrl + Shift + Delete` | 删除块 | 选中整个块后删除 |
| `Cmd/Ctrl + Shift + M` | 块操作菜单 | 展开当前块菜单 |
| `Cmd/Ctrl + Alt + ↑/↓` | 多块扩展选中 | 向上/向下扩展一个块 |
| `Cmd/Ctrl + /` | 编辑↔源码切换 | **唯一语义**，不再兼任块菜单 |
| `Cmd/Ctrl + Shift + P` | 切换到预览 | — |
| `Cmd/Ctrl + K` | 命令面板 | 链接插入改为 `Cmd+Shift+L` |

### 3.3 上下文感知浮动工具栏

**实现方式**：`selectionChange` 监听 + 动态 DOM 元素（非 CM6 decoration），绝对定位在选中文本上方。

#### 上下文规则

| 上下文 | 工具栏内容 | 触发条件 |
|--------|-----------|----------|
| 文本选中 | B I S ` 🔗 🎨 ✨AI | selection 非空 |
| 光标在表格中 | ➕行 ➕列 ↔对齐 🎨 ✨转图表 | nodeAt 为 Table |
| 光标在图片上 | 🔄替换 ✏️Alt 📐缩放 🗑️删除 | nodeAt 为 Image |
| 光标在链接上 | ✏️编辑 🔗打开 ❌移除 | nodeAt 为 Link |
| 光标在代码块中 | 📋复制 🎨语言 ✨解释 | nodeAt 为 FencedCode |
| 空行 | **不显示**（由斜杠命令 + 块手柄覆盖，避免噪音） | 行内无内容 |
| 正常段落 | （不显示） | — |

#### 位置算法
```
if (selection 在视口上半部):
    toolbar 在 selection 上方 8px
else:
    toolbar 在 selection 下方 8px

if (toolbar 超出左边界):
    left = 8px
elif (toolbar 超出右边界):
    right = 8px
else:
    centered on selection
```

#### 移动端适配
- 触屏：长按选中文本 → 自动扩展选择 + 显示工具栏
- 工具栏在移动端固定在底部（避免键盘遮挡）
- 块手柄在触屏上始终显示（不依赖 hover）

### 3.4 智能输入系统

#### 3.4.1 Markdown 快捷输入（Input Rules）

利用 CM6 的 `InputRule` 或 `keymap` 实现：

| 输入 | 效果 | 实现方式 |
|------|------|----------|
| `# ` + Space | 转为 H1 | InputRule |
| `## ` ~ `###### ` + Space | 转为 H2-H6 | InputRule |
| `- ` + Space | 转为无序列表 | InputRule |
| `* ` + Space | 转为无序列表 | InputRule |
| `1. ` + Space | 转为有序列表 | InputRule |
| `- [ ] ` + Space | 转为任务列表 | InputRule |
| `- [x] ` + Space | 转为已完成任务 | InputRule |
| `> ` + Space | 转为引用块 | InputRule |
| ` ``` ` + Enter | 插入代码块 | InputRule |
| `---` + Enter | 插入分割线 | InputRule |
| `\| \| ` | 插入 2x2 表格 | Slash command |

#### 3.4.2 智能 Enter（Keymap override）

| 场景 | 行为 | 说明 |
|------|------|------|
| 列表末尾 Enter | 继续列表（复制符号） | 空项 Enter 退出 |
| 引用块 Enter | 继续引用（复制 >） | 空行 Enter 退出 |
| 代码块内 Enter | 保持缩进 | ` ``` ` Enter 退出 |
| 表格内 Tab | 下一列 | 最后一列 Tab 新增行 |
| 标题 Enter | 新行保持段落 | 不按 Obsidian 的"同级" |
| 任务列表 Enter | 继续 + 空 checkbox | — |

#### 3.4.3 智能 Backspace

| 场景 | 行为 |
|------|------|
| 列表开头 | 取消列表 → 段落 |
| 引用开头 | 取消引用 → 段落 |
| 空代码块 | 删除整个代码块 |
| 任务列表开头 | 取消任务 → 列表 |

#### 3.4.4 自动配对

```
输入 ** → **│**（光标在中间）
选中文本 + ** → **选中文本**
输入 ` → `│`
输入 $ → $│$
输入 [ → [│]
输入 ![ → ![│]
```

### 3.5 所见即所得表格编辑器

#### 技术路径：Widget Decoration 替换

**选择方案 (a) Widget decoration 替换整个表格**（Atomic Editor 方式），而非保留源码加样式。原因：真正的 WYSIWYG 表格需要单元格级编辑、列宽拖拽、行内换行，纯 CSS 装饰无法实现。

```
源码中的表格:
| A | B | C |
|---|---|---|
| 1 | 2 | 3 |

    ↓ Decoration.replace 替换为 Widget ↓

渲染后的 Widget:
┌─────┬─────┬─────┐
│  A  │  B  │  C  │  ← 列头可点击排序
├─────┼─────┼─────┤
│  1  │  2  │  3  │  ← 单元格直接编辑
└─────┴─────┴─────┘
  ↕ 拖拽调整列宽
```

#### 数据流

```
用户在 Widget 中编辑单元格
        │
        ▼
Widget 序列化 → 重新生成 GFM 表格文本
        │
        ▼
view.dispatch({ changes: { from: tableFrom, to: tableTo, insert: newTableText } })
        │
        ▼
Lezer 重新解析 → 装饰重建
```

#### Widget 交互

| 操作 | 方式 |
|------|------|
| 编辑单元格 | 单击进入编辑（contenteditable） |
| 单元格间移动 | Tab / Shift-Tab |
| 新增行 | 最后单元格 Tab / 右键菜单 |
| 新增列 | 右键菜单 / 列边 + 按钮 |
| 删除行/列 | 右键菜单 |
| 对齐方式 | 列头下拉菜单 |
| 列宽调整 | 拖拽列边 |
| 排序 | 列头点击（升/降/原始） |
| 退出编辑 | Esc / 点击外部 |

### 3.6 命令面板

`Cmd/Ctrl + K` 打开（不与链接快捷键冲突，链接改为 `Cmd/Ctrl + Shift + K`）。

#### 搜索算法

- 模糊匹配（Fuse.js 或自实现）
- 拼音首字母匹配（如 `cr` 匹配 "插入**插**入**表**格"）
- 最近使用排序（localStorage 记录）
- 上下文过滤（无选中时不显示"加粗"，无文档时不显示编辑命令）

#### 命令分类

| 分类 | 示例命令 | 快捷键 |
|------|----------|--------|
| 格式 | 加粗/斜体/代码/链接 | Cmd+B/I/E/K |
| 块 | 标题/列表/引用/代码块 | Cmd+1~6, etc. |
| 插入 | 表格/图片/分割线/Callout | — |
| 转换 | 列表↔任务/文本↔表格/文本↔看板 | — |
| 编辑 | 查找替换/全选/撤销重做 | Cmd+F/Z |
| 视图 | 切换模式/主题/大纲 | Cmd+Shift+E/P |
| AI | 续写/润色/翻译/总结 | — |

### 3.7 图片工作流增强

| 功能 | 实现方式 | 超越点 |
|------|----------|--------|
| 拖拽缩放 | 选中图片后四角控制点 | 比 Typora 更直观 |
| 对齐方式 | 工具栏菜单：左/中/右/原宽 | Obsidian 需 CSS 片段 |
| 复制为 Markdown | 右键菜单 "复制为 ![...]" | 便于迁移 |
| 画廊模式 | 连续图片自动网格布局 | Notion 式体验 |
| 粘贴优化 | 自动压缩 > 2MB 图片 | 减少 .mdpkg 体积 |

### 3.8 块级 AI 操作

#### AI 服务架构

```
┌─────────────────────────────────────┐
│  AI Provider Interface（抽象层）      │
│  ├─ OpenAI Compatible（默认）        │
│  ├─ Anthropic Claude                 │
│  ├─ Ollama（本地）                   │
│  └─ 自定义端点                       │
└─────────────────────────────────────┘
        │
        ▼
  用户在设置中配置 API Key（localStorage 加密存储）
  或使用内置的免费额度（如果未来有）
```

#### 交互模式

**行内流式（Inline Streaming）**：
1. 用户选中块 → 点击 AI → 选择操作
2. 块下方出现灰色斜体的流式输出
3. 输出完成后显示 [接受] [重新生成] [丢弃]
4. 接受后替换原块内容

**建议模式（Suggestion Mode）**：
1. AI 输出以 "tracked changes" 形式显示
2. 新增内容绿色背景，删除内容红色删除线
3. 用户可逐段接受/拒绝

#### AI 操作清单

| 操作 | 输入 | 输出 |
|------|------|------|
| 续写 | 当前块内容 | 后续内容 |
| 润色 | 选中文本 | 改写后文本 |
| 翻译 | 选中文本 + 目标语言 | 翻译结果 |
| 总结 | 多块选中 | 要点列表 |
| 扩展 | 简短文本 | 详细说明 |
| 转表格 | 结构化文本 | GFM 表格 |
| 转看板 | ~~任务列表~~ | ❌ 不实现（违反零私有语法） |
| 转 Mermaid | 流程描述 | 时序图/流程图 |
| 解释 | 代码块/公式 | 中文解释 |
| 提问 | 当前块 | 回答 |

---

## 四、错误边界与降级策略

| 场景 | 降级行为 |
|------|----------|
| KaTeX 解析失败 | 显示红色错误文本 + 原始 LaTeX，不崩溃 |
| Mermaid 语法错误 | 显示 "⚠️ 图表语法错误" + 原始代码 |
| 图片加载失败 | 显示占位图 + alt 文本 |
| 大文档性能不足 | 提示 "文档过大，建议切换到源码模式" |
| AI 服务不可用 | 显示 "AI 服务不可用，请检查网络/配置" |
| 装饰引擎异常 | 自动回退到源码模式，不白屏 |
| 浏览器不支持 | 优雅降级到源码模式（非 Chromium） |

---

## 五、技术架构

### 5.1 扩展栈总览

```
┌─────────────────────────────────────────────────────────────────┐
│  @md-bundle/editor v2                                           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Core Extensions（已有）                                   │  │
│  │  ├─ markdown() — Lezer Markdown 解析                      │  │
│  │  ├─ history() — 撤销/重做                                 │  │
│  │  ├─ theme — 主题 Compartment                              │  │
│  │  └─ slashKeymap — / 命令菜单                              │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │  Semantic Edit Extensions（新增）                          │  │
│  │  ├─ revealExtension — 渐进式语法揭示引擎                   │  │
│  │  │   ├─ SemanticDecorator（活动块语义化）                  │  │
│  │  │   ├─ RenderDecorator（非活动块完全渲染）                │  │
│  │  │   ├─ freezeMousePlugin（点击冻结）                      │  │
│  │  │   └─ atomicRangeProvider（光标跳过隐藏标记）            │  │
│  │  ├─ blockHandleExtension — 块手柄 + 拖拽                  │  │
│  │  ├─ smartInputKeymap — 智能 Enter/Backspace/Tab           │  │
│  │  ├─ autoPairExtension — 自动配对                          │  │
│  │  ├─ tableWidgetExtension — WYSIWYG 表格                    │  │
│  │  ├─ floatingToolbarPlugin — 上下文工具栏                   │  │
│  │  └─ commandPaletteExtension — 命令面板                    │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │  AI Extensions（新增）                                     │  │
│  │  ├─ aiProvider — AI 服务抽象层                            │  │
│  │  ├─ aiStreamRenderer — 流式输出渲染                       │  │
│  │  └─ aiSuggestionMode — 建议接受/拒绝                      │  │
│  └───────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  @md-bundle/renderer（已有，扩展）                                │
│  ├─ renderMarkdown — 同步渲染                                  │
│  ├─ hydrateLazyFeatures — KaTeX/mermaid/highlight               │
│  └─ readerCssText — 双主题 CSS                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 关键接口

```typescript
// 渐进式揭示配置
interface RevealConfig {
  mode: 'semantic' | 'source' | 'preview';
  revealRules: RevealRules;
  transitionMs: number;
  freezeMs: number;
}

interface RevealRules {
  heading: 'hide' | 'ghost-prefix';
  emphasis: 'hide' | 'show-boundaries';
  inlineCode: 'hide-marks' | 'show-marks';
  link: 'hide-url' | 'suffix-url';
  list: 'render-bullet' | 'show-marker';
  blockquote: 'render-rule' | 'show-marker';
  table: 'render-grid' | 'show-pipes';
  fence: 'show-lang' | 'hide-lang';
}

// 块操作
interface BlockAction {
  id: string;
  label: string;
  icon: string;
  transform: (state: EditorState, blockRange: BlockRange) => TransactionSpec;
  available: (state: EditorState, blockRange: BlockRange) => boolean;
}

// AI Provider
interface AIProvider {
  name: string;
  stream(params: StreamParams): AsyncIterable<string>;
  capabilities: AICapability[];
}
```

---

## 六、实施路线图

### Phase 0: 基础设施（2 周）⚠️ 新增

**目标**：定义块模型 + 建立不变量 + 统一命令注册表

- [ ] 块模型定义：Lezer AST 顶层节点 → 块边界规则（含 frontmatter/嵌套列表/HTML 块）
- [ ] 范围映射：源码 offset ↔ 渲染 DOM offset 双向映射
- [ ] 统一命令注册表：`CommandRegistry` 接口 + 现有 slash.ts/Toolbar.tsx 迁移
- [ ] 行为矩阵：`状态 × 输入 → 结果` 完整状态机文档
- [ ] round-trip 不变量测试：装饰纯视图、落盘字节 = textarea 字节
- [ ] CLS 不变量测试：行高只由 CSS class 决定

**出口标准**：块模型 100% 覆盖现有测试文档；round-trip 1000 个随机文档逐字节一致；CLS < 0.01

### Phase 0.5: 风险 Spike（各 ≤2 天）⚠️ 新增

**目标**：验证三项最高风险技术

1. **表格 Widget**：contentEditable 单元格 + IME + 光标映射 + atomicRanges
2. **块拖拽**：跨虚拟化行 + 文档变更式 + undo 一致性
3. **中文 IME**：装饰隐藏 + 冻结重建下输入不丢字、不闪标记

**出口标准**：表格 Tab 跳转正确率 100%；拖拽跨 100+ 行 undo 正确；IME 拼音/五笔/手写无异常

### Phase 1: 渐进式语法揭示引擎（4 周）

**目标**：实现核心差异化——语义编辑态

- [ ] Week 1: `revealExtension` 基础框架 + 标题/粗体/斜体/链接的装饰
- [ ] Week 2: 列表/引用/代码块的装饰 + 冻结机制 + 原子范围
- [ ] Week 3: 三种模式切换 + 视觉规范精确实现 + 动画过渡
- [ ] Week 4: 性能优化（装饰缓存、增量解析）+ 大文档降级 + 单元测试

**验收标准**：
- 1 万字文档编辑延迟 < 33ms（30 FPS）
- 点击块无布局抖动（CLS < 0.01）
- 源码 100% 保真（roundtrip 测试通过）

### Phase 2: 块级操作系统（3 周）

- [ ] Week 5: 块手柄（悬停显示、点击选中、右键菜单）
- [ ] Week 6: 块操作菜单（转换、复制、删除）+ 块级快捷键
- [ ] Week 7: 块拖拽重排 + 拖放指示线 + 跨块移动

### Phase 3: 智能输入 + 浮动工具栏（3 周）

- [ ] Week 8: Markdown 快捷输入 + 智能 Enter/Backspace + 自动配对
- [ ] Week 9: 上下文感知浮动工具栏 + 位置算法 + 移动端适配
- [ ] Week 10: 命令面板 UI + 模糊搜索 + 拼音匹配

### Phase 4: 表格 + 图片增强（2 周）

- [ ] Week 11: WYSIWYG 表格 Widget + 单元格编辑 + 列宽拖拽
- [ ] Week 12: 图片拖拽缩放 + 对齐 + 画廊模式

### Phase 5: 命令面板 + AI（3 周）

- [ ] Week 13: AI Provider 接口 + 设置面板
- [ ] Week 14: 行内流式输出 + 建议接受/拒绝
- [ ] Week 15: 块级 AI 操作 + 10 种操作实现

**总工期：15 周（约 4 个月）**

---

## 七、超越性总结

### 7.1 核心差异化声明

| 竞品 | 他们做什么 | 我们做什么 | 差异深度 |
|------|-----------|-----------|----------|
| **Obsidian** | 当前行显示源码 | 当前块语义化揭示 + 非活动块完全渲染 | 从"看到源码"到"看到语义" |
| **Typora** | 完全渲染，点击编辑源码 | 完全渲染，点击编辑语义层 | 从"全有或全无"到"渐进式" |
| **Notion** | 块级操作但非 Markdown | 块级操作 + 100% Markdown 保真 | 从"锁定"到"开放" |
| **Sarala** | 块级编辑 + ⌘K 面板 | 块级拖拽 + 中文优先 + 同源导出 + AI | 从"好编辑"到"更完整" |
| **MD Editor Plus** | Notion 式块编辑 | 语义编辑 + 源码保真 + 导出 | 从"看起来像"到"真的是" |

### 7.2 一句话定位

> **"Typora 的简洁 × Obsidian 的保真 × Notion 的块操作 × 原生中文支持 × 编辑即导出 — 在一个纯前端、零锁定的 Markdown 编辑器中。"**

### 7.3 设计哲学

1. **不增加模式，改善模式** — 不是做第四种模式，而是让"编辑"模式本身就包含渐进式揭示
2. **不堆砌功能，深度整合** — 每个新功能都工作在语义编辑面上，而非独立运行
3. **不牺牲保真，追求体验** — 100% Markdown roundtrip 是底线，体验提升不损失可移植性
4. **不锁定用户，开放一切** — 纯前端、MIT 开源、标准 Markdown 输出、AI Provider 可配置
