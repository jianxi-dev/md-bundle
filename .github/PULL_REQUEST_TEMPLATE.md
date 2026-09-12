# Pull Request 模板

> 所有 PR 必填。按风险等级分级评审:
> - `risk-low`(注释/日志/单测/简单容错)→ CI 绿自动合并
> - `risk-medium`(普通功能/缺陷修复)→ 人工确认
> - `risk-high`(核心逻辑/渲染/保存模型/FSA)→ 强制人工评审

## 变更概述
一句话说明解决的问题。

## 关联 Issue
- Closes #<issue号>（自动关单）或 Refs #<issue号>（仅引用）

## 变更内容
- 改动模块:
- 核心文件清单:
- 关键逻辑说明:

## 影响范围
- 接口变更:
- 下游影响:
- 线上风险:

## 验证方式与结果
- [ ] `pnpm -r typecheck`
- [ ] `pnpm -r lint`
- [ ] `pnpm -r test`
- [ ] (涉 e2e) `pnpm --filter @md-bundle/web exec playwright test <spec>`
- [ ] 自测结果/复现步骤验证:

## 风险评估
- **风险等级**: `risk-low` / `risk-medium` / `risk-high`
- **来源**: `ai-generated`（AI 生成）/ 人工
- **回滚方案**: `git revert <merge-commit>` 即可回滚