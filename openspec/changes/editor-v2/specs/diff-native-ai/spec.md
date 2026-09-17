## ADDED Requirements

### Requirement: AI 修改为行内 diff
AI 对文档的修改 SHALL 以行内 diff 提案形式呈现，不能静默落盘。

#### Scenario: 选中改写
- **WHEN** 用户选中文本并点击 AI 改写
- **THEN** 原文显示红色删除线，建议文本显示绿色背景

#### Scenario: 逐 hunk 审阅
- **WHEN** AI 返回多段修改
- **THEN** 用户按 Tab 接受当前 hunk，按 Esc 拒绝

### Requirement: Provider 模型
系统 SHALL 支持 LocalProvider / BYOKeyProvider / Disabled 三种 AI Provider。

#### Scenario: 无 AI
- **WHEN** Provider = Disabled
- **THEN** 产品 100% 可用，不显示 AI 入口

#### Scenario: BYO key
- **WHEN** 用户配置自己的 API key
- **THEN** key 仅存内存，刷新需重输

### Requirement: Privacy Ledger
每次 AI 调用 SHALL 记录到 Privacy Ledger。

#### Scenario: 审计记录
- **WHEN** 用户触发 AI 操作
- **THEN** Ledger 面板显示发送了什么、去了哪里
