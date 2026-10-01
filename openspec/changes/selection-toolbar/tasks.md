## 1. 选区浮条：数据驱动 + 基础内联格式

- [ ] 1.1 `floating-toolbar.ts` 改为从 `commandRegistry` 渲染（按钮 + 下拉两种形态），并补齐 加粗 / 斜体 / 删除线 / 下划线（`<u>`）/ 行内代码 / 链接 / 复制；再次点击同一样式 = 移除（切换）；e2e 覆盖

## 2. 内联样式：字体 + 颜色

- [ ] 2.1 新增「字体」（sans/serif/mono）与「颜色」（5 色）下拉：选中文本插入 `<span class="mdb-*">`；`readerCssText` 补 `.mdb-font-*` / `.mdb-color-*`（深/浅）；活动态装饰隐藏标签并按样式呈现；e2e 覆盖（含预览/导出保真）

## 3. 块级样式：对齐

- [ ] 3.1 新增「对齐」（左/中/右）：以 `::: {.align-*}` fenced div 包裹当前块；`readerCssText` 补 `.layout-align-*`；活动态行装饰体现对齐；再次点击移除；e2e 覆盖

## 4. 块级样式：分栏

- [ ] 4.1 新增「分栏」（2/3 栏）：插入 `::: {.col-2}` / `::: {.col-3}`；`readerCssText` 补 `.layout-col-2/3`（及 `layout-card-grid[data-columns]`）样式（**当前完全缺失**）；e2e 覆盖
