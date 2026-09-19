# 缺陷管理流程

> 本仓库所有缺陷统一使用 **GitHub Issues** 管理，仓库：`jianxi-dev/md-bundle`
> 
> 本地文件 `bug-registry-*.md` 仅作为缓存，**GitHub Issues 是唯一事实来源**。
> 
> **缓存策略（2026-09-12 起）**：废弃本地 `bug-registry-*.md` 缓存维护，一律以 `gh issue list` 为准。需要本地快照时临时生成，不再维护"缓存 ↔ GitHub"双向同步。

> 涉及未提交改动、错误计划、snapshot 恢复或 `reset`/批量覆盖时，先阅读 `docs/agents/incident-uncommitted-work-loss.md`；该文档是共享工作区保护和恢复流程的唯一来源。

> 缺陷修复的质量判据见 `docs/agents/quality-gates.md`（QG-4 真实路径测试 / QG-5 独立验证 + 原始证据）；本节末尾「修复质量门禁」为缺陷场景下的强制应用。

---

## 快速操作

### 创建新缺陷

```bash
# 交互式创建
cd /Users/mason/ToHighs/md-bundle
gh issue create --title "[bug] 缺陷标题" --body "详细描述" --label "bug,p0,editor"

# 或一次性创建（推荐用于批量导入）
cd /Users/mason/ToHighs/md-bundle
gh issue create \
  --title "[bug] 缺陷标题" \
  --body "## 问题描述
描述问题...

## 期望行为
期望的结果...

## 复现步骤
1. 步骤1
2. 步骤2

---
*模块: editor*
*优先级: P0*" \
  --label "bug,p0,editor"
```

### 查看缺陷列表

```bash
# 列出所有开放缺陷
cd /Users/mason/ToHighs/md-bundle
gh issue list --state open

# 按标签过滤
gh issue list --label "bug,p0" --state open

# JSON 格式输出
gh issue list --state open --json number,title,labels,assignees
```

### 更新缺陷状态

```bash
# 添加评论
cd /Users/mason/ToHighs/md-bundle
gh issue comment <编号> --body "修复中..."

# 移交 triage 状态（5 个 canonical 标签）
gh issue edit <编号> --add-label "ready-for-agent"    # 已充分定义，可交给 agent 执行
gh issue edit <编号> --add-label "ready-for-human"    # 需要人类决策或实现
gh issue edit <编号> --remove-label "needs-triage"    # 离开待评估队列

# 关闭缺陷（修复完成）
cd /Users/mason/ToHighs/md-bundle
gh issue close <编号> --comment "已修复，提交 commit: xxx"
```

---

## 严重级别定义

| 级别 | 名称 | 定义 | 响应时间 |
|------|------|------|----------|
| P0 | 阻塞级 | 阻塞发布，核心功能无法使用 | 立即处理 |
| P1 | 高优先级 | 主流程受损，有 workaround | 24小时内 |
| P2 | 中优先级 | 有 workaround，体验受影响 | 1周内 |
| P3 | 低优先级 | 体验优化，功能增强 | 排期处理 |

---

## 模块标签

- `landing` - 落地页模块
- `editor` - 编辑器模块
- `renderer` - 渲染器模块
- `tabs` - 多页签模块
- `fsa` - FSA 文件工作区模块
- `save` - 保存模型模块
- `theme` - 主题模块
- `share` - 分享模块

---

## 状态流转

```
待评估 (open + needs-triage)
    ↓
已确认 (open + bug)
    ↓
待执行 (open + ready-for-agent) / 待人工 (open + ready-for-human)
    ↓
已关闭 (closed)
```

---

## 从聊天反馈创建缺陷

当用户通过聊天反馈缺陷时，按以下流程操作：

1. **提取信息**
   - 问题描述
   - 期望行为
   - 复现步骤
   - 严重级别判断 (P0/P1/P2/P3)
   - 模块归属

2. **创建 GitHub Issue**
   ```bash
   cd /Users/mason/ToHighs/md-bundle
   gh issue create \
     --title "[bug] 问题摘要" \
     --body "## 用户反馈
问题描述...

## 期望行为
...

## 复现步骤
...

---
*来源: 聊天反馈*
*模块: xxx*
*优先级: Px*" \
     --label "bug,px,模块"
   ```

3. **通知用户**
   - 回复用户："已创建 GitHub Issue #xxx 追踪此问题"
   - 提供链接：`https://github.com/jianxi-dev/md-bundle/issues/xxx`

