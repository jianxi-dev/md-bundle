# md-bundle Bug 记录表

> 反馈入口：聊天中直接描述问题即可，我会整理到此表并创建 GitHub issue。

## 使用说明

- **状态**：`待评估` → `已确认` → `修复中` → `已关闭`
- **严重级别**：`p0` 阻塞发布 / `p1` 主流程受损 / `p2` 有 workaround / `p3` 体验优化
- **模块**：`landing` / `editor` / `renderer` / `tabs` / `fsa` / `save` / `theme` / `share`

---

## 活跃 Bug

| #   | 标题                                                      | 严重级别 | 模块  | GitHub Issue | 状态  | 备注                                                                                           |
| --- | ------------------------------------------------------- | ---- | --- | ------------ | --- | -------------------------------------------------------------------------------------------- |
| 1   | 导出不支持 docx                                              | P0  | 编辑器 | #1 | 待评估 | [已同步到 GitHub](https://github.com/jianxi-dev/md-bundle/issues/1) |
| 5   | 复制正文为图片，剪贴板里是默认的模版                                      | P1  | 分享  | #5 | 待评估 | [已同步到 GitHub](https://github.com/jianxi-dev/md-bundle/issues/5) |
| 6   | 打开文档默认改为预览                                              | P3  | 编辑器 | #6 | 待评估 | [已同步到 GitHub](https://github.com/jianxi-dev/md-bundle/issues/6) |
| 7   | 深浅色切换应该是全屏切换，不应只是正文区变化                                  | P1  | 主题  | #7 | 待评估 | [已同步到 GitHub](https://github.com/jianxi-dev/md-bundle/issues/7) |
| 8   | 落地页示例排版很丑                                               | P2  | 落地页 | #8 | 待评估 | [已同步到 GitHub](https://github.com/jianxi-dev/md-bundle/issues/8) |
| 9   | 复制为图片和导入图片按钮要去除                                         | P0  | 编辑器 | #9 | 待评估 | [已同步到 GitHub](https://github.com/jianxi-dev/md-bundle/issues/9) |
| 10  | 正文区域顶部的打开新文件、显示文件名行和校验通过功能没有去除，打开新文件以按钮方式放在顶部按钮区第一个 | P0  | 编辑器 | #10 | 待评估 | [已同步到 GitHub](https://github.com/jianxi-dev/md-bundle/issues/10) |
| 11  | 落地页鼠标移入显示打开按钮，并加了蒙版，效果很差，取消此功能，应该是文件拖入时显示拖入蒙版的效果        | P0  | 落地页 | #11 | 待评估 | [已同步到 GitHub](https://github.com/jianxi-dev/md-bundle/issues/11) |
| 12  | 点击导出-邀请卡，没反应                                            | P0  | 分享  | #12 | 待评估 | [已同步到 GitHub](https://github.com/jianxi-dev/md-bundle/issues/12) |
| 13  | 进入全屏后按 ESC 没反应                                          | P0  | 渲染  | #13 | 待评估 | [已同步到 GitHub](https://github.com/jianxi-dev/md-bundle/issues/13) |
| 14  | 保存文档按钮显示的不是图标                                           | P2  | 主题  | #14 | 待评估 | [已同步到 GitHub](https://github.com/jianxi-dev/md-bundle/issues/14) |

---

## 已关闭 Bug

| # | 标题 | 严重级别 | 模块 | 关闭时间 | 修复方式 |
|---|------|---------|------|---------|---------|
| 2 | 拖入 zip 文件窗口没反应 | P0 | 编辑器 | 2026-09-08 | 新增 `lib/zip.ts` 最小 ZIP 读取器（EOCD+中央目录+DecompressionStream），`lib/dropFiles.ts` 分流 zip → 解压找首个 .md/.mdpkg 打开 |
| 3 | 拖入 zip 文件窗口报错 | P0 | 编辑器 | 2026-09-08 | 同上：`extractDocFromZip` 确定性返回 `{ ok:false, message }`，绝不 throw；非 ZIP/损坏包显示提示而非报错 |
| 4 | 拖入文件夹没反应，内部根下有 md 文件 | P0 | 编辑器 | 2026-09-08 | `lib/dropFiles.ts` 新增 `getDirectoryHandle`（getAsFileSystemHandle → webkitGetAsEntry 兜底）+ `extractDocFromDirectory`（深度≤3、条目≤200，DFS 根优先） |

---

## 模板（新 Bug 参考）

```
| # | <标题> | p0/p1/p2/p3 | <模块> | 待评估 | <从打开页面到触发问题的步骤> | <额外信息> |
```

---

_最后更新：2026-09-08_
