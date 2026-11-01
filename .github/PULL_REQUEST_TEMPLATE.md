# Pull Request 模板

> 所有 PR 必填。按风险等级分级评审:
> - `risk-low`(注释/日志/单测/简单容错)→ CI 绿自动合并
> - `risk-medium`(普通功能/缺陷修复)→ 人工确认
> - `risk-high`(核心逻辑/渲染/保存模型/FSA)→ 强制人工评审

## 变更概述
一句话说明解决的问题。

## 关联 Issue
- 缺陷修复票**必须**写 `fixes #<issue号>`（1 票 = 1 分支 = 1 PR，逐票一行，见 DQ-6）。
  仅引用（不关单）用 `Refs #<issue号>`。注意：evidence-check 只对 `closingIssuesReferences`
  里的票号做 state-coverage 校验 —— 写 `refs` 等于跳过检查。
- 同一 PR 关多票：每票单独一行 `fixes #N`，禁止只写总票号。

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