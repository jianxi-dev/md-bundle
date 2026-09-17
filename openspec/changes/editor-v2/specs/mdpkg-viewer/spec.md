## ADDED Requirements

### Requirement: .mdpkg 包内渲染器
.mdpkg 包 SHALL 包含 renderer/ 和 styles/ 目录，使包可独立渲染。

#### Scenario: 包格式结构
- **WHEN** 打包 .mdpkg
- **THEN** 包内包含 manifest.json + document.md + renderer/renderer.js + styles/styles.css + assets/*

### Requirement: 双击打开
用户 SHALL 能双击 .mdpkg 文件在浏览器中打开只读渲染视图。

#### Scenario: 双击打开
- **WHEN** 用户双击 .mdpkg 文件
- **THEN** 浏览器打开 viewer.html 并渲染文档内容

#### Scenario: 离线可用
- **WHEN** 无网络连接时打开 .mdpkg
- **THEN** 完整渲染（含样式、图片）

### Requirement: 导出 HTML 保真
导出的 HTML 与编辑器内渲染 SHALL 像素级一致。

#### Scenario: 富模板导出
- **WHEN** 文档包含 Hero Banner + Card Grid
- **THEN** 导出 HTML 与编辑器截图一致
