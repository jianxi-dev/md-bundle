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

