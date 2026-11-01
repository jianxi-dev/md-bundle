# 视觉回归基线（#500）

**最后更新：2026-11-01**

## 为什么有这一层

2026-10 的一批显示类缺陷（菜单位置、图标词汇、表格圆点、callout 光标、图片尺寸）全部是
「DOM 断言全绿、肉眼不对」。究其原因：断言写的是结构（元素存在、数量、属性），而不是
用户看到的东西。这层基线把稳定下来的界面**拍成像素**，任何改动只要改变了像素，就必须
有人确认。

## 怎么跑

```bash
# 日常校验（默认跳过；只有 VISUAL=1 才跑）
VISUAL=1 pnpm --filter @md-bundle/web exec playwright test test/visual-baseline.spec.ts

# 有意改样式后重建基线（本机平台）
VISUAL=1 pnpm --filter @md-bundle/web exec playwright test test/visual-baseline.spec.ts --update-snapshots
```

失败时 Playwright 会在 `apps/web/test-results/` 下产出 `-actual / -expected / -diff.png`
三件套，作为评审证据贴到 PR 上。

## 覆盖的界面

| 文件 | 保护的行为 |
|---|---|
| `01-table-rest.png` | 表格左上角圆点静止态（12px 空心圆，位于表头上方） |
| `02-table-anchor-hover.png` | hover 后圆点变 ＋ |
| `03-cell-insert-menu.png` | 单元格插入面板：贴着手柄、分组、17 项、图标不乱码 |
| `04-block-menu.png` | 块菜单：每行有图标、左内边距一致 |
| `05-insert-flyout-panel.png` | 「在下方添加」二级面板：图标 + 文案 |
| `06-callout.png` | callout 头部只有 emoji、正文渲染正常 |
| `07-toolbar.png` | 选中工具栏图标齐全 |
| `08-columns.png` | 分栏边框与内边距 |

## 基线为什么按平台分目录

字体栅格化在 macOS 与 Linux CI 镜像之间不同，同一张基线无法同时服务两边。
`snapshotPathTemplate` 用 `{platform}` 分目录（`darwin/`、`linux/`）。

## 为什么默认不跑

现在只有 macOS 基线。若让 CI 强跑，Linux 会因字体差异全红，把真正的缺陷淹掉。
**要开 CI 门禁，先补齐 Linux 基线**（在 CI 镜像里跑一次 `--update-snapshots` 并把产物提交），
然后再把 `test.skip(!ENABLED)` 改成「CI 也跑」。

## 新增/修改基线的约定

1. 一次 PR 只动与本次改动相关的基线，其它基线若变化说明有回归；
2. 基线 diff 必须贴到 PR 描述里，并写一句「为什么这次像素变化是预期的」；
3. 不要为了过 CI 而无脑 `--update-snapshots`——那是把这层的意义抹掉。
