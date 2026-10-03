# 豆包文档编辑器 · 编辑态深度功能规格

> 研究日期：2026-10-03 ｜ 证据来源：豆包云文档实际页面（`feishu.doubao.com/docx/MWvMd9jiWo9BDFxsNn4cEtzzn8d`）
> 截图目录：`.lavish/assets/doubao/` ｜ 交互原型：`.lavish/doubao-editor-spec.html`
> 本规格用于**修正上一轮只学形态（"只学了毛"）的问题**：这一轮以「图标语义 + 交互编排 + 设计哲学」三层为骨架，逐面取证。

---

## 0. 研究说明

### 0.1 为什么上一轮"功能没法用"

上一轮 `editor-doubao-parity` 抓到了**功能清单**（有斜杠菜单、有块手柄、有工具条、有表格 widget），但没有抓到三件决定体验的东西：

1. **图标词汇表**——每个块型 / 每个动作对应哪个图标、按钮里放什么图标，只做了"图标化"的形，没做"图标语义"的实。
2. **交互编排（choreography）**——手柄何时出现、悬停后图标如何切换、点击后菜单出现在哪、子菜单如何下钻、选中态如何着色。这些时序与位置关系才是"跟手"的来源。
3. **上下文感知**——同一个手柄，不同块型给不同菜单；表格菜单里有表格专属项（标题行/标题列/均分列宽），单元格选区工具栏里有合并单元格/单元格背景。上一轮把这些做成了一套通用菜单，所以"表格的图标里没有表格里更针对性的功能"。

本规格的第 3 节（图标）、第 4–8 节（交互）、第 1 节（哲学）分别补这三层。

### 0.2 证据清单（截图）

| 文件 | 内容 |
|---|---|
| `00-overview.png` | 文档总览（表格/列表/待办/引用/高亮/分栏/链接卡） |
| `01-block-handle.png` | 块手柄悬停态（块型图标 + 拖拽把手） |
| `02-block-menu.png` | 块菜单全景 |
| `03-menu-align.png` | 「缩进和对齐」子菜单 |
| `04-menu-color.png` | 「颜色」子菜单（字体色 + 背景色 + 恢复默认） |
| `05-table-hover.png` / `05b-table-hover.png` | 表格悬停（表块手柄 + 行列插入热点） |
| `06-table-menu.png` | **表格块菜单**（标题行/标题列/均分列宽） |
| `12-cell-bg.png` | 单元格背景颜色子菜单 |
| `13-slash.png` | 斜杠插入菜单（分类列表） |
| `14-slash-table-flyout.png` | 斜杠「常用」分组（表格高亮） |
| `15-table-insert.png` | 斜杠插入表格（默认 2×3） |
| `19-callout-inserted.png` | 高亮块渲染（🎉 + 琥珀底） |
| `22b-callout-emoji.png` | 高亮块 emoji 选择器 |
| `21b-callout-menu.png` | 高亮块上下文菜单（含「同步块」） |
| `26-todo-hover.png` | 待办块行尾「转为任务」工具 |
| `27-text-sel-toolbar.png` | 文本选区（工具栏触发条件观察） |
| `crop-*.png` | 手柄 / 块菜单 / 工具条 / 斜杠菜单特写 |

---

## 1. 设计哲学（Design Philosophy）

> 这一节是"统一应用到编辑态其他功能"的准绳。豆包的编辑态不是"把 Notion 抄一遍"，而是有一套自洽的取舍。

### P0 · 悬停即显，零点击（Hover-reveal, zero-click）★v2 新增
这是最容易做错、也最影响手感的一条。豆包编辑态的控件**靠悬停召唤，几乎不需要点击**：

| 悬停对象 | 立刻出现（无需点击） |
|---|---|
| 任意块行 | 块手柄药丸（块型图标 + 拖拽把手） |
| 手柄本身（把手或块型图标） | **块菜单自动展开** + 该块蓝色选中态 |
| 空行 | 单个「+」（`AddOutlined`） |
| 表格任意单元格 | 表块手柄 + 行列插入热点（淡点） |
| 列上方热点 | 蓝色「+」+ 气泡「插入列」+ 整列高亮 |
| 行左侧热点 | 蓝色「+」+ 横贯整行的蓝线 + 气泡「插入行」 |
| 带 `›` 的菜单项 | 二级 flyout 自动展开 |

