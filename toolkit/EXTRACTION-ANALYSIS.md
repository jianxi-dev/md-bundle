# 分析：是否应将 change-workflow 提取为独立仓库

**日期**：2026-09-20
**对象**：`md-bundle/toolkit/change-workflow/`
**结论**：**建议提取**，但需先补齐工具包自身的 CI，并明确迁移路径。

---

## 一、现状

| 项 | 事实 |
|---|---|
| 位置 | `md-bundle/toolkit/change-workflow/`（md-bundle 既是**消费方**又是**分发源**） |
| 消费方 | 3 个：md-bundle（源）、mdpkg、clairis |
| 已有独立身份 | `VERSION`（1.1.0）、`CHANGELOG.md`、`setup.sh` / `update.sh`、`lib/render.sh` |
| 分发方式 | 消费者需有 md-bundle 的本地路径，`update.sh` 从其读取模板 |
| 自身测试 | **无**（安装/升级逻辑靠人工验证；本轮才发现 2 个真实缺陷） |

---

## 二、支持提取的理由

### 1. 生命周期已经独立（决定性理由）

工具包现在有自己的版本号、changelog、安装/升级机制 —— 它**已经是一个产品**了。它的演进节奏（新增门禁、修订规范、修模板缺陷）与 md-bundle 的产品节奏**无关**。

把它放在消费方仓库里，正是 `update.sh` 想消除的那种耦合：

- md-bundle 的任何提交（产品代码、vendor bundle）都会进入工具包的「分发上下文」
- 消费者要拿工具包更新，必须 `pull` 整个 md-bundle（含 749KB vendor bundle、整个 web 应用）
- 工具包的变更埋在产品仓库历史里，**难以审计**

### 2. 分发路径不干净

今天的升级指令是：

```bash
/Users/mason/ToHighs/md-bundle/toolkit/change-workflow/update.sh
```

一个绝对路径，指向**另一个仓库的检出位置**。这要求消费者知道并维护「md-bundle 在哪儿」。独立仓库后：

```bash
git clone https://github.com/jianxi-dev/change-workflow ~/.change-workflow
~/.change-workflow/update.sh   # 或进一步：--from <release tarball>
```

### 3. 工具包自身的缺陷无处安放

本轮发现并修复了 2 个工具包自身的真实缺陷：

- **manifest 基线 bug**：冲突文件的基线被重写 → 本地版被静默接受为正典 → 此后模板更新会无提示覆盖
- **`$dst（` Unicode bug**：`$VAR` 紧邻全角字符被 bash 解析为变量名的一部分 → `set -u` 下崩溃（整个 `--force` 路径不可用）

这类缺陷**属于工具包**，却只能记在 md-bundle 的 issue tracker 里，与产品缺陷混在一起。

### 4. 工具包没有 CI

本轮的 7 阶段 / 20 断言端到端测试**是我手工跑的**。它应该：

- 常驻为 `test/install-update-e2e.sh`
- 在每次工具包 PR 上由 CI 执行（headless，无需 GitHub 凭证 —— 测试用临时 git 仓库 + 手写 conf）
- 外加 `shellcheck` + `bash -n`

**没有 CI 的「基础设施」是危险的** —— 本轮两个缺陷都是靠人工端到端测试才发现的，这不可持续。

### 5. 降低 md-bundle 的认知负担

md-bundle 是产品仓库。让它的 PR 与评审同时承载「产品变更」与「流程基础设施变更」，两者混在一起。

---

## 三、反对提取的理由（及评估）

| 顾虑 | 评估 |
|---|---|
| **多一个仓库要维护**（3 → 4） | 成立但可接受。工具包改动频率远低于产品；且它已有版本/变更日志，维护成本已存在，只是位置不同 |
| **自举问题**：工具包仓库该用 change-workflow 管理自己吗？ | 可解决：把它自己安装到自己（`./setup.sh --target .`）。实际上这是最强 dogfooding |
| **失去「在真实产品中打磨」** | **不成立**。提取后 md-bundle 仍是消费者，摩擦与经验照样产生，只是需要「回灌到独立仓库」这一步 —— 而这一步现在**本来就有**（本轮就是活文件 → 模板的回灌） |
| **多一个 remote 要知道** | 成立但很小：`update.sh` 里写死/传入一次即可 |
| **模板与活文件重复**（md-bundle 同时持有两份） | **提取后反而改善**：md-bundle 变成普通消费者，不再有「源」的特殊地位，重复消失 |

---

## 四、决策判据

我建议用两条判据：

| 条件 | 当前状态 |
|---|---|
| 存在 ≥2 个「非源」消费者 | ✅ mdpkg + clairis |
| 工具包会持续演进（非一次性快照） | ✅ 刚获得版本号与升级机制，且本轮仍在演进 |

**两条均成立 → 提取。**

反之，若工具包将**冻结**（不再演进），则留在原地更省事。

---

## 五、推荐方案

### 目标结构

```
jianxi-dev/change-workflow            # 独立仓库
├── VERSION                            # 1.1.0
├── CHANGELOG.md
├── README.md / INSTALL.md / DESIGN.md
├── setup.sh / update.sh
├── lib/render.sh
├── config.example.conf
├── skills/change-workflow/SKILL.md
├── docs/agents/*.md                   # 9 份规范模板
├── scripts/pr-automation.sh
├── workflows/change-closure-signal.yml
└── test/install-update-e2e.sh         # 本轮的手工测试 → 落地为可重复脚本
    └── .github/workflows/ci.yml       # shellcheck + bash -n + e2e
```

### 迁移路径（低风险，分 5 步）

1. **建仓**：以 `toolkit/change-workflow/*` 为初始提交；打 tag `v1.1.0`
2. **补 CI**：`shellcheck` + `bash -n` + `test/install-update-e2e.sh`（headless，无需凭证）
3. **下游切换**：mdpkg / clairis 的 `update.sh` 指向新仓库；验证升级成功
4. **md-bundle 降级为普通消费者**：删 `toolkit/`，改为自己安装自己（dogfooding）
   - 过渡期可保留一个 `toolkit/README.md` 指针，指向新仓库地址
5. **回灌机制**：在 md-bundle 遇到的工具包问题 → 去独立仓库开票修复 → 各仓库 `update.sh` 升级

### 分发方式（推荐序）

| 方案 | 说明 | 评价 |
|---|---|---|
| **A. `git clone` + `update.sh`** | 最简单，零新工具 | ✅ **先做这个** |
| **B. release tarball + `update.sh --from <url>`** | 不用 clone；`--from https://github.com/.../archive/refs/tags/v1.2.0.tar.gz` | ✅ 独立后加，体验最好 |
| C. git submodule | 子模块摩擦大 | ❌ |
| D. npm 包 | shell + markdown 用 npm 分发过重 | ❌ |

---

## 六、若暂不提取的替代方案

保留在 md-bundle 内，但补两件事即可获得大部分收益：

1. **给 `toolkit/change-workflow/` 加独立 CI job**（改动该目录时触发：shellcheck + bash -n + e2e 测试）
2. **用带前缀的 tag 做版本化分发**（如 `toolkit-v1.1.0`），消费者按 tag 取

**代价**：消费者仍需 clone 整个 md-bundle；工具包缺陷仍混在 md-bundle tracker。

---

## 七、一句话

> 工具包已经长出「产品」的全部特征（版本、changelog、安装器、升级器、消费者），却仍住在**其中一个消费者**的仓库里 —— 这是提取的信号，不是「要不要多养一个仓库」的问题。
>
> **先补 CI 再搬家**：没有 CI 的基础设施，本轮那两个缺陷还会再来一次。
