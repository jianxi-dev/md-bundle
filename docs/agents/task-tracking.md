# 任务发布与跟踪（to-tickets 桥接规范）

> 适用范围：把 OpenSpec change 的 tasks 发布为 GitHub issue，打通"spec → 开发 → 完成跟踪"全链路。
> 生效日期：2026-09-12
> 配套：`docs/agents/issue-tracker.md`（issue 操作）、`docs/agents/triage-labels.md`（状态标签）、`docs/agents/defect-workflow.md`（缺陷流程）

---

## 1. 核心原则

- **tasks.md 是唯一权威清单**，GitHub issue 是执行与跟踪面。issue 关闭时回写 tasks.md checkbox。
- **功能票与 bug 票统一仓库共存**：功能票标题带 `[change=<change名>]` 前缀，bug 票带 `[Px]` 前缀，靠标签区分。
- **1 task = 1 ticket**：每条任务一个 issue，带验收条件（AC）+ 阻塞关系（Blocked by）。

## 2. 拆票粒度

- **一条 task 一票**：tasks.md 本身就是垂直切片粒度（每条约 1 commit），天然匹配。
- **wave 级 parent issue**：每个 wave 一个总 issue，body 贴该 wave 的任务清单 checkboxes，子票引用它。
- 标题前缀防刷屏：`[change=md-bundle-v2/1.3]` 格式。

## 3. 发布规则（走 GitHub issue）

to-tickets 流程在本仓库一律发布为 GitHub issue（不使用本地 `.scratch/`），因为 tracker 配置就是 GitHub。

每个 ticket 必须包含：
- **Parent**：所属 wave parent issue 引用
- **What to build**：从用户视角描述端到端行为
- **Acceptance criteria**：具体可验证的 AC 清单
- **Blocked by**：阻塞它的其他 ticket 引用（无则 "None — can start immediately"）
- 标签：`ready-for-agent` + 模块标签

## 4. Parent tracking issue 模板

每个 change 建一个总跟踪 issue，body 贴完整 tasks 清单 checkboxes：

```markdown
## OpenSpec Change 跟踪：<change 名>

> 权威清单：`openspec/changes/<change 名>/tasks.md`
> 关联：子任务 issue 见下方各 wave 链接

## Wave 1 — <wave 名>

- [ ] 1.1 <任务名> — #<issue号>
- [ ] 1.2 <任务名> — #<issue号>

## Wave 2 — <wave 名>

- [ ] 2.1 <任务名> — #<issue号>
```

- parent issue 标签：`ready-for-agent` + `enhancement`
- 子票标题统一 `[change=<名>/<task号>]` 前缀
- 子票完成 → 勾选 parent checkbox → 全部勾完 → 归档 change

## 5. 完成回写

- 开发完成：commit 写 `fixes #<issue号>` → GitHub 自动关 issue
- 关 issue 时同步勾选 tasks.md 对应 checkbox
- 每轮开发会话末：`openspec status --change <名> --json` 对账 tasks.md 与 issue 关闭数

## 6. commit 规范（审计链）

- `fixes #N`：PR 合并时自动关闭 issue N
- `refs #N`：仅关联引用，不自动关闭
- 分支命名：`feat/<slug>`（功能）/ `fix/<slug>`（缺陷），1 分支 = 1 PR

---

_最后更新：2026-09-12_