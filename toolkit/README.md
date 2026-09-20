# toolkit — 已迁移至独立仓库

本目录原为 `change-workflow` 工具包的**分发源**。自 **2026-09-20** 起，工具包已提取为独立仓库：

## 新地址

**https://github.com/jianxi-dev/change-workflow**

## 为什么迁移

工具包同时承担「分发源」与「md-bundle 消费者」双重角色，导致：

- 其演进节奏与 md-bundle 产品节奏耦合
- 消费者（mdpkg / clairis）要取得工具包更新，必须 `pull` 整个 md-bundle 应用仓库
- 工具包自身的缺陷只能记在 md-bundle 的 issue tracker 里
- 工具包自身没有 CI（其端到端测试此前靠人工跑）

决策依据与完整分析见 [`EXTRACTION-ANALYSIS.md`](./EXTRACTION-ANALYSIS.md)。

## 本仓库现在如何升级工具包

md-bundle 现在是**普通消费者**，与其他仓库一视同仁：

```bash
# 1. 取得工具包（首次）
git clone https://github.com/jianxi-dev/change-workflow ~/.change-workflow

# 2. 查看是否有新版本
~/.change-workflow/update.sh --check

# 3. 执行升级
~/.change-workflow/update.sh --target /path/to/md-bundle
```

> **注意**：md-bundle 的 `.change-workflow.conf` 由人工维护（非 `setup.sh` 生成），
> 且**无 `.change-workflow.manifest`**（从未经 `setup.sh` 安装）。首次升级时 `update.sh`
> 会**自动进入接管模式**：逐个比对当前文件与模板，一致则接管、不同则写 `.new` 旁路文件，
> **不会静默覆盖** md-bundle 的定制内容。

## 已安装内容的位置（不受本次迁移影响）

| 项 | 位置 |
|---|---|
| skill | `.opencode/skills/change-workflow/SKILL.md` |
| 规范文档 | `docs/agents/*.md`（含 `quality-gates.md` 的 QG-1..QG-7 + DQ-1..DQ-8） |
| 配置 | `.change-workflow.conf` |
| 机械脚本 | `scripts/pr-automation.sh` |
| CI 信号 | `.github/workflows/change-closure-signal.yml` |

这些文件**保留在本仓库**，迁移只移走了「分发源」（模板副本）。
