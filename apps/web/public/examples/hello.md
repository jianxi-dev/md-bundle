# Hello，MD-Bundle

欢迎使用 **MD-Bundle** —— 把 Markdown 和图片打包进一个文件，分享不再裂图。

## 快速上手

| 操作 | 说明 |
| --- | --- |
| 打开 | 拖入或选择 .md / .mdpkg 文件 |
| 编辑 | 左侧源码，右侧实时预览 |
| 导出 | .md / .mdpkg / .html / .png |

> [!NOTE]
> 这是官方示例文档。你可以直接编辑它，或把它导出为 .mdpkg 体验打包流程。

## 代码示例

```ts
function bundle(markdown: string, images: File[]): Mdpkg {
  return pack({ markdown, images });
}
```

## 特性列表

- 自包含：图片内嵌，单文件分发
- 双模式预览：普通文本 / 完整资源
- 开源（MIT）