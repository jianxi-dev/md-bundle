# change-workflow 工具包

一套让 **agent 按项目规范执行变更** 的自动化流程，可安装到任意 GitHub 仓库（OpenSpec 可选）。

## 解决什么问题

AI agent 常跳过工程规范：不建分支/issue 就开发、不拆票、误关子票、按过期规范操作、主 spec 提前同步、把真实回归误判为 flaky……本工具包把「变更生命周期」编码为**强制 gate + 自愈回路**，使 agent 每次变更都走同一条可审计的路径。

## 组成

| 文件 | 作用 |
|---|---|
| `skills/change-workflow/SKILL.md` | 总编排 skill：G0-G4 五 gate + fix-first 自愈回路 + 缺陷机制 |
| `scripts/pr-automation.sh` | issue 驱动分支/PR 自动化（`--resume-branch` 白名单收口、`--refs-only`、auto-merge fail-open） |
| `workflows/change-closure-signal.yml` | CI 合并信号（Layer 1）：合并关闭 change 最后一张子票时打标 |
| `docs/agents/*.md` | 7 份规范模板（task-tracking / issue-tracker / project-board / triage-labels / defect-workflow / domain / incident-uncommitted-work-loss） |
| `setup.sh` | 安装向导：检测仓库 → 发现看板 → 建标签 → 写配置 → 拷贝文件 → 更新 AGENTS.md |
| `config.example.conf` | 参数化配置模板（看板 ID / 标签 / 门禁命令 / 目录约定） |

## 核心约定

- **1 task = 1 ticket = 1 分支 = 1 PR**（垂直切片，独立可评审/合并/回滚）
- **Parent = 源 spec issue**（不另建 change parent；G4 才关闭 spec issue）
- **`fixes #N`** → PR 合并自动关子票；**`Refs #N`** → 仅引用（parent/spec issue 用）
- **gate 失败 → fix-first 自愈**（自行修复，2 轮未通才升级用户）
- **合并 → CI 信号 → 会话启动消费 → 自动 G4 收尾**（跨会话自动化）
- **分支保护**：main 要求质量门禁 + 分支与 main 同步（strict）

## 五个 gate

```
G0 启动   to-spec 归一化 → openspec-propose(切片) → to-tickets 拆票(Parent=spec issue) + 看板
G1 实施   建票级分支 → implement(内嵌 tdd) → 质量门禁 → code-review(+review)
G2 提交/PR pr-automation.sh --resume-branch 收口（1 issue = 1 PR，feat/fix 同 gate）
G3 收尾   learn → sync-gbrain → 对账 → frontier 自动推进下一张票（非阻塞）
G4 归档   全部合并 → validate --strict → archive → 看板 Done → 关闭 spec issue
```

## 前置依赖

- `gh`（GitHub CLI，已 `gh auth login`）、`git`、`python3`
- 可选：`openspec` CLI（`OPENSPEC_ENABLED=false` 时降级，G0 阶段二/G4 归档跳过）
- 配套 agent skill（可选但推荐）：`to-spec` / `to-tickets` / `implement` / `tdd` / `code-review` / `review` / `learn` / `sync-gbrain` / `triage` / `qa`（gstack 生态）

## 安装

```bash
cd /path/to/your-project
/path/to/change-workflow/setup.sh --target . --yes
# 检查 .change-workflow.conf → git add -A && git commit → 开 PR
```

详见 [INSTALL.md](INSTALL.md)；设计原理见 [DESIGN.md](DESIGN.md)。
