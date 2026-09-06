# Issue tracker: GitHub

本仓库的 issue、spec、缺陷统一使用 GitHub Issues 管理，仓库为 `jianxi-dev/md-bundle`。所有操作优先使用 `gh` CLI。

## 基本操作

- **创建 issue**：`gh issue create --title "..." --body "..."`，多行 body 用 heredoc。
- **查看 issue**：`gh issue view <编号> --comments`。
- **列出 issue**：`gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, labels: [.labels[].name], comments: [.comments[].body]}]'`。
- **评论 / 打标签 / 关闭**：`gh issue comment`、`gh issue edit --add-label`/`--remove-label`、`gh issue close`。
- **自动识别仓库**：在仓库克隆目录内运行 `gh` 会自动读取 `git remote -v`。

## 项目专用标签

除 `triage-labels.md` 中的 5 个 canonical 标签外，还使用以下标签：

| 标签 | 含义 |
|---|---|
| `bug` | 真实缺陷 |
| `in-progress` | 功能标识为"开发中"/未完工 |
| `p0` | 阻塞级，无法发布 |
| `p1` | 高优先级，主流程受损 |
| `p2` | 中优先级，有 workaround |
| `p3` | 低优先级 / 体验优化 |
| `wave-4` | 多页签与会话持久化 |
| `wave-5` | FSA 文件工作区与保存模型 |
| `wave-6` | 主题、分享、文档收口与回归 |
| `landing` / `editor` / `renderer` / `fsa` / `save` / `share` | 模块标签 |

## PR 作为 triage 入口

**否**。本仓库不将外部 PR 当作 feature request 处理。

## 当 skill 要求"发布到 issue tracker"

创建一个 GitHub issue，并打上合适的标签。

## 当 skill 要求"获取相关 ticket"

运行 `gh issue view <编号> --comments`。