**点击只用于"确认动作"（插入、切换、删除），不用于"召唤控件"。** 上一轮把控件做成点击出现，方向就反了。

### P1 · 静默画布，浮层表达（Quiet canvas, expressive overlays）
正文区是**纯内容**：没有常驻工具栏、没有边框装饰、没有按钮。所有"能力"都活在**临时浮层**里（手柄、菜单、工具条、热点）。能力只在需要的那一刻出现，用完即走。
→ 对我们的启示：编辑态**不得**新增常驻控件；任何能力都要有明确的"召唤—消退"时序。

### P2 · 一个手柄，两种意图（One handle, two intents）
块左侧只有一个 **42×26 的圆角药丸**，内含两个信息密度极高的目标：
- **块型图标**（左，`.hover-block-type-icon-container`）：告诉你"这是什么块"，点击走"转为"。
- **拖拽把手**（右，`.drag-handle`）：告诉你"可以抓走/打开菜单"，点击打开块菜单。

一个控件同时承载"识别"与"操作"，零学习成本。
→ 对我们的启示：块手柄不要拆成两个按钮，也不要做成只有"⋮"的通用把手。

### P3 · 图标即词汇（Icons are the vocabulary）
豆包用一套 `universe-icon`（`<svg data-icon="XxxOutlined">`）覆盖所有动作与块型。**块手柄里显示的是该块自己的类型图标**——列表块显示列表图标、高亮块显示高亮图标、表格显示表格图标。菜单、工具条里的每个动作也都有专属图标。图标不是装饰，是压缩后的语义。
→ 对我们的启示：先建立"块型 → 图标"映射表与"动作 → 图标"映射表，再谈布局。

**实证（v3）**：颜色面板的「字体颜色」一行**不是色块，而是不同颜色的字母「A」**——所见即所得，用户一眼看出"这是文字颜色"，**无需阅读任何文字标识**。这是"图标即词汇"的极致：能用可视符号表达的，绝不用文字。

### P4 · 上下文感知（Context-aware menus）
同一个手柄，**不同块型给不同菜单**：
- 列表块：`缩进和对齐 / 颜色 / 评论 / 剪切 / 复制 / 翻译 / 删除 / 分享 / 复制链接 / 在下方添加`
- 高亮块：`同步块 / 缩进 / 评论 / 剪切 / 复制 / 删除 / 分享 / 复制链接 / 在下方添加`（无颜色、无翻译）
- 表格块：`缩进 / 剪切 / 复制 / 删除 / 分享 / 复制链接 / 标题行 / 标题列 / 均分列宽 / 在下方添加`

→ 对我们的启示：菜单必须按块型裁剪，并允许插入块型专属项。表格的"标题行/标题列/均分列宽"就是这一哲学的产物。

### P5 · 一致的下钻语法（Consistent drill-down）
- **`›` = 二级 flyout**（悬停展开，如「缩进和对齐」「颜色」「在下方添加」）
- **`▾` = 弹出面板**（如工具条里的「转为」「对齐」「高亮颜色」）
- **图标网格 = 快速转换**（块菜单顶部的 `T H1 H2 H3 · 有序 · 无序 · 待办 · 代码 · 引用 · 高亮` 一排图标，**无文字**，纯图标即选即转）
- **文字列表 = 需要说明的动作**（其余菜单项都带文字标签）

→ 对我们启示：同一层能力的展开方式要统一，用户才能形成肌肉记忆。

### P6 · 尺寸与色彩阶梯（Tokens）
实测 token（见第 2 节）：圆角 8/6/4px、图标 18/24px、菜单行高 32px、品牌蓝 `#547cff`、悬停底色 `rgba(235,235,235,.08)`。所有间距都是 4 的倍数。

### P7 · 克制的动效（Restrained motion）
菜单/浮层用**极短的进入动画**（`.docx-menu-wrapper-animation`）与 `transition: all`；手柄淡入淡出，不弹跳、不位移夸张。动效只服务于"出现/消失"的可预期性。

---

## 2. 设计 token（浏览器实测）

来源：`getComputedStyle` 于文档根与应用层，共观察到 **635 个 CSS 变量**。

