# 任务发布与跟踪（to-tickets 桥接规范）

> 适用范围：把 OpenSpec change 的 tasks 发布为 GitHub issue，打通"spec → 开发 → 完成跟踪"全链路。
> 生效日期：2026-09-12
> 配套：`docs/agents/issue-tracker.md`（issue 操作）、`docs/agents/triage-labels.md`（状态标签）、`docs/agents/defect-workflow.md`（缺陷流程）

---

## 1. 核心原则

- **tasks.md 是唯一权威清单**，GitHub issue 是执行与跟踪面。issue 关闭时回写 tasks.md checkbox。
- **功能票与 bug 票统一仓库共存**：功能票标题带 `[change=<change名>]` 前缀，bug 票带 `[Px]` 前缀，靠标签区分。
- **1 task = 1 ticket**：每条任务一个 issue，带验收条件（AC）+ 阻塞关系（Blocked by）。

## 2. 拆票粒度

- **一条 task 一票**：tasks.md 本身就是垂直切片粒度（每条约 1 commit），天然匹配。
- **wave 级 parent issue**：每个 wave 一个总 issue，body 贴该 wave 的任务清单 checkboxes，子票引用它。
- 标题前缀防刷屏：`[change=md-bundle-v2/1.3]` 格式。

## 3. 发布规则（走 GitHub issue）

to-tickets 流程在本仓库一律发布为 GitHub issue（不使用本地 `.scratch/`），因为 tracker 配置就是 GitHub。

每个 ticket 必须包含：
- **Parent**：所属 wave parent issue 引用
- **What to build**：从用户视角描述端到端行为
- **Acceptance criteria**：具体可验证的 AC 清单
- **Blocked by**：阻塞它的其他 ticket 引用（无则 "None — can start immediately"）
- 标签：`ready-for-agent` + 模块标签

## 4. Parent tracking issue 模板

每个 change 建一个总跟踪 issue，body 贴完整 tasks 清单 checkboxes：

```markdown
## OpenSpec Change 跟踪：<change 名>

> 权威清单：`openspec/changes/<change 名>/tasks.md`
> 关联：子任务 issue 见下方各 wave 链接

## Wave 1 — <wave 名>

- [ ] 1.1 <任务名> — #<issue号>
- [ ] 1.2 <任务名> — #<issue号>

## Wave 2 — <wave 名>

- [ ] 2.1 <任务名> — #<issue号>
```

- parent issue 标签：`ready-for-agent` + `enhancement`
- 子票标题统一 `[change=<名>/<task号>]` 前缀
- 子票完成 → 勾选 parent checkbox → 全部勾完 → 归档 change

## 5. 完成回写

- 开发完成：commit 写 `fixes #<issue号>` → GitHub 自动关 issue
- 关 issue 时同步勾选 tasks.md 对应 checkbox
- 每轮开发会话末：`openspec status --change <名> --json` 对账 tasks.md 与 issue 关闭数

## 6. commit 规范（审计链）

- `fixes #N`：PR 合并时自动关闭 issue N
- `refs #N`：仅关联引用，不自动关闭
- 分支命名：`feat/<slug>`（功能）/ `fix/<slug>`（缺陷），1 分支 = 1 PR

## 7. Skill 编排与质量保证（2026-09-12 定稿）

> 对应 Lavish 联动方案 3.9 节。脚本（`pr-automation.sh`）负责确定性机械动作，skill 负责判断性质量保证——脚本不能替代 skill，skill 不能替代脚本。

### 7.1 执行前（实施阶段）

| Skill | 作用 | 强制? |
|---|---|---|
| `implement` | 总编排：按 spec/tickets 实施，自动内嵌 tdd + 定期 typecheck/test，完成后调 code-review | ✅ 必用 |
| `tdd` | 测试先行（红→绿 + 垂直切片），锁定行为契约 | ✅ implement 内嵌 |
| `programming` | 代码规范对照（no any / 250 LOC 上限） | 可选叠加 |
| 四件套硬门禁 | `pnpm -r typecheck/lint/test`（+e2e 涉及时），push 前强制 | ✅ `pr-automation.sh` 已内置 |

### 7.2 执行后（发布阶段）

| Skill | 作用 | 触发条件 |
|---|---|---|
| `code-review` | 双轴自审（Standards 代码规范 + Spec 需求符合，并行防互相掩盖） | ✅ 每次提交后 |
| `review` | Pre-Landing 结构审查（SQL 安全/LLM trust boundary/条件副作用/scope drift） | ⚠️ 仅 risk-medium/high |
| `qa` | 浏览器真机验证（diff-aware），health score + ship-readiness | 发布前 |
| `ship` | 全自动发布（版本 bump + CHANGELOG + PR）；**不重跑 test**（CI 已权威验证） | 正式发版 |

### 7.3 收尾（闭环，每轮必做）

| Skill | 作用 | 时机 |
|---|---|---|
| `learn` | 沉淀经验（模式/陷阱/偏好），`/learn` 管理 | ✅ 合并后 |
| `sync-gbrain` | 刷新代码索引，后续 agent 可语义检索新代码 | ✅ learn 之后 |

### 7.4 重复点优化（按风险分级的最小充分集）

- **test 4 层保留前三层**：tdd 单测（秒级反馈，锁行为）→ 本地四件套（push 前全量，防浪费 CI 轮次）→ CI build-test（权威环境，锁文件/平台差异）。价值递进非冗余。
- **ship 内 test 删除**：CI 已全绿，ship 只做版本+bump+CHANGELOG+PR，不重跑测试。
- **code-review 与 review 错开**：low → 仅 code-review；medium/high → 加 review。
- **净效果**：low = tdd→四件套→CI→code-review；medium/high = 上述 + review。

### 7.5 闭环示意

```
捡 issue → implement(tdd+typecheck/test) → 四件套硬门禁 → code-review
  → git-master 提交 fixes #N → push → pr create(risk 分级)
  → CI → low:auto-merge / medium/high:review+人工
  → 合并 → learn → sync-gbrain → 下一轮
qa(发布前真机) / ship(正式发版) 按需接入
```

---

_最后更新：2026-09-12_