# ADR-0002: 编辑范式与渲染管线重构（v2：活的源码 + 共享渲染器）

> 状态：**已接受**（2026-09-06，Wave 6 文档收口）。
> 决策者：jianxi-dev 产品组。

## 背景

v1 上线后，用户提出编辑要「所见即预览」、预览要复用 clairis、布局要重构、要多页签。这直接撞上两条已锁决策：#13（Phase 1 = CM6 源码编辑，纯 WYSIWYG 留 Phase 2）与 AGENTS.md 的「No pure-WYSIWYG (milkdown/TipTap)」红线。同时核实发现：clairis 并没有标题折叠/块拖拽（用户记忆有误），但其渲染管线（marked + DOMPurify + KaTeX + mermaid + lezer + callout + CJK 间距）远成熟于 md-bundle 的自写管线，且为纯 Web 依赖、可抽取。

## 决定

**编辑范式定为「活的源码」**——底层永远 Markdown 源码，CM6 装饰隐藏记号并实时渲染（标题部件/加粗斜体/列表/引用/行内码/行内图片/callout 卡片），光标进入露回源码；不做块树文档模型，标题折叠/块拖拽/大纲明确不做。

**渲染管线收敛**：抽取 clairis 渲染器为 `@md-bundle/renderer`，web 端 .md 预览与 HTML/PNG 导出全部切换过去；消毒 SSOT 从自写消毒器切换为 DOMPurify；vendored `mdpkg-web.js` 渲染仅保留于包保真链路，页面上的 mdpkg iframe 静态参照预览取消。

方向分工：预览 = clairis→web 输血；编辑能力（装饰/页签）= web→clairis 反哺，与 #12 一致。

## 理由

mdpkg 的命脉是「源码即真相、往返字节保真」，装饰式编辑不触碰该契约，而 Milkdown/TipTap 的块树模型会让 `<<<include`、符号转换、消毒边界全部重做且保真风险大；自写消毒器继续与 DOMPurify 并存会制造第三条渲染链路，收敛比并存便宜；clairis 的阅读器镀铬（皮肤/字号缩放/宽度滑杆）与 md-bundle「编辑+打包工具」定位不符，不搬。

## 被否选项

| 选项 | 否决理由 |
|------|----------|
| Milkdown/TipTap 真·块编辑器 | 推翻「源码即真相」契约，`<<<include`/符号转换/消毒需在新引擎重做，往返保真风险大；块操作收益不抵引擎级重写成本 |
| 保留自写消毒器 + 仅借鉴 clairis 特性重造 | 重造 KaTeX/mermaid/lezer/callout/CJK 是重复劳动，且双消毒实现并存等于埋雷 |
| 编辑器整包换成 clairis 的 editor 内脏 | #12 已定共享库路线（`@md-bundle/editor`），装饰插件逐件移植可保持 barrel 契约与测试钉住；整包搬运会带入 clairis 的 store/桌面假设 |
| 皮换 clairis 纸墨风 | md-bundle 深色 #165DFF 品牌已上线（#5），布局的病根是铬框结构而非色相；只借哲学（最少干扰/减法/三层 token）不换皮 |

## 后果

- AGENTS.md 反模式条款「消毒 SSOT = `@md-bundle/editor` renderMarkdownToHtml」修订为「= `@md-bundle/renderer`」；editor barrel 导出面收缩（public-api 测试同步）。
- monorepo 新增 `packages/renderer`；katex/mermaid 必须懒加载分包（CI bundle 哨兵）。
- clairis 未来可用同形 API 接回 renderer 与 editor 装饰，反哺路径已留但不属本期。
- #13 部分推翻（WYSIWYG 提前、但形态钉死为装饰式）；#11 部分推翻（多页签提前）；Milkdown/TipTap 红线不动。

## 关联

- ADR-0001：格式与产品命名（v1 基线）
- 决策 #18–#45：见 `.omo/decisions.md`
- 计划：`.omo/plans/md-bundle-v2.md`
- OpenSpec：`openspec/changes/md-bundle-v2/`
