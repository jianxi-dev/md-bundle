## Why

上一轮 `editor-fidelity` 交付后（16/16 全绿、CI 全绿、已归档），用户打开页面即见 **约 31 处与豆包原型不符**。根因三重失效：**① 规格（原型）从未被翻译成可证伪断言**；**② 测试以「实现自身行为」为断言对象，把偏差写成预期**；**③ 截图对照管控「有定义、无机检、靠自证」**。本 change 承接 spec issue #320，以原型 token / 图标表 / 几何 / hover 门控为可证伪判据，把 31 项偏差按「面」补齐，并以本 change 作为新 CW 门禁（机检截图、多模态复核、原型一致性测试层、conformance.json）的**验收靶场**。

## What Changes

- **图标系统（SSOT）**：建立「块型→图标」「动作→图标」统一 SVG 映射表（`data-icon` 命名 ∈ 豆包规格），替换零散字符/简易 SVG；手柄/菜单/斜杠/工具条/命令面板全站统一。
- **块手柄**：从 `20×20` 单图标改为 **42×26 两段药丸**（左块型图标 + 右拖拽把手）；图标随块型即时切换（表格→`DataSheetOutlined`、列表→`DisorderListOutlined`、高亮→`CalloutOutlined` 等）。
- **块菜单**：宽 **236px** / 行高 **32px** / 顶端对齐块顶；「转为」网格 **10 项**（正文/一级/二级/三级/有序/无序/待办/代码/引用/高亮）；**按块型裁剪**（表格加 标题行/标题列/均分列宽；高亮去颜色/翻译、加同步块）；补「在下方添加›」入口；动作项集对齐豆包（评论/剪切/复制/翻译/删除/分享/复制链接/在下方添加）。
- **插入菜单**：**反转 editor-fidelity 的网格形态**，回归豆包**分类列表**（基础/常用/数据/绘图/团队协作/进阶/更多小组件）；三入口共用（空行「+」/ 块菜单「在下方添加›」/ `/` 与 `、`）；表格›10×10 尺寸选择器、分栏›栏数选择器**悬停即展开**；斜杠 code 语义修正 `/fN`（原 `/flN`）。
- **表格**：行/列热点改为 **hover 门控的边界蓝「+」**（贴格间线、气泡提示、边界高亮线）；**隐形 6px 边界层不再覆盖单元格内部**（点击中心落光标不插行）；补**格内手柄→插入菜单**；块菜单含表格专属三项开关。
- **色板**：统一「字体色 A×8（默认+7 色，原型机读值）+ 背景色×16（首格无/斜线）+ 恢复默认」；块菜单与浮动工具条共用同一实现与色值。
- **高亮块**：callout 类型二级选项**去重**（提示/注意/摘要/总结/成功/完成等语义近重项合并）；补 **emoji 选择器**。
- **命令面板**：行高 **32px** / 间距 4 的倍数 / 字号 **12px** / padding 对齐 token。
- **交互编排**：统一「离开整栈即收 + 视口夹取/翻转 + 滚动消退 + 展开缓冲」；消除 retarget 重开；手柄显示延迟/位移阈值。
- **编辑基底**：编辑态 `.cm-editor` 底色 = 预览态 `.preview-content` 底色（同 paper token）。

## Capabilities

### New Capabilities

- `editor-design-tokens`: 设计 token 台账（色彩/间距/圆角/字阶/阴影/图标尺寸）+ 图标命名规范（`data-icon` 命名表）+ conformance.json 一致性制品 + baseline 哈希锁定。

### Modified Capabilities

- `block-editing-entry`: 手柄 42×26 两段药丸 + 图标随块型切换 + 悬停延迟/位移阈值 + 空行「+」同 gutter；块菜单 236/32/10项/上下文分型/顶端对齐/动作项集/在下方添加›。
- `editor-insert-menu`: 三入口共用分类列表 + 表格›/分栏›悬停展开 + `/fN` code 语义 + 空态可退出 + 取消无残留。
- `editor-table-editing`: 行/列 hover 热点贴边界 + 蓝「+」气泡 + 边界高亮线；边界层不遮编辑；格内手柄→插入菜单；块菜单表格专属三项。
- `editor-callout-editing`: 类型二级去重 + emoji 选择器；高亮块菜单上下文分型（无颜色/翻译、加同步块）。
- `selection-toolbar`: 字体色 A×8 色板 + 背景色 16 色板 + 恢复默认；色值对齐原型；与块菜单颜色子菜单统一实现。
- `editor-shortcuts`: 命令面板行高 32px / 字 12px / 4 倍数间距；块菜单动作项显示产品自有快捷键（或按豆包不显）。

## Impact

- **`packages/editor`**：`block-handle*.ts`、`icons.ts`、`slash.ts`、`command-palette-dom.ts`、`empty-line-entry.ts`、`decorations/{table,callout,columns}.ts`、主题 token、图标注册表。
- **`packages/renderer`**：`calloutTypeMap` 去重导出；无导出语义变更。
- **`apps/web`**：编辑器扩展注册接线；编辑基底样式接入预览 paper token。
- **e2e / 单测**：新增 `apps/web/test/*.spec.ts`（QG-2，每用户可见变更绑定）；`packages/editor` Vitest 单测覆盖 token/图标/几何/hover 门控断言。
- **验收制品**：`openspec/changes/editor-fidelity-2/conformance.json` + `baseline/` 截图哈希；CI 三层核验（T1 确定量 vs conformance / T2 感知 vs baseline / T3 状态机）。
- **不做**：分享/协作/同步块/多维表格族/团队协作块/进阶小组件/AI 类；三模式工作区、多页签、FSA、主题三态、邀请链接不动。C-01（CW 门禁）由 CW 工具包侧维护，本 change 仅验证新门禁可机检。