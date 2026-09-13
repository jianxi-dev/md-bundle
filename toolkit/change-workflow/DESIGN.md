# 设计说明

## 设计目标

让 AI agent 每次变更都**按同一套可审计流程**执行，且**无需人工逐步催办**——包括跨会话的收尾。

## 三层结构

```
规范层  docs/agents/*.md        —— 拆票/issue/看板/标签/缺陷 的书面规范
执行层  skills/change-workflow  —— 把规范编码为 gate + 自愈回路（agent 的判断面）
机械层  scripts/pr-automation.sh + CI workflow —— 确定性动作（分支/提交/PR/信号）
```

**原则**：脚本管确定性机械动作，skill 管判断性质量保证——脚本不替代 skill，skill 不替代脚本。

## 五个 gate

| Gate | 执行 | 要点 |
|---|---|---|
| **G0 启动** | to-spec → openspec-propose → to-tickets | 输入归一化为 spec issue；切片**只在 propose 切一次**（垂直切片）；子票 Parent = spec issue |
| **G1 实施** | implement(内嵌 tdd) | 建票级分支 → 质量门禁 → G1 出口（code-review 必做 + review 条件） |
| **G2 提交/PR** | pr-automation.sh | `--resume-branch` 收口：白名单校验 → 门禁 → 提交 → push → PR 检测/创建 → 分级合并 |
| **G3 收尾** | learn + sync-gbrain | 非阻塞；**frontier 自动推进**队列中下一张可开工票 |
| **G4 归档** | openspec 套件 | 全部合并后自动：validate --strict → archive → 看板 Done → 关闭 spec issue |

## 关键设计决策

### 1. 1 issue = 1 PR（垂直切片）
`to-tickets` 的垂直切片（独立可演示/可验证）天然是独立 PR 单元。分支在 G1 建、G2 resume 收口；无 change 级贯穿分支。

### 2. Parent = 源 spec issue
遵循 to-tickets/to-spec 原语（「若源是既有 issue，Parent 引用它」）——不另建 change parent；spec issue 管需求定义，G4 才关闭。

### 3. fix-first 自愈回路
gate 失败默认**自行修复**（诊断 → 读规范 → 修复 → 重验），2 轮未通或涉权限/不可逆才升级用户。避免「停下来等用户」。

### 4. 跨会话自动收尾（合并信号）
```
合并 PR → CI(change-closure-signal) 检测 change 完成 → 打 change-close-pending 标签
       → agent 会话启动扫描该标签 → §8.1 收口检查 → 自动 G4
```
CI 是**确定性**触发（不依赖 agent 在线）；信号持久化在 GitHub（不丢）；agent 下次运行即消费。

### 5. 缺陷机制并行
`[bug]` 票 + triage 状态机 + P0/P1 分流（当前 PR 内修复 / fix 线）；fix 线与 feat 线对称（1 票 1 PR）。

## 参数化模型

所有项目相关值集中在 `.change-workflow.conf`（setup.sh 生成）：

| 类别 | 键 |
|---|---|
| 仓库 | `REPO` / `DEFAULT_BRANCH` |
| 看板 | `PROJECT_ID` / `STATUS_FIELD_ID` / `OPT_{BACKLOG,READY,IN_PROGRESS,DONE}` |
| 标签 | `LABEL_{READY,NEEDS_TRIAGE,...,RISK_*,SOURCE,CLOSURE_PENDING}` / `MODULE_LABELS` |
| 门禁 | `CMD_{TYPECHECK,LINT,TEST,E2E}`（留空跳过） |
| 目录 | `SKILLS_DIR` / `DOCS_DIR` |
| 可选 | `OPENSPEC_ENABLED` |

脚本 `source` 该文件；skill 读取它取看板常量；CI workflow checkout 后 source 它取标签名。

## 自动化边界

- ✅ **会话内**：frontier 自动推进（G3 后自动取下一张票）
- ✅ **跨会话**：合并信号 → 会话启动消费（自动 G4）
- ⚠️ **未覆盖**：合并后「立即」唤醒 agent——需常驻 agent runtime 接收 webhook（超出本工具包，可选扩展）
- 👤 **人工介入点**：仅 risk-medium/high PR 的合并确认

## 为什么这些约束

| 约束 | 原因 |
|---|---|
| 分支与 main 同步（strict） | 防陈旧分支合并引入隐藏冲突 |
| `--resume-branch` 白名单 | 防误提交白名单外改动（含 untracked） |
| `--refs-only` for parent | 防 PR 合并提前关闭 spec issue 生命周期 |
| auto-merge fail-open | 仓库未启用 auto-merge 时 PR 已创建即成功 |
| 质量门禁 push 前跑 | 本地 30s 拦截 vs CI 3min 权威，省 CI 轮次 |

## 来源

提炼自 md-bundle 项目的实战落地与三试点验证（功能 change 全 gate / 缺陷机制 / 既有 change 收尾）。设计全过程见该项目 `.omo/plans/change-workflow-process.md`。
