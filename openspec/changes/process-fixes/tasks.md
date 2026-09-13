# 任务清单：process-fixes

## 1. 脚本硬化（pr-automation.sh）

- [ ] 1.1 6/6 auto-merge 段 fail-open：仓库未启用 auto-merge 时打印手动合并提示并退出 0（PR 已创建即成功）
- [ ] 1.2 新增 `--refs-only` 旗标：PR body 用 `Refs #N` 替代 `Closes #N`（供 parent/spec issue 使用）
- [ ] 1.3 扩展 stub 自测：auto-merge 不可用场景退出 0；`--refs-only` 产出 `Refs #N`

## 2. SKILL 补全（change-workflow/SKILL.md）

- [ ] 2.1 G0-POST 补「看板入列」显式命令序列（gh project item-add + item-edit，含 field/option ID 获取）
- [ ] 2.2 G4 补「纯文档 change 无 spec delta 时 validate --strict 失败」提示与处置
- [ ] 2.3 G2 补「已有 commit 分支必须 resume；--slug 与 --resume-branch 互斥」
- [ ] 2.4 新增「会话启动：消费 change-close-pending 信号 → 自动 G4」

## 3. 合并信号（CI）

- [ ] 3.1 新增 .github/workflows/change-closure-signal.yml：PR merged 时解析关闭的 `[change=<名>/` 子票 → 无剩余 open → 打 `change-close-pending` 标签 + 评论