| Token | 值 | 用途 |
|---|---|---|
| `--s-color-brand-primary-default` | `#547cff` | 品牌蓝、选中/焦点 |
| `--sdk-menu-item-hover-color` | `rgba(235,235,235,0.08)` | 菜单项悬停底色 |
| `--radius-md` / `--s-radius-xxss` | `6px` / `8px` | 浮层 / 面板圆角 |
| 正文 | `ui-sans-serif, system-ui, sans-serif`，16px，`#ebebeb` / `#212121` | 深色正文 |
| 菜单容器 | 宽 `232px`，圆角 `6px`，底色 `rgb(41,41,41)`，阴影 `rgba(0,0,0,.28) 0 8px 16px` | 块菜单 |
| 菜单项 | 高 `32px`，内边距 `4px`，圆角 `4px`，字号 `12px` | 块菜单项 |
| 图标 | `svg` 字号 `18px`；图标格 `24×24` | 菜单 / 网格 |
| 块手柄 | `42×26`，圆角 `6px`，底色 `rgb(41,41,41)` | hover 药丸 |
| 高亮块底（橙实心） | `rgba(242,150,44,0.28)` | callout 默认底 |
| 边框 | `--s-color-border-card: #35373a` | 卡片/单元格边框 |

---

## 3. 图标系统

### 3.1 结构
```html
<span class="universe-icon menu_ud_icon color-b-500">
  <svg width="1em" height="1em" viewBox="0 0 24 24" data-icon="TextOutlined">…</svg>
</span>
```
- 统一 `viewBox="0 0 24 24"`，`fill="currentColor"`，尺寸由字号驱动（菜单 18px）。
- `color-b-500 / color-i-500 / color-g-500` 是语义色阶类。
- 图标名（`data-icon`）即语义标识，可在 DOM 中直接读取核对。

### 3.2 块型图标映射表（用于块手柄 + 转为网格）

| 块型 | data-icon | 块型 | data-icon |
|---|---|---|---|
| 正文 | `TextOutlined` | 有序列表 | `OrderListOutlined` |
| 一级标题 | `H1Outlined` | 无序列表 | `DisorderListOutlined` |
| 二级标题 | `H2Outlined` | 待办 | `TodoOutlined` |
| 三级标题 | `H3Outlined` | 代码块 | `CodeblockOutlined` |
| 引用 | `ReferenceOutlined` | 高亮块 | `CalloutOutlined` |
| 分割线 | `DividerOutlined` | 分栏 | `DocColumnsOutlined` |
| 表格 | `DataSheetOutlined` | 复选框（行内） | `CheckboxOutlined` |

### 3.3 手柄图标取决于块型（P3 的实证）
- 列表块手柄 → `DisorderListOutlined`
- 高亮块手柄 → callout 图标
- 表格手柄 → `DataSheetOutlined`
- 拖拽把手统一 → `DragOutlined`

---

## 4. 块手柄与块菜单

### 4.1 手柄 DOM（实测）
```html
<div class="menu-trigger bullet-menu-trigger has-drag-icon">   <!-- 表格为 .table-menu-trigger，高亮为 .callout-menu-trigger -->
  <div class="hover-drag-icon-wrapper">
    <div class="hover-block-type-icon-container">
      <span class="universe-icon menu_ud_icon"><svg data-icon="DisorderListOutlined">…</svg></span>
    </div>
    <span class="universe-icon drag-handle"><svg data-icon="DragOutlined">…</svg></span>
  </div>
</div>
```
- 位置：`position:fixed`，对齐到块左缘外侧（正文左缘约 -44px）。
- 尺寸 `42×26`，圆角 `6px`，底色 `rgb(41,41,41)`。

### 4.2 交互编排（时序）
1. 指针悬停块行 → 手柄**淡入**到手柄栏。
2. 指针移到手柄自身 → 手柄**保持**（命中桥接），不消失。
3. 点击**拖拽把手** → 打开块菜单；同时该块获得**蓝色整行选中底色**（`.docx-block-selected`）。
4. 菜单打开后，悬停带 `›` 的项 → **向右展开 flyout**（悬停展开，无需点击）。
5. 悬停菜单项 → `rgba(235,235,235,.08)` 底色即时反馈。
6. 点击外部 / Esc → 菜单淡出，选中底色消失。

### 4.3 块菜单完整清单（正文/列表上下文）
布局：`问问豆包` → 分隔线 → **转为图标网格** → 分隔线 → 面板项列表。

