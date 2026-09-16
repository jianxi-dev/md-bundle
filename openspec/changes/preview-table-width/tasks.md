## 1. CSS 修改

- [ ] 1.1 修改 light 主题表格宽度规则：将 `width: max-content; min-width: 100%` 改为 `width: 100%`（readerCss.ts light 主题表格规则）
- [ ] 1.2 修改 light 主题单元格换行规则：为 `th, td` 添加 `overflow-wrap: anywhere`（readerCss.ts light 主题 th/td 规则）
- [ ] 1.3 修改 dark 主题表格宽度规则：将 `width: max-content; min-width: 100%` 改为 `width: 100%`（readerCss.ts dark 主题表格规则）
- [ ] 1.4 修改 dark 主题单元格换行规则：为 `th, td` 添加 `overflow-wrap: anywhere`（readerCss.ts dark 主题 th/td 规则）

## 2. 测试

- [ ] 2.1 新增 CSS 规则断言测试：验证 readerCssText 中表格 `width: 100%` 和 `overflow-wrap: anywhere` 存在（packages/renderer/test/）
- [ ] 2.2 运行现有渲染测试确认无回归（pnpm -r test）
- [ ] 2.3 运行 typecheck 和 lint 确认代码质量（pnpm -r typecheck && pnpm -r lint）
