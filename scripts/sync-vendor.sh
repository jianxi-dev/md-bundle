#!/usr/bin/env bash
# =============================================================================
# sync-vendor.sh —— vendor 生命周期同步脚本（issue #101）
#
# 用法:
#   bash scripts/sync-vendor.sh <上游commit> [--dry-run]
#   bash scripts/sync-vendor.sh                  # 打印用法并 exit 2
#
# 流程:
#   1. 从上游 jianxi-dev/mdpkg <commit> 拉取 packages/mdpkg/web/mdpkg-web.js
#   2. 校验产物（非空 + 字节数 > 500000 + 含特征串）
#   3. 写入 apps/web/vendor/mdpkg-web.js + apps/web/vendor/.vendor-version
#   4. 跑 pnpm --filter @md-bundle/web test（--dry-run 跳过）
#   5. 打印建议 commit message
#
# 环境变量:
#   UPSTREAM_REPO —— 上游 clone 路径（默认空 → 临时 clone）
# =============================================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

VENDOR_DIR="apps/web/vendor"
VENDOR_FILE="$VENDOR_DIR/mdpkg-web.js"
VERSION_FILE="$VENDOR_DIR/.vendor-version"

# --- 用法 -------------------------------------------------------------------
if [[ $# -lt 1 ]]; then
  echo "用法: bash scripts/sync-vendor.sh <上游commit> [--dry-run]" >&2
  echo "" >&2
  echo "示例:" >&2
  echo "  bash scripts/sync-vendor.sh 601ec51" >&2
  echo "  bash scripts/sync-vendor.sh 601ec51 --dry-run" >&2
  exit 2
fi

COMMIT=""
DRY_RUN="0"

# 参数解析：支持 <commit> 与 --dry-run 任意顺序
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN="1"; shift ;;
    -*) echo "未知参数: $1" >&2; exit 2 ;;
    *)  COMMIT="$1"; shift ;;
  esac
done

if [[ -z "$COMMIT" ]]; then
  echo "缺少 <上游commit> 参数" >&2
  echo "用法: bash scripts/sync-vendor.sh <上游commit> [--dry-run]" >&2
  exit 2
fi

# --- 拉取上游 bundle --------------------------------------------------------
TMP_DIR=""
cleanup() { [[ -n "$TMP_DIR" && -d "$TMP_DIR" ]] && rm -rf "$TMP_DIR"; }
trap cleanup exit

fetch_bundle() {
  local commit="$1"
  local out="$2"

  if [[ -n "${UPSTREAM_REPO:-}" && -d "$UPSTREAM_REPO/.git" ]]; then
    # 本地有 clone，直接 show
    git -C "$UPSTREAM_REPO" show "$commit:packages/mdpkg/web/mdpkg-web.js" > "$out"
  else
    # 临时 clone（blob:none 不下载历史 blob，只取指定 commit 文件）
    TMP_DIR="$(mktemp -d)"
    git clone --filter=blob:none --no-checkout https://github.com/jianxi-dev/mdpkg "$TMP_DIR/mdpkg"
    git -C "$TMP_DIR/mdpkg" show "$commit:packages/mdpkg/web/mdpkg-web.js" > "$out"
  fi
}

BUNDLE_TMP="$(mktemp)"
echo "==> 拉取上游 mdpkg-web.js (commit: $COMMIT)"
fetch_bundle "$COMMIT" "$BUNDLE_TMP"

# --- 校验 -------------------------------------------------------------------
echo "==> 校验产物"

# 1. 非空
if [[ ! -s "$BUNDLE_TMP" ]]; then
  echo "❌ 产物为空" >&2
  exit 1
fi

# 2. 字节数 > 500000
SIZE=$(wc -c < "$BUNDLE_TMP" | tr -d ' ')
if [[ "$SIZE" -le 500000 ]]; then
  echo "❌ 产物过小 ($SIZE bytes)，预期 > 500000" >&2
  exit 1
fi
echo "    字节数: $SIZE ✓"

# 3. 含特征串（docx 表格列宽满宽修复 / callout 色）
if ! grep -q 'w:tblW w:w="9026"' "$BUNDLE_TMP" \
  && ! grep -q 'ECF7EC' "$BUNDLE_TMP"; then
  echo "❌ 产物不含预期特征串（w:tblW w:w=\"9026\" 或 ECF7EC）" >&2
  exit 1
fi
echo "    特征串校验通过 ✓"

# --- 写入 -------------------------------------------------------------------
if [[ "$DRY_RUN" == "1" ]]; then
  echo "==> [dry-run] 跳过写入与测试"
  echo "    预期写入: $VENDOR_FILE"
  echo "    预期写入: $VERSION_FILE"
else
  echo "==> 写入 vendor"
  cp "$BUNDLE_TMP" "$VENDOR_FILE"

  # .vendor-version: 一行 commit + 一行日期
  TODAY=$(date -u +%Y-%m-%d)
  printf '%s\n%s\n' "$COMMIT" "$TODAY" > "$VERSION_FILE"
  echo "    $VENDOR_FILE ($SIZE bytes)"
  echo "    $VERSION_FILE (commit=$COMMIT, date=$TODAY)"
fi

# --- 跑测试 -----------------------------------------------------------------
if [[ "$DRY_RUN" == "1" ]]; then
  echo "==> [dry-run] 跳过测试 (pnpm --filter @md-bundle/web test)"
else
  echo "==> 跑测试"
  pnpm --filter @md-bundle/web test
  echo "    测试通过 ✓"
fi

# --- 建议 commit message ----------------------------------------------------
echo ""
echo "==> 建议 commit message:"
echo "    chore(web): 同步上游 mdpkg-web bundle (mdpkg $COMMIT)"
echo ""
echo "    完整示例:"
echo "    git add apps/web/vendor/mdpkg-web.js apps/web/vendor/.vendor-version"
echo "    git commit -m 'chore(web): 同步上游 mdpkg-web bundle (mdpkg $COMMIT)'"

exit 0