| 分组 | 项 | 图标 | 备注 |
|---|---|---|---|
| AI | 问问豆包 | 内联 Doubao 引号 logo | 行首 |
| 转为网格 | 正文 / 一级 / 二级 / 三级标题 / 有序 / 无序 | `TextOutlined` `H1Outlined` `H2Outlined` `H3Outlined` `OrderListOutlined` `DisorderListOutlined` | 第一行 6 个，默认选中当前型（蓝色底） |
| 转为网格 | 待办 / 代码 / 引用 / 高亮块 | `TodoOutlined` `CodeblockOutlined` `ReferenceOutlined` `CalloutOutlined` | 第二行 4 个 |
| 面板项 | 缩进和对齐 `›` | `TypographyOutlined` | 见 4.4 |
| 面板项 | 颜色 `›` | `StyleSetOutlined` | 见 4.5 |
| 面板项 | 评论 | `AddCommentOutlined` | |
| 面板项 | 剪切 / 复制 | `FeishuclipOutlined` / `CopyOutlined` | |
| 面板项 | 翻译 | `TranslateOutlined` | |
| 面板项 | 删除 | `DeleteTrashOutlined` | 危险色 |
| 面板项 | 分享 / 复制链接 | `SharewordsOutlined` / `BlocklinkOutlined` | |
| 面板项 | 在下方添加 `›` | `NewJoinMeetingOutlined` | |

### 4.4 「缩进和对齐」子菜单
`左对齐(✓) / 居中对齐 / 右对齐` + 分隔 + `增加缩进(带 ? 帮助) / 减少缩进`
图标：`LeftAlignmentOutlined` `CenterAlignmentOutlined` `RightAlignmentOutlined` `IncreaseIndentationOutlined` `ReduceIndentationOutlined`。

### 4.5 「颜色」子菜单
- **字体颜色**：一排 `A` 色板（默认 + 8 色）。
- **背景颜色**：两排共 16 格色板（首格为"无/透明"斜线格）。
- **恢复默认**：整宽按钮。
- 编码为 class-based 语义色（`color-b-500` 等）。

### 4.6 上下文差异（P4 实证）
| 块型 | 菜单差异 |
|---|---|
| 正文/列表 | 有 `颜色`、`翻译`；转网格 10 项 |
| 高亮块 | **无 `颜色`、无 `翻译`**；新增 `同步块`（`LinkRecordOutlined`）；转网格高亮当前型 |
| 表格 | 新增 `标题行`(开关) / `标题列`(开关) / `均分列宽` |

---

## 5. 斜杠插入菜单

### 5.1 触发与形态
- 编辑态输入 `/`（或中文 `、`）触发；菜单为**带分类标题的纵向列表**，顶部占位提示「输入关键词」。
- 每项 = 左图标 + 名称；当前项高亮。
- 继续输入进入**筛选**态。

### 5.2 分类与条目（实测 `data-name`）
| 分类 | 条目（图标） |
|---|---|
| **基础** | 文本 `TextOutlined` · 一级标题 `H1Outlined` · 二级标题 `H2Outlined` · 三级标题 `H3Outlined` · 有序列表 `OrderListOutlined` · 无序列表 `DisorderListOutlined` · 代码块 `CodeblockOutlined` · 引用 `ReferenceOutlined` · 分隔线 `DividerOutlined` · 链接 `GlobalLinkOutlined` |
| **常用** | 任务 `TodoOutlined` · 图片 `ImageOutlined` · 视频或文件 `AttachmentOutlined` · **表格 `DataSheetOutlined`** · 分栏 `DocColumnsOutlined` · 高亮块 `CalloutOutlined` · 同步块 `LinkRecordOutlined` · 公式 `LatexOutlined` · 打开超链接 `OpenHyperlinkOutlined` · 创建副本 `MakeACopyOutlined` · 关注文档更新 `FollowDocOutlined` |
| **数据** | 电子表格 `SheetTableOutlined` · 多维表格：表格 `BitablegridOutlined` / 看板 `BitablekanbanOutlined` / 甘特图 `BitableganttOutlined` / 画册 `BitablegalleryOutlined` / 关联已有多维表格 `BaseHomeColorful` |
| **绘图** | 画板 · 思维导图 `MindmapOutlined` · 流程图 `DrawioOutlined` · UML 图 `UmlOutlined` |
| **团队协作** | 任务清单 · 投票 · 日期提醒 · 信息收集 · 日程 · 会议议程 · 项目管理 · 视图 · 表格详情 · 卡片 |
| **进阶** | 网页卡片 · 倒计时 · 文档小组件 · HTML 块 · 目录导航 · 时间轴 · 文本绘图 |
| **更多小组件** | 内嵌网页 · 抖音 · 哔哩哔哩 · 优酷视频 · 爱奇艺 · 即梦 AI · Figma · 墨刀 · Canva · 码上掘金 · CodePen · 飞书问卷 · 金数据 · Airtable · 百度地图 · 高德地图 |

