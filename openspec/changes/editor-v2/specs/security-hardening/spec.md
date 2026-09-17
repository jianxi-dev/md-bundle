## ADDED Requirements

### Requirement: DOMPurify 配置修复
渲染器 SHALL 从 ALLOWED_ATTR 移除 `style` 和 `id` 属性，开 ALLOW_DATA_ATTR 和 SANITIZE_NAMED_PROPS。

#### Scenario: 移除 style 属性
- **WHEN** 渲染包含 `<div style="position:fixed">` 的 Markdown
- **THEN** style 属性被剥离，输出 `<div></div>`

#### Scenario: 移除 id 属性
- **WHEN** 渲染包含 `<a name="cookie">` 的 Markdown
- **THEN** id/name 属性被净化

#### Scenario: 保留 data-* 属性
- **WHEN** 渲染包含 `data-callout="info"` 的 HTML
- **THEN** data-callout 属性保留

### Requirement: CSP headers
生产环境 SHALL 设置 Content-Security-Policy 响应头。

#### Scenario: Vercel 部署
- **WHEN** 通过 Vercel 域名访问
- **THEN** 响应头包含 CSP 且 img-src 限制为 self data: blob:

#### Scenario: GitHub Pages 部署
- **WHEN** 通过 GitHub Pages 域名访问
- **THEN** index.html 包含 CSP meta 标签

### Requirement: API key 存储
AI Provider API key SHALL 仅存内存，绝不持久化到 localStorage/sessionStorage/IndexedDB。

#### Scenario: 页面刷新
- **WHEN** 用户刷新页面
- **THEN** API key 丢失，需重新输入

#### Scenario: XSS 攻击
- **WHEN** 恶意脚本尝试读取 localStorage
- **THEN** 无法获取 API key（因为不存在）

### Requirement: CSS 隔离
编辑器内嵌 HTML widget 的 CSS SHALL 与编辑器宿主隔离。

#### Scenario: class 名称冲突
- **WHEN** 用户 HTML 包含 `class="cm-content"`
- **THEN** 不会命中编辑器宿主样式
