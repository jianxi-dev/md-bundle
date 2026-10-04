# editor-fidelity-2 设计决策

> 来源：`docs/doubao-editor-study/ui-gap-and-target.md` §2–§6、§7（31 项索引）+ `docs/agents/cw-fidelity-verified-defects.md` §1（实测证据与验收判据）+ `.lavish/doubao-editor-spec-v2.html`（原型机读值）。

---

## D1 图标表作为 SSOT（Single Source of Truth）

**现状**：`icons.ts` 混合注册表（H1/¶/A 用文字字形、部分 SVG）、命名≠规格（`ListOutlined≠DisorderListOutlined`、`TableChartOutlined≠DataSheetOutlined`、无 `DocColumnsOutlined`/`CalloutOutlined`/`DragOutlined`/`AddOutlined`/`HeaderRowOutlined`/`HeaderColumnOutlined`/`DistributeColumnsOutlined`/`TypographyOutlined`/`StyleSetOutlined`/`NewJoinMeetingOutlined`/`FeishuclipOutlined`/`CopyOutlined`/`DeleteTrashOutlined`/`TranslateOutlined`/`SharewordsOutlined`/`BlocklinkOutlined`/`GlobalLinkOutlined`/`FontcolorOutlined`/`LinkRecordOutlined`/`AddCommentOutlined`/`CheckboxOutlined`/`DragOutlined`/`TodoOutlined`/`CodeblockOutlined`/`ReferenceOutlined`/`DividerOutlined`/`H4Outlined`–`H6Outlined`/`OrderListOutlined`/`DataSheetOutlined`/`DocColumnsOutlined`/`DividerOutlined`/`CheckboxOutlined`/`DragOutlined`/`AddOutlined`/`HeaderRowOutlined`/`HeaderColumnOutlined`/`DistributeColumnsOutlined`/`TypographyOutlined`/`StyleSetOutlined`/`NewJoinMeetingOutlined`/`FeishuclipOutlined`/`CopyOutlined`/`DeleteTrashOutlined`/`TranslateOutlined`/`SharewordsOutlined`/`BlocklinkOutlined`/`GlobalLinkOutlined`/`FontcolorOutlined`/`LinkRecordOutlined`/`AddCommentOutlined`）。

**目标**：建立 `ICON_MAP: Record<BlockType | Action, string>` 统一映射表，键为块型/动作语义，值为豆包规格 `data-icon` 名（§3.2 表 + §4.3/§4.5/§5.2/§6/§7.1/§8.1/§8.2 图标集）。全站（手柄/块菜单/斜杠菜单/浮动工具条/命令面板/表格/高亮块/分栏）均从此表取图标，渲染为 `<svg data-icon="XxxOutlined" viewBox="0 0 24 24" fill="currentColor">`。

**验收锚点**：`R-03`（conformance.json）。

---

## D2 块手柄 = 42×26 两段药丸

**现状**：`block-handle-dom.ts:436-437` 单 `20×20` 图标 div `.mdb-block-handle`；定位 `contentLeft - r.left - 22`；`blockHandleIcon()` 返回 `H1–H6Outlined`/`TaskAltOutlined`/`CheckBoxOutlineBlankOutlined`/`FormatQuoteOutlined`(blockquote AND callout)/`CodeOutlined`/`ListOutlined`/`TableChartOutlined`/`HorizontalRuleOutlined`/`ImageOutlined`/`CodeOffOutlined`/`DragHandleOutlined`(paragraph)；`setIcon()` 在 `showHandleAt()` 调用。

**目标**：手柄 DOM 结构：
```html
<div class="mdb-block-handle" style="width:42px;height:26px;border-radius:6px;border:1px solid var(--border-soft);display:flex;align-items:center;padding:0 3px;gap:0">
  <span class="mdb-block-type-icon" style="width:22px;height:22px;font-size:18px"><svg data-icon="…"></svg></span>
  <span class="mdb-drag-handle" style="width:16px;height:22px;font-size:12px"><svg data-icon="DragOutlined"></svg></span>
</div>
```
- 左段：块型图标（`ICON_MAP[blockType]`），18px，`22×22`。
- 右段：拖拽把手（`DragOutlined`），12px，`16×22`。
- 定位：`left: 0; top: 2px`（相对块左缘外侧 gutter）。
- 显隐：悬停块行淡入；悬停手柄自身保持（命中桥接）；**延迟/位移阈值**后才展开菜单（消除 F-05）。

