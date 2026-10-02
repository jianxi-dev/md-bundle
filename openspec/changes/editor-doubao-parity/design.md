## Context

md-bundle 编辑器基于 CodeMirror 6，文档始终是 live Markdown 源码，编辑态通过装饰（decorations）+ 覆盖层（overlay）增强。当前已具备：块手柄（`block-handle`，hover-only 浮动 overlay）、选区浮动工具栏（`floating-toolbar`）、斜杠菜单（`slash`）、命令注册表（`commands`）与命令面板、高亮块装饰（`decorations/callout`，preview/edit 二态）、块模型（`block-model`，Lezer 顶层节点分类）。

对标豆包文档编辑态后确认的差距集中在：块手柄手感、工具条缺整段转换、斜杠菜单形态、表格无编辑态 widget、高亮块边界吞输入、分栏上限、缺缩进与视频/文件、快捷键过少。本设计定义这些能力在「源码为唯一真相」约束下的实现路径。

约束：
- 必须保持「live Markdown 源码」模型（ADR-0002），样式只编码进 HTML passthrough 或 Pandoc fenced div，不引入私有语法。
- `@md-bundle/renderer` 是渲染/消毒 SSOT，不得在其外重实现消毒或 PNG 栅格化。
- 编辑态与预览态共享 `readerCssText`，编辑态新样式不得破坏预览/导出。

## Goals / Non-Goals

**Goals:**
- 块手柄粘性常显、命中区可桥接、按块类型显示图标、空行有插入入口。
- 工具条提供整段转换（对多行整段生效）、弹出式双色板、移除字体选择器。
- 斜杠菜单图标网格化 + 二级 flyout + 可筛选；单键首字母码 + 二级码；触发键「/」「、」；命令面板网格。
- 编辑态表格预览态 widget + 单击编辑 + 悬停加行列 + 单元格内插入。
- 高亮块渲染态内联编辑、修复边界吞输入。
- 分栏 1–5 栏 + 可视化栏数选择器。
- 任务增/转/勾选、缩进/反缩进、视频/文件嵌入。
- 统一快捷键体系并可在命令面板查到。

**Non-Goals:**
- AI/翻译/协作类能力。
- CSS 块样式预设（本轮暂不做）。
- 同步块、多维表格/甘特图等重数据块。
- 多人协同光标与后端存储。

## Decisions

**D1. 块手柄从「浮动 overlay」改为「粘性显隐 + 命中桥接」。**
现状 `block-handle` 是挂在 `view.dom` 上的 20×20 overlay，`mousemove` 驱动显隐，经过空行/滚动即隐藏且无 `mouseenter` 找回。改为：以「当前悬停行所属块」为粘性目标，显隐由「指针是否仍在编辑区/手柄/菜单的联合区域」决定；在文本与手柄之间增加不可见命中桥（`::before` 扩展命中），并让手柄自身可 `mouseenter` 重新激活。手柄锚点从块首行改为悬停行。备选：改为 CM6 gutter 装饰——放弃，因为 gutter 会影响布局且难以做浮动菜单。

**D2. 手柄按块类型显示图标，前置扩展块模型。**
`block-model` 现无 heading 分级、无 task 类型。先扩展 `BlockType`（heading level、task/checkbox），手柄与菜单读取 `block.type`+level 渲染图标。备选：在渲染层从原始文本 regex 推断——放弃，重复解析且与 Lezer 不一致。

**D3. 整段转换（turn-into）作为工具条主控件，作用于整个块（含多行）。**
现 `computeBlockConvert` 只改首行。新增「整段转换」命令：对块的每一行重写块标记（标题/列表/任务/引用/代码/高亮/表格），在单次最小变更事务内完成。工具条加入该控件并移除字体控件。备选：复用现有手柄菜单——不满足「工具条主位」诉求，且用户要求选部分文字也作用于整段。

**D4. 颜色改为弹出式双色板，仍编码为 class-based HTML。**
沿用 `<span class="mdb-color-*">` 与新增 `mdb-bg-*`；弹出面板提供字体色/背景色两组 + 恢复默认。渲染器 `readerCssText` 补齐两组样式并保证消毒存活。移除字体控件后 `mdb-font-*` 规则保留（兼容历史文档）但不再有入口。

**D5. 斜杠菜单：图标网格 + 二级 flyout + 筛选 + 单键/二级码。**
`SlashCommand` 扩展为可声明 `code`（单键）与 `children`（二级）/`builder`。菜单渲染改为分组图标网格；二级项以 flyout 展开；打开后允许继续输入以筛选/命中码（需解除现有「任何 docChanged 即关闭」的限制，改为「输入非码字符不关闭」）。触发：`/` 与 `、`；命令面板（`Mod-K`）复用同一命令注册表并网格渲染，展示快捷键与简介/样式预览。

