#!/usr/bin/env bash
# =============================================================================
# pr-automation.sh — issue 驱动的分支/PR 自动化流水线
#
# 用法:
#   ./scripts/pr-automation.sh --role feat   --issue 42 --title "feat: ..."
#   ./scripts/pr-automation.sh --role fix    --issue 42 --risk low
#   ./scripts/pr-automation.sh --list-ready
#
# 流程: 校验仓库干净 → 基于 origin/main 建分支 → 显式 git add 白名单提交
#        → push → gh pr create(模板+风险标签) → 按风险分级启用 auto-merge
#
# 规则(见 docs/agents/):
#   - 1 分支 = 1 PR,绝不复用
#   - 分支名: feat/<slug> / fix/<slug>,基于 origin/main
#   - commit 引用 fixes #N → PR 合并自动关 issue
#   - risk-low → auto-merge; risk-medium/high → 人工评审
# =============================================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

usage() {
  sed -n '2,12p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
  exit 1
}

# --- 参数解析 ---------------------------------------------------------------
ROLE="" ISSUE="" TITLE="" RISK="medium" SLUG="" FILES=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --role)    ROLE="$2"; shift 2 ;;
    --issue)   ISSUE="$2"; shift 2 ;;
    --title)   TITLE="$2"; shift 2 ;;
    --risk)    RISK="$2"; shift 2 ;;
    --slug)    SLUG="$2"; shift 2 ;;
    --list-ready) gh issue list --label ready-for-agent --state open --json number,title,labels \
                    --jq '.[] | "#\(.number) [\(.labels|map(.name)|join(","))] \(.title)"'; exit 0 ;;
    --help|-h) usage ;;
    --) shift; FILES+=("$@"); break ;;
    -*) echo "未知参数: $1" >&2; usage ;;
    *)  FILES+=("$1"); shift ;;
  esac
done

[[ -z "$ROLE" ]] && { echo "缺少 --role (feat|fix)" >&2; usage; }
[[ "$ROLE" != "feat" && "$ROLE" != "fix" ]] && { echo "--role 只能为 feat|fix" >&2; usage; }
[[ "$RISK" != "low" && "$RISK" != "medium" && "$RISK" != "high" ]] && { echo "--risk 只能为 low|medium|high" >&2; usage; }

# --- 前置校验 ---------------------------------------------------------------
[[ -n "$ISSUE" ]] && gh issue view "$ISSUE" --json number,title --jq '.number' >/dev/null 2>&1 \
  || { echo "issue #$ISSUE 不存在或无法访问" >&2; exit 1; }

# 仓库必须干净(运行时噪音除外——显式白名单提交,禁止 -A)
DIRTY_TRACKED=$(git status --porcelain | grep -v '^??' || true)
if [[ -n "$DIRTY_TRACKED" ]]; then
  echo "工作区有已跟踪的未提交改动,请先 stash 或提交:" >&2
  echo "$DIRTY_TRACKED" >&2
  exit 1
fi

# --- 生成分支名 -------------------------------------------------------------
if [[ -z "$SLUG" ]]; then
  SLUG=$(gh issue view "$ISSUE" --json title --jq '.title' \
    | tr '[:upper:]' '[:lower:]' \
    | sed 's/[^a-z0-9]+/-/g; s/^-//; s/-$//' \
    | cut -c1-48)
  [[ -z "$SLUG" ]] && SLUG="issue-$ISSUE"
fi
BRANCH="$ROLE/$SLUG"

# 分支名冲突检查(worktree 规则:一分支一窗口)
if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  echo "分支 $BRANCH 已存在(可能被另一 worktree 占用)" >&2
  exit 1
fi

# --- 流水线 -----------------------------------------------------------------
echo "==> 1/6 基于 origin/main 建分支: $BRANCH"
git fetch origin
git checkout -b "$BRANCH" origin/main

echo "==> 2/6 实施改动(由 agent/人在分支上完成)"
# 提示: 在此完成代码修改后继续,或直接指定 --files 提交

if [[ ${#FILES[@]} -gt 0 ]]; then
  echo "==> 3/6 显式 add 白名单提交"
  git add "${FILES[@]}"
  git status --short
  git commit -m "$TITLE

fixes #$ISSUE"
else
  echo "==> 跳过提交(无 --files 参数)。在分支上完成改动后手动 commit,或补 --files 重跑"
fi

echo "==> 4/6 推送分支"
git push -u origin "$BRANCH"

echo "==> 5/6 创建 PR"
BODY_FILE="$(mktemp)"
cat > "$BODY_FILE" <<EOF
## 变更概述
$TITLE

## 关联 Issue
Closes #$ISSUE

## 变更内容
(待 agent/人填写: 改动模块、核心文件清单)

## 影响范围
(待填写: 接口/下游/线上风险)

## 验证方式
- [ ] pnpm -r typecheck
- [ ] pnpm -r lint
- [ ] pnpm -r test
$( [[ "$ROLE" == "fix" ]] && echo "- [ ] 复现步骤验证通过" )

## 风险评估
**风险等级**: $RISK
**来源**: ai-generated

## 回滚方案
git revert <merge-commit> 即可回滚
EOF

PR_URL=$(gh pr create --base main --head "$BRANCH" \
  --title "$TITLE" \
  --body-file "$BODY_FILE" \
  --label "risk-$RISK,ai-generated")
rm -f "$BODY_FILE"
echo "    PR: $PR_URL"

echo "==> 6/6 风险分级"
if [[ "$RISK" == "low" ]]; then
  PR_NUM=$(echo "$PR_URL" | grep -o '[0-9]*$')
  gh pr merge "$PR_NUM" --auto --squash
  echo "    risk-low → 已启用 auto-merge(CI 绿自动合并)"
else
  echo "    risk-$RISK → 人工评审,等待确认"
fi

echo "==> 完成。分支: $BRANCH | PR: $PR_URL"