### 5.3 表格尺寸选择器（v2 重要修正）
「表格」项带 **`›`**；**悬停即展开尺寸选择器**，标题「**插入支持富文本的表格**」，内容是 **10×10 网格**（拖动/点击选行列数）。
- 直接点击「表格」不选尺寸 → 插入默认 **2 行 × 3 列**（v1 观察）；
- 悬停展开网格 → 可精确指定行列数（v2 修正）。

「分栏」项同样带 `›`，悬停展开「**选择栏数**」竖向条形选择器；「按钮」也有 `›`。

### 5.4 三个入口共用同一插入菜单（v2 发现）
下列入口打开的是**同一个插入菜单**（分类列表 + 可筛选，含上述尺寸选择器）：
1. 空行左侧悬停出现的 **「+」**（`AddOutlined`）；
2. 块菜单的 **「在下方添加 ›」**；
3. 输入 **`/`（或 `、`）**。

> 纠正 v1 的判断：插入菜单不是"斜杠专用"，而是"插入动作的统一入口"；三个入口只是触发方式不同。

---

## 6. 选区浮动工具栏

在**表格单元格选区**下实测到的工具条（`.docx-menu-container`，横排、`position:fixed`）：

| 序 | data-name | 图标 | 说明 |
|---|---|---|---|
| 1 | `ask-doubao` | Doubao logo | 问问豆包 |
| 2 | `MergeCell` | `MergecellsOutlined` | **合并单元格**（单选时禁用态 `menu-item-disabled`） |
| 3 | `TableCellBackgroundColor` | `StyleSetOutlined` | **单元格背景颜色**（`›` 子菜单：16 色 + 恢复默认） |
| 4 | `text turninto submenu` | `TextOutlined` `▾` | 转为 |
| 5 | `text align` | `TypographyOutlined` `▾` | 对齐 |
| 6 | `Bold` / `Strikethrough` / `Italic` / `Underline` / `inlinecode` | `BoldOutlined` / `HorizontalLineOutlined` / `ItalicOutlined` / `UnderlineOutlined` / `CodeOutlined` | 行内格式 |
| 7 | `highlight submenu` | `FontcolorOutlined` `▾` | 文字/高亮颜色 |
| 8 | `more` | `ToolbarMoreOutlined` | 更多 |
| 9 | `shareTextLink` / `comment` | `SharewordsOutlined` / `AddCommentOutlined` | 分享 / 评论 |

> 观察：纯块内小范围选区**未**弹出该工具条（`27-text-sel-toolbar.png` 中文本已选中但无浮层）。可见工具条的触发与"跨单元格/跨块"选区相关，具体条件需后续在可控环境复核。

---

## 7. 表格针对性功能（上一轮的明确缺口）

### 7.1 表格块菜单（`.table-equal-panel`）
| 分组 | 项 | 图标 | 备注 |
|---|---|---|---|
| AI | 问问豆包 | logo | |
| — | 缩进 `›` | `ToolIndentOutlined` | |
| 编辑 | 剪切 / 复制 / 删除 | `FeishuclipOutlined` / `CopyOutlined` / `DeleteTrashOutlined` | |
| 链接 | 分享 / 复制链接 | `SharewordsOutlined` / `BlocklinkOutlined` | |
| **表格专属** | **标题行** | `HeaderRowOutlined` | **开关**（`ud__switch-sm`） |
| **表格专属** | **标题列** | `HeaderColumnOutlined` | **开关** |
| **表格专属** | **均分列宽** | `DistributeColumnsOutlined` | |
| — | 在下方添加 `›` | `NewJoinMeetingOutlined` | |