**验收锚点**：`R-01`（42×26）、`R-02`（data-icon 命中映射表）、`R-04`（悬停文本不弹菜单、悬停手柄才弹）。

---

## D3 块菜单 token：236px / 32px / 12px + 10 项转为网格 + 上下文分型

**现状**：`block-handle-dom.ts` 菜单 `minWidth: 144px`、项高 ~28px、字 13px；`MENU_CONVERT` 仅 7 项（H1–H6+¶）；无上下文分型（表格块菜单=正文块菜单、高亮块菜单含颜色/翻译）；缺「在下方添加›」；动作项仅 6 项；菜单定位 `handleRect.right + 8, handleRect.top` → 在块上方 25px（U-09）。

**目标**：
- 容器：`min-width: 236px; padding: 5px; font-size: 13px; border-radius: 6px; box-shadow: rgba(0,0,0,.28) 0 8px 16px; background: var(--surface)`。
- 项：`height: 32px; padding: 0 8px; gap: 9px; border-radius: 4px; font-size: 12px`；hover 底色 `rgba(235,235,235,.08)`。
- 结构：`问问豆包` → 分隔线 → **转为网格 10 项**（两行：`TextOutlined` `H1Outlined` `H2Outlined` `H3Outlined` `OrderListOutlined` `DisorderListOutlined` / `TodoOutlined` `CodeblockOutlined` `ReferenceOutlined` `CalloutOutlined`），当前型蓝底 `var(--brand-soft)` → 分隔线 → 面板项列表。
- **上下文分型**（按 `blockType` 裁剪）：
  - 正文/列表：含 `颜色›` `翻译` `评论` `剪切` `复制` `删除` `分享` `复制链接` `在下方添加›`。
  - 高亮块：**无 `颜色›` `翻译`**；新增 `同步块`（`LinkRecordOutlined`）。
  - 表格：新增 `标题行`(开关 `HeaderRowOutlined`) / `标题列`(开关 `HeaderColumnOutlined`) / `均分列宽`(`DistributeColumnsOutlined`)。
- 定位：菜单顶端 `y ≈ block.y`（±2px）；视口夹取/翻转（U-03）。

**验收锚点**：`R-05`（宽 236）、`R-06`（项高 32/字 12）、`R-07`（转为网格 10 项 data-icon）、`R-08`（表格块菜单含三项开关）、`R-09`（高亮块菜单无颜色/翻译、有同步块）、`R-10`（菜单 y≈块 y）、`R-11`（动作项集含评论/剪切/复制/翻译/分享/复制链接/在下方添加）。

---

## D4 插入菜单：反转为分类列表 + 三入口共用 + /fN code

**现状**：`slash.ts` 单列图标网格 + 二级 flyout（`renderRootGrid` L463），`minWidth 224px`，图标为文字字形（`cmd.icon` 字符串 L518-525），`columnCount()` 用 `code: 'fl'+count` 导致 `/f3` 不匹配；flyout 仅 `ArrowRight`/hover 触发；无「在下方添加›」入口；`empty-line-entry.ts` 空行「+」20×20 同 gutter。

**目标**：
- 形态：**分类纵向列表**（`renderCategoryList` 替代 `renderRootGrid`），分类标题（基础/常用/数据/绘图/团队协作/进阶/更多小组件），每项 = 图标 + 名称，当前项高亮。
- **三入口共用同一 `.mdb-slash-menu`**：空行「+」hover / 块菜单「在下方添加›」hover / 输入 `/` 或 `、`。
- 二级：表格项 `›` 悬停展开 10×10 尺寸选择器（标题「插入支持富文本的表格」）；分栏项 `›` 悬停展开栏数选择器；按钮项 `›` 同理。**悬停即展开，无需点击/ArrowRight**。
- Code 语义：`columnCount()` 返回 `code: 'f'+count` → `/f3` 命中 3 栏。
- 图标：全部改用 `ICON_MAP` SVG（`data-icon`）。
- 空态：筛选无匹配显示「无匹配项」，可 Esc 退出，不残留空盒。
- 取消：Esc / 外部点击 / 光标移走 → 关闭且**文档无 `/`、`、` 残留**。

**验收锚点**：`R-12`（三入口同一菜单）、`R-13`（分类列表形态）、`R-14`（表格›/分栏›悬停展开）、`R-15`（`/f3` 命中）、`R-16`（取消无残留）、`R-17`（空行「+」与手柄同 gutter x 差 < 2px）。

---

## D5 表格：hover 门控边界热点 + 边界层不遮编辑 + 格内手柄