---

## 批量导入（从本地文件）

如果缺陷先记录在本地 `bug-registry-*.md`，批量导入命令：

```bash
# 先确保所有标签已创建
cd /Users/mason/ToHighs/md-bundle
for label in "p0" "p1" "p2" "p3" "bug" "landing" "editor" "renderer" "tabs" "fsa" "save" "theme" "share"; do
  gh label create "$label" --force
done

# 然后逐个创建 issue（或使用脚本批量创建）
gh issue create --title "..." --body "..." --label "..."
```

---

## 查看缺陷看板

GitHub Projects 看板地址：
https://github.com/jianxi-dev/md-bundle/projects

或直接在仓库 Issues 页面查看：
https://github.com/jianxi-dev/md-bundle/issues

---

## 修复质量门禁（QG-4 / QG-5）

> 完整定义见 `docs/agents/quality-gates.md`。本节说明缺陷修复场景下的强制应用。

### 复现必须走真实路径（QG-4）

缺陷复现与回归测试**必须驱动真实链路**，禁止为「让测试好写」而绕过被破坏的那几跳。

```ts
// ❌ 绕过 keymap，bug 恰在 keymap 里 → 测试全绿但真实按键仍失效
handleAutoPair(view, '**')

// ✅ 驱动真实输入路径
await view.dispatch(inputEvent(view, '**'))
```

**同源规则**：
- 测可见性 → 断言**计算样式**（`getComputedStyle`），禁止断言「元素存在」（元素可能在 DOM 中但 `opacity:0`）
- 测扩展 → 经**真实 `EditorView`**，禁止 mock `EditorState`（依赖 Lezer 语法树的逻辑无法被 mock 满足）

**真实教训（editor-v2 修复期）**：`#174` 自动配对的修复测试直接调 `handleAutoPair()`，绕过 `keydown → keymap → inputHandler` 两跳——而 bug 恰在那两跳（`key: '**'` 是非法 CM6 键名，被静默丢弃）。测试全绿，真实按键**零配对**。

### 关闭票必须附验证者原始证据（QG-5）

**关闭缺陷票前**，必须由**验证者（非修复者）**跑自己的探针，并把**原始输出**粘贴到票上。

**禁止采信的证据形式**：「测试通过」「已修复」「冒烟正常」——这些是**结论**，不是**证据**。证据必须是可复核的原始观察：标准输出 / DOM 快照 / 计算样式值 / 解析错误数 / 真实按键结果。

```bash
# 关闭票的正确形态
gh issue close <编号> --comment "已验证。原始观察：

ORDERED spans: \"1. \" | \"2. \"
HEADING inactive class: cm-heading-marker text: \"# \"
computed opacity: 0

验证方式：本地 Playwright 真实 Chromium，16 passed (16.3s)"
```

**真实教训（editor-v2 修复期）**：修复期抓出 **4 个「自测全绿但实际无效」**的交付，**4/4 全部由独立探针抓出**：

| 对象 | 自报 | 独立探针实测 |
|------|------|--------------|
| `#174` 自动配对 | 测试通过 | 绕过 keymap，真实按键零配对 |
| `#176` 有序列表 | 已修复 | 引入回归：数字消失 + 圆点覆盖 `○`/`✓` |
| `#170` 结构面板 | 浏览器冒烟通过 | `useMemo([editorView])` 依赖稳定对象 → 诊断**永不刷新** |
| `#170` 测试 | 408 passed | 残留 `makeMockView is not defined` 半成品文件未被计数，**误报为绿** |

### 修复必须同时防回归

修复缺陷时**必须**同时新增或扩展一条 `*.spec.ts`（e2e）或真实路径测试，**锁住该缺陷不再复现**。仅改源码不锁行为的修复不予合并（QG-2 在缺陷线的应用）。

### 从「功能不可见」类缺陷反查流程

当缺陷表现为「**功能根本没在操作页面中显示**」（如 `#170`：11 个功能未接入应用层）时，**不得只记为单张 bug 票**，必须反查 change 流程缺陷并写入 `docs/agents/retro-editor-v2-quality.md` 或对应 QG：

- 是 QG-1 失效（AC 写在库层）？
- 是 QG-2 失效（无 e2e 覆盖）？
- 是 QG-3 失效（接线无归属）？
- 是 QG-7 失效（横向切片）？

反查结论用于修订规范，避免同类问题在下一个 change 复现。

---

_最后更新：2026-09-20_
