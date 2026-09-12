# 完成跟踪看板(GitHub Projects)

> 生效日期：2026-09-12
> 状态：**需手动创建一次**(agent token 缺 `project` scope,无法走 API;创建后日常维护可全自动)

## 创建步骤(一次性,约 30 秒)

1. 打开 https://github.com/jianxi-dev/md-bundle/projects
2. 点 **New project**(若提示需开启 Projects,先在仓库 Settings → General → Projects 启用)
3. 选择 **Table**(或 Board)模板,命名如 `MD-Bundle 开发看板`
4. 添加列(Table 用 Status 字段,Board 用列):
   - `Backlog`(对应 `needs-triage` / 待排期)
   - `Ready`(对应 `ready-for-agent`)
   - `In Progress`(对应 PR 打开中 / 实施中)
   - `Done`(对应 issue closed)
5. 配置自动化(可选):在 Workflows 中设置
   - Issue 打 `ready-for-agent` → 移入 Ready
   - PR 打开 → 移入 In Progress
   - Issue 关闭 → 移入 Done

## 若希望 agent 用 API 自动建板/自动化

当前 `gh` token scopes: `gist, read:org, repo, workflow` —— 缺 `read:project` 和 `project`。

在 https://github.com/settings/tokens 给 token 追加 `project` scope(含 read:project)后,agent 即可:
- `gh api graphql` 建 Projects v2 看板
- 配置 label → column 自动化 workflow

## 日常维护(创建后,无需手动)

- 看板按 label 自动归类,不手动拖卡
- 每轮开发会话末:`openspec status --change <名> --json` 对账 tasks.md 与 issue 关闭数
- 完成跟踪入口 = GitHub Issues 列表 + 本看板(双视图同源)

## 与 label 状态机的对应

| 看板列 | 对应 label | 含义 |
|---|---|---|
| Backlog | `needs-triage` | 待评估 |
| Ready | `ready-for-agent` | 可执行 |
| In Progress | — | PR 打开中 |
| Done | — | issue closed |

---

_配套：`docs/agents/task-tracking.md`(任务发布)、`docs/agents/defect-workflow.md`(缺陷流程)、`docs/agents/triage-labels.md`(状态标签)_