**现状**：`decorations/table.ts` `BOUNDARY_THICKNESS = 6`；边界层 `.cm-table-boundary` `position:absolute; pointerEvents:auto; zIndex:5` 覆盖单元格 → 吞点击（F-04）；行「+」`10×10@x158` 进首格、与行边界错位 ~27px；列「+」`467×12` 整条横杠、常显无 hover 门控；无格内手柄→插入菜单；块菜单无表格专属项。

**目标**：
- **边界热点重构**：行热点 = 两行间水平线左端的圆点（`width: 12px; height: 12px; border-radius: 50%`），默认透明，**hover 单元格才显现** → 蓝「+」(`var(--brand)`) + 气泡「插入行」+ 横贯单元格边界的蓝线；列热点 = 两列间竖线顶端圆点，hover → 蓝「+」+ 气泡「插入列」+ 沿边界的蓝竖线。
- **边界层不覆盖单元格内部**：`pointerEvents: none` 于单元格中心区域；仅在贴近边界（≤8px）且 hover 时 `pointerEvents: auto` 接管指针。
- **格内手柄**：滑入单元格左侧线浮现 `.mdb-table-cell-handle`（图标 = 单元格内容块型图标，空单元格为 `AddOutlined`）；悬停该手柄 → 展开**插入菜单**（复用 D4 同一菜单实例）。
- 块菜单补 `标题行`/`标题列`(开关) / `均分列宽`。

**验收锚点**：`R-18`（hover 单元格才现「+」）、`R-19`（行+ y≈行边界 ±2px / 列+ x≈列边界 ±2px）、`R-20`（点击单元格中心 → 光标落入、不插行/列）、`R-21`（格内手柄悬停→插入菜单）、`R-22`（块菜单含三项开关）。

---

## D6 色板：A×8 字体色（默认 + 7 色，原型机读值）+ 16 背景色 + 恢复默认（统一实现）

**现状**：块菜单 color flyout = 5 文字项（红/蓝/绿/橙/紫 + 恢复默认）；工具条 = `字体色 AAAAA` + `背景色 恢复默认`（A 字形但色值不符）；两套实现未统一。

**目标**：
- **字体色**：一排 8 格（默认透明 + 7 色），`.swatches { grid-template-columns: repeat(8, 18px) }`，每格渲染彩色「A」（`font-size: 15px; font-weight: 600; color: <token>`），默认格显示斜线透明底。
- **背景色**：两排 16 格（首格无/斜线 + 15 色），同尺寸色块。
- **色值（原型机读）**：
  - 字体色 8 色：`#ebebeb` `#f0000e` `#f2962c` `#f0b622` `#419e34` `#20b2aa` `#4c88ff` `#8a5cf6`。
  - 背景色 15 色：`#f0000e` `#f2962c` `#f0b622` `#419e34` `#20b2aa` `#4c88ff` `#8a5cf6` `#ebebeb` `#b34444` `#845117` `#877b10` `#296b22` `#203e78` `#4d2691` `#5f5f5f`。
- **恢复默认**：整宽按钮 `height: 30px`。
- 块菜单 `颜色›` 与浮动工具条颜色按钮**共用同一子菜单组件**。

**验收锚点**：`R-23`（字体色 8 格含默认 + 7 色值精确）、`R-24`（背景色 16 格色值精确）、`R-25`（块菜单与工具条共用组件）。

---

## D7 高亮块：callout 类型去重 + emoji 选择器

**现状**：`packages/renderer/src/markdown.ts` `CALLOUT_TYPE_MAP` 含重复 label（`tip`/`hint` 皆「提示」、`caution`/`attention` 皆「注意」等）；编辑器 flyout (`block-handle-dom.ts:105`) 直接映射 → 重复项显示；无 emoji 选择器。

**目标**：
- **显示层去重**：`CALLOUT_TYPE_MAP` 保留渲染别名（向后兼容），编辑器侧导出 `CALLOUT_EDIT_TYPES = [{key, label, emoji, bg}]` 去重后的编辑型集合（按豆包：`note`/`abstract`/`info`/`todo`/`tip`/`success`/`question`/`warning`/`failure`/`danger`/`bug`/`example`/`quote`，共 13 项，label 唯一）。
- **emoji 选择器**：高亮块标头 emoji 点击 → 弹出 emoji-mart 选择器（搜索 + 最近 + 分类 + 底部类目栏），选中后更新块属性 `data-callout-emoji`。

