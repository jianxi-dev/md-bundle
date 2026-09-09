// 官方示例清单数据（任务 5.1）：从 Gallery.tsx 抽出，避免组件文件混导常量导致 Fast Refresh 警告。
export interface GalleryExample {
  id: string;
  name: string;
  desc: string;
  url: string;
  kind: 'md' | 'mdpkg';
}

/** 官方示例清单（public/examples/ 静态资源）。 */
export const GALLERY_EXAMPLES: GalleryExample[] = [
  {
    id: 'hello-md',
    name: 'Hello，Markdown',
    desc: '基础 Markdown：标题、表格、引用、代码块 —— 打开即编辑',
    url: 'examples/hello.md',
    kind: 'md',
  },
  {
    id: 'guide-md',
    name: '使用指南',
    desc: '三步完成一次图文分享：打开 → 导入图片 → 保存为 .mdpkg',
    url: 'examples/guide.md',
    kind: 'md',
  },
  {
    id: 'mdpkg-demo',
    name: '图文打包示例',
    desc: '.mdpkg 自包含包：Markdown + 内嵌图片，一个文件带走全部图文',
    url: 'examples/mdpkg-demo.mdpkg',
    kind: 'mdpkg',
  },
];
