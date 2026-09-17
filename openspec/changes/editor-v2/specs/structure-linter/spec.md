## ADDED Requirements

### Requirement: 结构诊断规则
系统 SHALL 基于 Lezer AST 运行结构诊断规则，无需 LLM。

#### Scenario: 论点无证据
- **WHEN** 段落含"因此/所以/综上"但后续 2 段内无列表/引用/表格
- **THEN** 显示 warning 诊断

#### Scenario: 标题层级跳跃
- **WHEN** H1 后直接出现 H3（跳过 H2）
- **THEN** 显示 error 诊断

#### Scenario: 超长段落
- **WHEN** 单段超过 300 字
- **THEN** 显示 info 诊断

### Requirement: 诊断结果交互
用户 SHALL 能一键跳转到诊断位置并标记为已处理。

#### Scenario: 跳转
- **WHEN** 用户点击诊断条目
- **THEN** 编辑器滚动到对应位置

#### Scenario: 标记已处理
- **WHEN** 用户右键诊断条目
- **THEN** 可选择"标记为已处理"，该诊断不再显示
