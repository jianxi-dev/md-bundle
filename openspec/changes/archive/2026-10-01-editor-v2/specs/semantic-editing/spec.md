## ADDED Requirements

### Requirement: 渐进式语法揭示
编辑态 SHALL 根据光标位置动态调整语法标记的可见性。

#### Scenario: 非活动块
- **WHEN** 光标不在某块内
- **THEN** 该块完全渲染，零源码符号

#### Scenario: 活动块
- **WHEN** 光标在某块内
- **THEN** 结构标记（#、>、-）以 40% 透明度弱化显示，内联标记（**、*）完全隐藏

#### Scenario: 布局稳定
- **WHEN** 光标移入/移出块
- **THEN** 行高不变（CLS < 0.01）

### Requirement: 交换方式
用户 SHALL 能通过多种方式在语义态和源码态之间切换。

#### Scenario: 光标进出
- **WHEN** 光标移入块
- **THEN** 自动切换为语义态

#### Scenario: 临时查看源码
- **WHEN** 用户 Ctrl+点击块
- **THEN** 临时显示完整源码，松手恢复

#### Scenario: 全局模式切换
- **WHEN** 用户点击工具栏 ghost 图标
- **THEN** 在编辑/源码/预览三种全局模式间切换
