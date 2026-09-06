# GitHub仓库命名方案：MD\-Bundle

# GitHub 仓库命名方案

分 4 类：**专业正式、简洁极客、产品化、创意小众**，同时兼顾：SEO 搜索、GitHub 搜索友好、可以直接用作 NPM/PyPI 包名、仓库名小写横杠分隔，无大写，github 习惯。

> 背景：项目是 **MD‑Bundle**，给 Markdown 实现单文件内嵌图片资源，后缀依旧`.md`，注释块内嵌 zlib 压缩资源，不创造新后缀，解决 md 分享裂图。
> 
> 

## 🎯首选推荐（综合最优，优先选）

### 1\. `md-bundle` ⭐⭐⭐⭐⭐

- 优点：直接对应规范名称，简短、语义一目了然，GitHub 搜索关键词命中高；适合做规范 \+ SDK \+ 工具一体仓库；未来包名（pypi/npm）也可以叫 `md‑bundle`。

- 仓库描述 \(description\)：

> MD‑Bundle: Self‑contained Markdown single‑file format, embed images inside \.md file without new file extension\.
> 
> 

> 翻译：MD‑Bundle：自包含 Markdown 单文件格式，无需新后缀即可在 md 内嵌入图片。
> 
> 

> **最推荐这个，和你的草案命名完全统一，对外讲方案、文档、插件全部统一术语，降低认知成本。**
> 
> 

---

## 备选 A｜偏向工具 / 工程（如果你仓库重点放 CLI、代码实现，不只放规范文档）

2. `md-self-contained`

> 语义：自包含 Markdown，强调 “单文件自带资源”，但是名字偏长
> 
> 

3. `md-pack`

> 简短有力，pack = 打包；缺点：太泛，github 有一堆 md‑pack 重名仓库
> 
> 

4. `markdown-bundle`

> 完整单词，搜索友好，但名字偏长
> 
> 

## 备选 B｜创意向（不推荐为主仓库，适合个人玩具项目）

5. `md-embox`

> md \+ box，把图片装进盒子，很形象；但是陌生词汇，不利于搜索发现
> 
> 

6. `md-portable`

> portable：可便携的 Markdown，突出分享分发场景；名字长
> 
> 

## ❌不建议

- `mde-format`：历史冲突 Access MDE，绝对不要

- `mdpkg`：自定义容器后缀名字，你的方案不走自定义后缀，仓库名不要用这个，容易混淆

---

# 仓库配套建议（非常关键，决定能不能吸引 star）

### 仓库全名：`md‑bundle`

**Repo Description（复制直接用）**

> MD‑Bundle: Self‑contained Markdown format\. Embed images inside standard `.md` file, no new extension\. Graceful degradation for all markdown editors\.
> 
> 

**README 结构建议**

1. 痛点：Markdown 分享图片丢失

2. 为什么不用 base64 /zip 容器 /mde/mdpkg

3. 规范简述（链接指向 \[SPEC\.md\]\(SPEC\.md\)）

4. 快速上手：CLI 打包 / 解包示例

5. Example 样例文件

6. 兼容性矩阵

7. Roadmap：Python SDK、VSCode 插件、Web 工具、Obsidian 插件

8. 规范文档 SPEC‑\[V1\.0\.md\]\(V1\.0\.md\) 放在仓库根目录

### 文件结构建议

```Plain Text
md-bundle/
├── README.md
├── SPEC‑V1.0.md        # 完整规范草案
├── example/
│   └── demo.bundle.md  # 样例md‑bundle文件
├── python/             # python实现代码
│   └── mdbundle/
└── docs/
```

## 补充：如果未来想做网页在线工具，可以配套域名

`mdbundle.dev`，和仓库名完全对应。

如果你打算开源，我可以帮你直接写一份完整 \[README\.md\]\(README\.md\) 模板。

> （注：部分内容可能由 AI 生成）