**D6. 表格改为编辑态 widget（预览态呈现）。**
新增表格装饰：把 GFM 表格块渲染为预览态表格 widget，单击单元格把光标映射到源码单元格并进入可编辑；行列插入用悬停热点（列上方/行左侧「＋」）；单元格内允许调用插入菜单（插入块到该单元格内容）。源码仍是真相，widget 是装饰；光标进入单元格时该单元格露源码或提供等价编辑桥。备选：完整所见即所得表格——放弃，违背 live-source 模型且成本过高。

**D7. 高亮块改为渲染态内联编辑，移除整块 replace+inclusive 二态。**
现 `Decoration.replace({inclusive:true})` 导致光标到 `block.to` 时被 widget 吞输入（#236 残留）。改为：渲染态卡片节点内部可编辑（`contenteditable` 桥接到源码），不再用整块 replace 遮蔽；删除 `inclusive` 边界策略。

**D8. 分栏扩展到 1–5 栏 + 可视化选择器。**
`toggleBlockColumns` 类型从 `col-2|col-3` 扩到 `col-1..col-5`；渲染器 `resolveWrapper`/`readerCssText` 补齐 `.layout-col-4/5`；工具条「分栏」改为弹出网格选择器（横杠/图形）。

**D9. 块级能力：任务/缩进/视频文件。**
- 任务：新增 `insert-task` 与 `convert-to-task`（后者走整段转换），复选框装饰改为可点击切换源码 `- [ ]`/`- [x]`。
- 缩进：新增 `indent-block`/`outdent-block` 命令（列表层级），Tab/Shift-Tab 在非标题行改用之。
- 视频/文件：设计 `![name](file.ext)` 之外的引用语法（如 `[file](name.ext)` 链接或 `<video>` passthrough），并与 `@md-bundle/renderer` 消毒白名单和安全策略一并决策；具体语法在实现票中定稿，设计只锁定「允许 + 消毒边界由 renderer 决定」。

**D10. 快捷键体系。**
行内 Markdown 快捷（`# ␣` 等）+ 功能键（`⌘/Ctrl+Alt+1..6` 标题、`⌘/Ctrl+⇧7/8/9` 列表/任务、`⌘/Ctrl+⇧C` 代码块等）+ 斜杠码；冲突规则：`Mod-K` 归命令面板（链接用 `⇧L`），`⌘M` 不用。

**D11. 测试接缝。**
最高接缝 = `apps/web/test/*.spec.ts`（e2e，真实按键 + 计算样式断言）；单元接缝 = `@md-bundle/editor` 公共 API（驱动真实 keymap/事件，禁止调内部函数）。不新增私有接缝。

## Risks / Trade-offs

- [表格 widget 与 live-source 冲突] → 保持源码为真相，widget 只做装饰；光标进入单元格时提供源码桥；用 e2e 覆盖「单击→编辑→源码同步」。
- [块手柄粘性导致遮挡内容] → 仅在编辑区 hover 时出现，且提供命中桥而不扩大视觉体积；e2e 断言不遮挡文本可点区域。
- [解除斜杠菜单 docChanged 关闭会引入输入法/组合态问题] → 保留 IME 守卫，仅对「码字符」放行；e2e 覆盖中文 IME 场景。
- [视频/文件嵌入扩大消毒面] → 交由 `@md-bundle/renderer` 单点决策，白名单最小化；安全回归测试随票。
- [整段转换对多行块的语义歧义（列表内嵌套）] → 先限定为「非嵌套块」并补测试；嵌套作为 open question。
- [改动面大] → 按 A–H 垂直切片拆票，每票可独立演示、独立 e2e，按依赖 frontier 推进。

## Migration Plan

- 无数据迁移：源码格式不变；新增能力均通过既有 HTML passthrough / fenced div / Markdown 语法表达。
- 兼容：历史 `mdb-font-*` 文档仍正常渲染（保留 CSS 规则），只是不再有字体入口。
- 回滚：各能力独立成票、独立 PR；如需回滚按票 revert，不影响文档格式。

## Open Questions

- 视频/文件嵌入的最终语法与消毒边界（留待 `editor-block-types` 实现票定稿）。
- 表格 widget 中「单元格内插入块」在源码层的表达（多行单元格 / 嵌套块）。
- 整段转换对嵌套列表/引用内部的转换范围定义。
