## 1. 斜杠菜单：分组 + 标题二级 + 边界自适应

- [x] 1.1 斜杠菜单按分组渲染 + 「标题」二级浮层（H1–H6，选择即插入）+ 右/下边界 clamp 与溢出滚动；e2e 覆盖

## 2. 斜杠菜单：表格网格选择器

- [x] 2.1 「表格」二级网格选择器（hover 显示 N×M）插入 GFM 管道表格；e2e 覆盖

## 3. 块手柄菜单：上移 / 下移

- [x] 3.1 块手柄菜单增「上移 / 下移」（复用 `computeBlockMove` + `computeMinimalChange`）；e2e 覆盖

## 4. 标题级别控件 + Backspace 降级

- [x] 4.1 活动标题行可编辑（不再 replace `# ` marker）+ 块手柄菜单 H1–H6 切换 + Backspace 降级/清除；e2e 覆盖
