# development-process Specification

## Purpose
TBD - created by archiving change readme-dev-process. Update Purpose after archive.
## Requirements
### Requirement: README 提供开发流程入口

The repository README MUST include a "开发流程" section referencing the change workflow skill, task tracking spec, and defect workflow spec, so that contributors and agents discover the canonical process without reading the full docs tree.

#### Scenario: 新贡献者从 README 找到开发流程

- Given a fresh clone of the repository
- When reading the README "开发流程" section
- Then a reference to `.opencode/skills/change-workflow/` exists
- And a reference to `docs/agents/task-tracking.md` exists
- And a reference to `docs/agents/defect-workflow.md` exists

#### Scenario: 变更按 G0-G4 gate 执行

- Given the change workflow skill is present in the repository
- When a change is started
- Then the G0 启动 / G1 实施 / G2 提交PR / G3 收尾 / G4 归档 gates are followed
- And each task maps to exactly one issue (`1 task = 1 ticket`)

### Requirement: 合并后自动信号与收尾消费

The repository CI MUST emit a `change-close-pending` signal when a merged pull request closes the last open sub-issue of a change, and the change workflow agent MUST consume that signal at session start to execute change-level closure (G4).

#### Scenario: 合并关闭 change 最后一张子票

- Given a change whose sub-issues are titled `[change=<name>/<task>]`
- When a merged PR closes the last open sub-issue of that change
- Then CI adds the `change-close-pending` label to the merged PR
- And posts a comment describing the pending G4 closure

#### Scenario: agent 会话启动消费信号

- Given a merged PR labeled `change-close-pending`
- When the change workflow agent starts a session
- Then it runs the §8.1 closure check for that change
- And executes G4 (sync → validate → archive → board Done → close spec issue) when complete
- And removes the `change-close-pending` label

### Requirement: pr-automation.sh 硬化

The PR automation script MUST treat a successfully created PR as success even when the repository does not permit auto-merge, and MUST support a refs-only mode that references (not closes) the linked issue.

#### Scenario: 仓库未启用 auto-merge

- Given a repository where pull request auto-merge is disabled
- When pr-automation.sh completes with risk-low
- Then the PR is created and the script exits 0
- And it prints a hint to merge manually after CI passes

#### Scenario: refs-only 模式

- Given pr-automation.sh is invoked with `--refs-only`
- When it creates the PR body
- Then the body references the issue with `Refs #N` instead of `Closes #N`

