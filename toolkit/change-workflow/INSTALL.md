# 安装指南

## 前置

```bash
gh --version && gh auth status     # 需已登录，且有 repo 权限
git --version
python3 --version                  # 看板字段发现用
openspec --version                 # 可选
```

CI 合并信号需要 Actions 写权限：**Settings → Actions → General → Workflow permissions → Read and write**。

## 一键安装

```bash
cd /path/to/your-project
/path/to/change-workflow/setup.sh --target . --yes
```

`setup.sh` 会：

1. 检测仓库（`gh repo view`）与默认分支
2. 发现 Project V2 看板 + Status 字段/选项 ID（GraphQL；无看板则留空，稍后手填）
3. 创建标签（canonical triage + risk-* + ai-generated + change-close-pending + 模块）
4. 询问质量门禁命令（typecheck/lint/test/e2e，带默认）
5. 写 `.change-workflow.conf`
6. 拷贝 skill / 脚本 / workflow / 规范模板（替换 `{{REPO}}` 等占位符；已存在则跳过）
7. 在 `AGENTS.md` 追加索引段（若存在且未索引）

### 选项

| 参数 | 说明 |
|---|---|
| `--target <dir>` | 目标项目目录（默认当前目录） |
| `--yes` | 非交互，全部用默认值 |
| `--dry-run` | 只打印将执行的动作，不落盘 |

**幂等**：可重复运行；已存在的文件跳过、标签 `--force` 覆盖。

## 安装后

```bash
# 1. 检查配置（尤其看板 ID）
cat .change-workflow.conf

# 2. 若 PROJECT_ID/OPT_* 为空——手动补（或创建看板后重跑 setup.sh）
#    发现命令：
gh project list --owner <OWNER> --format json

# 3. 提交并开 PR
git add -A && git commit -m "chore: adopt change-workflow"
git push -u origin <branch> && gh pr create
```

## 验证（首个子票即验证全流程）

1. 提一个需求 → 让 agent 走 `change-workflow`（G0）：产出 spec issue + change artifacts + 子票（Parent=spec issue）
2. 子票实施 → 独立分支 → `pr-automation.sh --resume-branch` 收口 PR（1 issue = 1 PR）
3. PR 合并 → 子票自动关闭 → 会话启动消费 `change-close-pending` → 自动 G4

## 手动安装（不用 setup.sh）

1. 复制 `skills/change-workflow/` → `<SKILLS_DIR>/change-workflow/`
2. 复制 `scripts/pr-automation.sh` → `scripts/`（`chmod +x`）
3. 复制 `workflows/change-closure-signal.yml` → `.github/workflows/`
4. 复制 `docs/agents/*.md` → `<DOCS_DIR>/`（替换 `{{...}}` 占位符）
5. 复制 `config.example.conf` → `.change-workflow.conf` 并填值
6. 在 `AGENTS.md` 索引 change-workflow

## 目录约定（可在 conf 中改）

| 变量 | 默认 | 含义 |
|---|---|---|
| `SKILLS_DIR` | `.opencode/skills` | skill 安装目录 |
| `DOCS_DIR` | `docs/agents` | 规范文档目录 |
| `DEFAULT_BRANCH` | `main` | PR base / 分支基点 |

## 卸载

删除 `.change-workflow.conf`、`<SKILLS_DIR>/change-workflow/`、`scripts/pr-automation.sh`、`.github/workflows/change-closure-signal.yml`、`<DOCS_DIR>/` 下由本工具包安装的文档即可（标签可保留，无害）。
