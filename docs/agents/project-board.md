# 完成跟踪看板(GitHub Projects)

> 生效日期：2026-09-12
> 状态：**已创建并配置完成**（2026-09-12，token 已补 `project` scope，API 全自动）

## 看板信息

- 看板：**MD-Bundle 开发看板** → https://github.com/orgs/jianxi-dev/projects/1
- Project ID（GraphQL）：`PVT_kwDOE0POlM4BjPai`
- Status 字段 ID：`PVTSSF_lADOE0POlM4BjPaizhiEhFM`
- 列（Status 单选项）：`Backlog`(GRAY) / `Ready`(BLUE) / `In Progress`(YELLOW) / `Done`(GREEN)
- 已实测：`addProjectV2ItemById` + `updateProjectV2ItemFieldValue` 全链路通过（issue #16 已在看板 Backlog）

## 日常维护（无需手动）

- 看板按 label 自动归类，不手动拖卡
- 每轮开发会话末：`openspec status --change <名> --json` 对账 tasks.md 与 issue 关闭数
- 完成跟踪入口 = GitHub Issues 列表 + 本看板（双视图同源）

## 常用 API（agent 可复用）

```bash
# 添加 issue 到看板
gh api graphql -f query='mutation { addProjectV2ItemById(input: {projectId: "PVT_kwDOE0POlM4BjPai", contentId: "<issue-node-id>"}) { item { id } } }'

# 设置状态列（optionId: Backlog=8c7f2979 Ready=a50766ca InProgress=a7011ca0 Done=4cbd348f）
gh api graphql -f query='mutation { updateProjectV2ItemFieldValue(input: {projectId: "PVT_kwDOE0POlM4BjPai", itemId: "<item-id>", fieldId: "PVTSSF_lADOE0POlM4BjPaizhiEhFM", value: {singleSelectOptionId: "8c7f2979"}}) { projectV2Item { id } } }'
```

## 与 label 状态机的对应

| 看板列 | 对应 label | 含义 |
|---|---|---|
| Backlog | `needs-triage` | 待评估 |
| Ready | `ready-for-agent` | 可执行 |
| In Progress | — | PR 打开中 |
| Done | — | issue closed |

> 注：GraphQL 无 workflow 更新 mutation，label→列自动化的开关在 UI（Workflows）配置。内置 workflow（Auto-add / Item closed 等）已存在，按需在 UI 启用。

---

_配套：`docs/agents/task-tracking.md`(任务发布)、`docs/agents/defect-workflow.md`(缺陷流程)、`docs/agents/triage-labels.md`(状态标签)_