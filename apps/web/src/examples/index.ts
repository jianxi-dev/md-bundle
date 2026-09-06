// 示例文档集合（任务 2.6）：3 个演示文档源数据。
// 供 Landing 精选作品卡片 + todo 28 SEO 静态页 + todo 27 分享卡共用。
// 每个 example 是真渲染源（非占位），renderMarkdown 直接消费。
import { formulaMermaidExample } from './formula-mermaid';
import { calloutTableExample } from './callout-table';
import { imagePackageExample } from './image-package';
import type { ExampleDoc } from './formula-mermaid';

export type { ExampleDoc } from './formula-mermaid';

/** 精选作品示例清单（Landing 卡片 + SEO/分享共用）。 */
export const FEATURED_EXAMPLES: ExampleDoc[] = [
  formulaMermaidExample,
  calloutTableExample,
  imagePackageExample,
];