### 7.2 滑入单元格 / 行列插入热点（v2 实测）
- **滑入单元格（未点击）**：表格任意处悬停 → 左上角表块手柄（`DataSheetOutlined` + `DragOutlined`）浮现；每列上方、每行左侧出现**淡色圆点**热点（`.table-insert-hotzone.docx-col` / `.docx-row`，内含 `.table-insert-point`）。
- **列热点悬停**：圆点变为**蓝色圆形「+」**（品牌蓝 `#547cff`）+ 气泡 **「插入列」** + 该**整列高亮**；点击在该列插入。
- **行热点悬停**：圆点变为**蓝色圆形「+」** + **横贯整行的蓝色分隔线** + 气泡 **「插入行」**；点击在该行插入。
- 全部为**悬停触发**，无点击召唤。

### 7.3 单元格：滑入即现的「格内手柄」→ 插入菜单（v3 修正）
- 单元格是独立块宿主：`td.block.docx-table_cell-block`。
- **滑入单元格（未点击）** → 在单元格**左侧线上**浮现「格内手柄」（`.menu-trigger.in-table-cell`）；图标为单元格内容的块型图标（空单元格为 **「+」** `AddOutlined`）。
- **悬停该手柄 → 展开「插入菜单」**（以用户提供的实图为准）：
  - **基础**（纯图标网格 12 项，无文字）：H1 / H2 / H3 / 有序 / 无序 / 待办 / 代码 / 引用 / 高亮块 / 同步块 / 分割线 / 链接；
  - **常用**（列表）：任务、图片、视频或文件、`分栏 ›`、高亮块、同步块、`按钮 ›`、公式；
  - **绘图**（列表）：画板、思维导图、流程图、UML 图；
  - **团队协作**（列表）：投票、日期提醒 …
- **纠正 v2**：v2 里把该菜单写成"块菜单（缩进和对齐 / 颜色 / 翻译…）"属**揣测**，与实图不符；已按实图改为"插入菜单"。教训：菜单内容必须按实图逐字核对，不得由别处菜单外推。

### 7.4 行/列插入锚点：在「单元格之间的线」上（v3 修正，v3.1 再修）
- 行插入「+」的锚点位于**两行之间的水平线**上（行的上边界，左端）；悬停出现蓝「+」+ **横贯单元格边界的蓝色横线** + 气泡「插入行」。
- 列插入「+」的锚点位于**两列之间的竖直线**上（列的左边界，顶端，实测 "+" 中心与列左边界偏差 −1px）；悬停出现蓝「+」+ 气泡「插入列」+ **沿边界的蓝色竖线**。
- **纠正**：v2/早期证据把列悬停写成"整列高亮"是**错的**——真实是沿边界的**一条竖线**，不是整列底色。（据此已把原型 C 的 `colhl` 整列底色改为 `.colline` 边界竖线。）

### 7.5 结论（回答"表格的图标里为什么要有表格专属功能"）
豆包的表格把能力分了两层：**块级**（表块菜单：标题行/列、均分列宽）与**单元格级**（选区工具栏：合并、背景色、对齐）。这两层都由"表格块型"这个上下文决定，所以**表格的图标（`DataSheetOutlined`）打开的是表格专属能力**，而不是通用块操作。上一轮只有通用菜单，因此用户体验为"表格没有表格功能"。

---

## 8. 高亮块 / 分栏 / 任务

### 8.1 高亮块（Callout）
- 插入默认：**🎉 emoji + 琥珀色实底**（`rgba(242,150,44,.28)`），整宽卡片。
- DOM：`.block.docx-callout-block` → `.docx-callout-block-container` → `.callout-block`；emoji 在 `.callout-emoji-container.emoji-for-bullet`。
- **emoji 点开 emoji-mart 选择器**（搜索 + 最近 + 表情符号分类 + 底部类目栏）。
- 上下文菜单见 4.6；**颜色/emoji 入口与块菜单分离**（这是待我们定夺的点：可合并到 `颜色` 二级）。