**验收锚点**：`R-26`（flyout label 集合无重复）、`R-27`（emoji 选择器可打开并选中）。

---

## D8 命令面板 token 对齐

**现状**：`command-palette-dom.ts:57` `createPaletteRow` 行高 42px、gap 12px、padding `0 10px`、label font 14px、desc 12.5px。

**目标**：行高 **32px** / gap 4 的倍数（如 8px） / padding `0 8px` / label font **12px** / desc 11px / 图标 18px；整体间距阶梯全为 4 的倍数。

**验收锚点**：`R-28`（item h=32）、`R-29`（gap∈4 倍数）、`R-30`（font=12px）。

---

## D9 交互编排：离栈即收 + 视口夹取/翻转 + 滚动消退 + 展开缓冲

**现状**：菜单打开后不随指针离开消退（父菜单常驻），对指针所在块 retarget 重开（U-07）；手柄与文本仅 2px 过早弹菜单（F-05）；滚动不消退（F-07）；近底部块菜单不弹出、手柄锚定错位 y=-277（U-03）。

**目标**：
- **离栈即收**：指针离开「手柄 + 菜单 + 所有 flyout」的合并命中区 → 全部 `display: none`；删除 `onMouseMove` 中 `menuOpen` 分支的 retarget 重开逻辑。
- **视口夹取/翻转**：菜单定位计算 `menuRect = {top: blockTop, left: handleRight + 8}`；若 `menuRect.bottom > innerHeight` → `top = innerHeight - menuHeight - 8`（向上翻转）；若 `menuRect.right > innerWidth` → `left = handleLeft - menuWidth - 8`（向左翻转）。
- **滚动消退**：编辑器 `scroll` 事件 → 立即 dismiss 手柄/菜单/flyout（`display: none`）。
- **展开缓冲**：悬停块行 → 手柄淡入（~80ms）；**悬停手柄自身 ≥120ms 或位移 ≥8px 后**才 `openMenu()`；消除与文本 2px 贴边导致的过早弹出。

**验收锚点**：`R-31`（指针离栈 → 菜单+flyout 均消失）、`R-32`（近底部块菜单完整落在视口内）、`R-33`（滚动 → 手柄/菜单消失）、`R-34`（悬停文本不弹菜单、悬停手柄延迟后弹）。

---

## D10 编辑基底 = 预览基底（同 paper token）

**现状**：编辑 `.cm-editor` 背景 `#fff`（硬编码），预览 `.preview-content` 背景 `#fbfaf8`（paper token）。

**目标**：编辑态内容区套用与预览同源的 CSS 变量 `--paper-bg`（或 `--bg-canvas`），使 `getComputedStyle(.cm-editor).backgroundColor === getComputedStyle(.preview-content).backgroundColor`。主题三态（跟随系统/深/浅）下均保持一致。

**验收锚点**：`R-35`（编辑背景色 === 预览背景色，state-machine）。

---

## D11 一致性制品：conformance.json + baseline + e2e 断言骨架

**现状**：无原型一致性测试层；测试固化偏差（如 `block-handle-icon.spec.ts` 断言段落→`DragHandleOutlined` 为正确）。

**目标**：
- `conformance.json`：机读锚点（每 requirement ≥1 anchor，含具体期望值 + 来源 + 断言类型 `exact|state-machine|perceptual`）。
- `baseline/`：从原型程序化生成的参考截图（手柄/菜单/插入菜单/表格热点/色板/高亮块/命令面板/编辑基底），哈希锁定入库。
- e2e 断言骨架：`apps/web/test/fidelity/*.spec.ts` 覆盖 token/图标/几何/hover 门控/状态机断言。
- CW 消费侧接线：`.gitignore` 白名单 `state-coverage.json`；`.change-workflow.conf` 增 `LABEL_UI_SURFACE`/`UI_PATH_GLOB`/`CMD_FIDELITY`。

**验收锚点**：`R-36`（conformance.json 通过 `cw-tickets-check.sh` 机检）、`R-37`（baseline 截图哈希锁定）、`R-38`（e2e 断言骨架存在且可跑通）。

---

## 依赖图

```
D1 (图标表) → D2 (手柄) → D3 (块菜单) → D4 (插入菜单)
                    ↘ D5 (表格) ← D4
                    ↘ D6 (色板)
                    ↘ D7 (高亮块)
                    ↘ D8 (命令面板)
D2 → D9 (交互编排)
D10 (编辑基底) 独立
D11 (制品) 独立，供所有票消费
```