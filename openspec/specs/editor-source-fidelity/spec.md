# editor-source-fidelity Specification

## Purpose
TBD - created by archiving change editor-porting-gate. Update Purpose after archive.
## Requirements
### Requirement: WYSIWYG 操作后源码无损

对一份覆盖全部块类型的文档执行任意一次 WYSIWYG 操作后，底层 Markdown 源码 SHALL 只在操作目标处变化，其余字节保持不变。操作产生的变化 SHALL 是该操作的预期形式，不得夹带格式改写、空白重排或标记丢失。

#### Scenario: 段落转标题
- **WHEN** 光标位于正文段落「正文」，用户经块手柄把该块转为二级标题
- **THEN** 该行源码变为 `## 正文`，文档其余行逐字节不变

#### Scenario: 标题转回正文
- **WHEN** 用户把 `## 标题` 转为正文
- **THEN** 该行源码变为 `标题`，文档其余行逐字节不变

#### Scenario: 待办勾选
- **WHEN** 用户点击 `- [ ] 买牛奶` 前的复选框
- **THEN** 该行源码在 `[ ]` 与 `[x]` 之间切换，文档其余行逐字节不变

#### Scenario: 引用块内文本追加
- **WHEN** 用户把光标放到 `> 引用段落` 末尾并输入 `补充`
- **THEN** 该行变为 `> 引用段落补充`，引用标记保留，其余行逐字节不变

#### Scenario: 代码块编辑
- **WHEN** 用户在围栏代码块内追加一行代码
- **THEN** 围栏标记（含语言标识）与块外内容逐字节不变，仅代码体新增该行

#### Scenario: 高亮块标题与正文编辑
- **WHEN** 用户在 callout 卡片标题输入 `标题`、在正文输入 `新文字` 后失焦
- **THEN** 源码首行为 `> [!TYPE] 标题`，正文行为 `> 新文字`，块外内容逐字节不变

#### Scenario: 表格单元格编辑
- **WHEN** 用户把表格第 2 行第 2 列的 `B2` 改为 `改`
- **THEN** 仅该单元格源码变化，表格分隔行与其余单元格逐字节不变

#### Scenario: 表格插入行
- **WHEN** 用户经行热点在第 1 行后插入一行
- **THEN** 源码新增一行等宽空单元格，原有行与分隔行逐字节不变

#### Scenario: 分栏插入
- **WHEN** 用户经插入菜单插入 2 栏分栏
- **THEN** 源码新增 `::: {.col-2}` 与 `:::` 成对围栏，文档其余行逐字节不变

#### Scenario: 行内加粗
- **WHEN** 用户选中文字 `加粗` 并按 Ctrl/Cmd+B
- **THEN** 源码变为 `**加粗**`，选区外文字逐字节不变

#### Scenario: 文字颜色
- **WHEN** 用户选中文字 `红字` 并把它设为红色
- **THEN** 源码出现且仅出现一处颜色包裹（`<span class="mdb-color-red">红字</span>` 或等价形式），选区外文字逐字节不变

#### Scenario: 插入图片
- **WHEN** 用户经斜杠菜单插入一张 `photo.png`
- **THEN** 源码新增且仅新增 `![photo.png](photo.png)`，文档其余行逐字节不变

### Requirement: 往返矩阵可复跑

红线 1 的验收 SHALL 由仓库内常驻 e2e 用例承担，随 `CMD_E2E` 复跑，不依赖一次性手工脚本或静态文档。

#### Scenario: 复跑矩阵
- **WHEN** 维护者运行 `pnpm --filter @md-bundle/web exec playwright test test/roundtrip-source-fidelity.spec.ts`
- **THEN** 12 类操作各有一条对应用例执行并给出通过或失败（另有一条基线用例锁定度量方式）

#### Scenario: 失败可定位
- **WHEN** 某类操作破坏了源码
- **THEN** 失败信息给出该类操作的期望片段与实际源码差异，可据以定位到具体装饰器