### 8.2 分栏
- 结构：`grid-render-unit` → `grid-column-block`（每栏一个）→ 内容块；两栏等宽。
- 斜杠入口为「分栏」`DocColumnsOutlined`；插入菜单里「分栏 ›」展开「**选择栏数**」条形选择器。
- **悬停效果（v3 修正）**：
  - **每一栏鼠标滑入都会出现「块手柄」**（与普通块一致：块型图标 + 拖拽把手），可对该栏内容做块级操作；
  - 栏间是**可拖拽的栏沟**：DOM 为 `.dragger`（2px）/ `.dragger-hot-spots`（12px 命中区），`cursor: col-resize`；**悬停高亮该竖线，按住可左右拖拽以改变栏宽**。v2 原型里把它做成静态线是错的。

### 8.3 任务 / 待办
- 复选框渲染为可点勾选（勾选后文字变灰）。
- 行尾悬停出现 `.docx-reminder-toolbar`，含 **「转为任务」**（`ChangeTodoOutlined`，class `to-task toolbar-btn`）。
- 块型为 `todo`（`data-block-type="todo"`）。

---

## 9. 差距分析：豆包 vs md-bundle 现状

> 现状来源：`packages/editor`（CodeMirror 6）源码审计 + 上一轮 `editor-doubao-parity`。

| 面 | 豆包 | md-bundle 现状 | 差距类型 |
|---|---|---|---|
| 块手柄 | 块型图标 + 把手药丸（42×26，粘性显隐，命中桥接，本体可再激活） | 有粘性显隐 + 块型图标（上一轮已做） | 形态接近；**图标词汇与悬停切换**需核对 |
| 块菜单 | 10 项转网格 + 上下文分型 + `›` flyout | 有图标化菜单 | **上下文分型**与**二级 flyout** 需补齐 |
| 斜杠菜单 | 7 大分类、30+ 条目、图标 + 分类标题、可筛选、`/`+`、` 双触发 | 上轮改为"图标网格 + 二级 flyout" | **与豆包形态不同**（豆包是分类列表）；条目覆盖不足 |
| 选区工具条 | 表格选区：合并 / 单元格背景 / 转为 / 对齐 / BISU / 代码 / 高亮 / 更多 | 有浮动工具条 + 双色板 + 整段转换 | 缺 **合并单元格**、**单元格背景**、**转为**子菜单结构 |
| 表格 | 表块菜单（标题行/列、均分列宽）+ 行列热点 + 单元格级操作 + 列宽拖拽 | 仅"插入列/行 + 单元格选中" | **最大缺口**：无标题行/列、无均分、无合并、无对齐、无背景、无删行列、无列宽 |
| 高亮块 | 卡片渲染 + emoji 选择器 + 类型/颜色 | `Decoration.replace` 卡片，内容 **纯文本**（不渲染内嵌 Markdown），无类型切换交互 | **渲染深度**与**编辑交互**均缺 |
| 分栏 | grid 布局 | fenced div `::: {.col-N}` + 工具栏选择器（1–5 栏） | 形态不同但能力接近；缺可视化预览与列宽 |
| 任务 | 可勾选切换 + 行尾「转为任务」 | block-model 识别 task；**编辑态可直接点击勾选**（上轮补） | 接近；缺行尾"转为任务"工具 |
| 图标系统 | `universe-icon` 全集 + 块型映射 | 图标零散（`▦` 等字符/简易 SVG） | **需建立统一图标表** |

### 9.1 上一轮"只学了毛"的根因（沉淀）
1. **只对齐了"有没有"，没对齐"像不像、顺不顺"**——功能在，但图标语义与交互编排缺失，用户第一眼就判定"不是那个东西"。
2. **表格被当普通块**——没有建立"块级 + 单元格级"两层表格能力，导致最该有的表格功能缺席。
3. **未区分形态**——斜杠菜单被改成图标网格，而豆包是分类列表；形态不对，手感即错。

---

## 10. 交互原型

可交互原型见 **`.lavish/doubao-editor-spec.html`**（Lavish 评审面）：包含
1. 块手柄 → 块菜单（含缩进/颜色二级 flyout、转为网格）；
2. 斜杠插入菜单（分类列表 + 筛选）；
3. **表格针对性功能**（表块菜单标题行/列开关、行列插入热点、单元格选区工具栏含合并 + 背景色）；
4. 设计 token 色板与尺寸标尺。

原型遵循豆包设计系统（深色、`#547cff`、6px 圆角、32px 行高、18px 图标），以便直接对照评审。
