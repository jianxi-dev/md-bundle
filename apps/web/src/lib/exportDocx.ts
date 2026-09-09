// DOCX 导出 —— 纯逻辑 + 依赖注入（downloadBlob 可替换），jsdom 可整函数单测。
// 流程：markdown → 解析为结构化块 → docx Document → Blob 下载。
// 依赖 docx（已在 package.json），零额外引入。

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  ImageRun,
  ExternalHyperlink,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
} from 'docx';
import type { Asset } from './assets';
import { downloadBlob, type CreateObjectUrl } from './download';

/** 默认下载文件名。 */
export const DEFAULT_DOCX_FILENAME = 'document.docx';

export interface ExportDocxOptions {
  /** Markdown 源文本。 */
  markdown: string;
  /** 文档标题（用于文档属性）。 */
  title?: string;
  /** 图片资产清单（图片引用解析为内联）。 */
  assets?: Asset[];
  /** 下载实现，默认 downloadBlob —— 测试注入 spy 断言字节与文件名。 */
  download?: (blob: Blob, filename: string, createObjectUrl?: CreateObjectUrl) => void;
  /** 下载文件名，默认 'document.docx'。 */
  filename?: string;
}

/** 行内元素类型。 */
type InlineElement =
  | { type: 'text'; text: string }
  | { type: 'bold'; children: InlineElement[] }
  | { type: 'italic'; children: InlineElement[] }
  | { type: 'code'; text: string }
  | { type: 'link'; url: string; children: InlineElement[] }
  | { type: 'image'; src: string; alt: string };

/** 块级元素类型。 */
type BlockElement =
  | { type: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; children: InlineElement[] }
  | { type: 'paragraph'; children: InlineElement[] }
  | { type: 'codeBlock'; text: string; language?: string }
  | { type: 'blockquote'; children: BlockElement[] }
  | { type: 'list'; ordered: boolean; items: BlockElement[][] }
  | { type: 'table'; headers: InlineElement[][]; rows: InlineElement[][][] }
  | { type: 'hr' }
  | { type: 'image'; src: string; alt: string };

/** 剥离 YAML frontmatter（文件开头被 --- 包裹的元数据块）。 */
function stripYamlFrontmatter(md: string): string {
  const trimmed = md.replace(/^\s+/, '');
  if (!trimmed.startsWith('---')) return md;
  const lines = trimmed.split('\n');
  // 找闭合的 ---（第二行起）
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      return lines.slice(i + 1).join('\n');
    }
  }
  return md;
}

/**
 * 简易 Markdown 解析器 —— 仅覆盖 docx 导出所需的常见语法：
 * 标题、段落、粗体、斜体、行内代码、链接、图片、代码块、引用、有序/无序列表、表格、分割线。
 * 不追求完整 CommonMark 兼容；复杂嵌套场景回退为纯文本段落。
 */
function parseMarkdown(md: string): BlockElement[] {
  const blocks: BlockElement[] = [];
  const stripped = stripYamlFrontmatter(md);
  const lines = stripped.split('\n');
  let i = 0;

  const isBlockStart = (l: string): boolean =>
    /^(#{1,6}\s|```|>|(\s*)(?:[-*+]|\d+\.)\s+|!\[)/.test(l) ||
    /^(---|\*\*\*|___)\s*$/.test(l.trim());

  while (i < lines.length) {
    const line = lines[i];

    // 空行
    if (line.trim() === '') {
      i++;
      continue;
    }

    // 分割线
    if (/^(---|\*\*\*|___)\s*$/.test(line.trim())) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // 标题
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6;
      blocks.push({ type: 'heading', level, children: parseInline(headingMatch[2].trim()) });
      i++;
      continue;
    }

    // 代码块
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim() || undefined;
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push({ type: 'codeBlock', text: codeLines.join('\n'), language: lang });
      continue;
    }

    // 引用块
    if (line.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        quoteLines.push(lines[i].slice(1).trimStart());
        i++;
      }
      const inner = quoteLines.join('\n');
      blocks.push({ type: 'blockquote', children: parseMarkdown(inner) });
      continue;
    }

    // 表格：表头 | 分隔线 | 数据行
    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{1,3}:?\s*(\|\s*:?-{1,3}:?\s*)+\|?\s*$/.test(lines[i + 1])) {
      const parseRow = (row: string): InlineElement[][] => {
        const cells = row.split('|').map((c) => c.trim());
        const filtered = cells.filter((_, idx, arr) => !(idx === 0 && arr[0] === '') && !(idx === arr.length - 1 && arr[arr.length - 1] === ''));
        return filtered.map((c) => parseInline(c));
      };
      const headers = parseRow(line);
      i += 2;
      const rows: InlineElement[][][] = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '' && !isBlockStart(lines[i])) {
        rows.push(parseRow(lines[i]));
        i++;
      }
      blocks.push({ type: 'table', headers, rows });
      continue;
    }

    // 列表
    if (/^(\s*)([-*+]|\d+\.)\s+/.test(line)) {
      const items: BlockElement[][] = [];
      const ordered = /^\d+\./.test(line.trimStart());
      while (i < lines.length) {
        const m = lines[i].match(/^(\s*)(?:[-*+]|\d+\.)\s+(.+)$/);
        if (!m) break;
        const itemContent = m[2];
        const subLines = [itemContent];
        i++;
        while (
          i < lines.length &&
          lines[i].trim() !== '' &&
          !isBlockStart(lines[i]) &&
          /^(\s*)(?:[-*+]|\d+\.)\s+/.test(lines[i]) === false
        ) {
          subLines.push(lines[i].trimStart());
          i++;
        }
        items.push(parseMarkdown(subLines.join('\n')));
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }

    // 图片（单独一行只有图片）
    const imgOnlyMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/);
    if (imgOnlyMatch) {
      blocks.push({ type: 'image', src: imgOnlyMatch[2], alt: imgOnlyMatch[1] });
      i++;
      continue;
    }

    // 段落（可能跨多行，直到空行或新块开始）
    const paraLines: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !isBlockStart(lines[i])
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push({ type: 'paragraph', children: parseInline(paraLines.join('\n')) });
  }

  return blocks;
}

/** 解析行内元素（粗体、斜体、代码、链接、图片）。 */
function parseInline(text: string): InlineElement[] {
  const elements: InlineElement[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    // 图片 ![alt](src)
    const imgMatch = remaining.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
    if (imgMatch) {
      elements.push({ type: 'image', src: imgMatch[2], alt: imgMatch[1] });
      remaining = remaining.slice(imgMatch[0].length);
      continue;
    }

    // 链接 [text](url)
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      elements.push({ type: 'link', url: linkMatch[2], children: parseInline(linkMatch[1]) });
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    // 粗体+斜体 ***text***
    const boldItalicMatch = remaining.match(/^\*\*\*([^*]+)\*\*\*/);
    if (boldItalicMatch) {
      elements.push({ type: 'bold', children: [{ type: 'italic', children: parseInline(boldItalicMatch[1]) }] });
      remaining = remaining.slice(boldItalicMatch[0].length);
      continue;
    }

    // 粗体 **text**
    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) {
      elements.push({ type: 'bold', children: parseInline(boldMatch[1]) });
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // 斜体 *text*
    const italicMatch = remaining.match(/^\*([^*]+)\*/);
    if (italicMatch) {
      elements.push({ type: 'italic', children: parseInline(italicMatch[1]) });
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }

    // 行内代码 `code`
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      elements.push({ type: 'code', text: codeMatch[1] });
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // 普通文本（取到下一个特殊字符）
    const nextSpecial = remaining.search(/[*`[]!]/);
    if (nextSpecial === -1) {
      elements.push({ type: 'text', text: remaining });
      break;
    }
    if (nextSpecial === 0) {
      // 无法匹配的特殊字符，当作普通文本
      elements.push({ type: 'text', text: remaining[0] });
      remaining = remaining.slice(1);
    } else {
      elements.push({ type: 'text', text: remaining.slice(0, nextSpecial) });
      remaining = remaining.slice(nextSpecial);
    }
  }

  return elements;
}

/** 将行内元素转换为 docx TextRun 数组。bold/italic 由调用方通过参数传入。 */
function inlineToRuns(
  elements: InlineElement[],
  opts: { bold?: boolean; italics?: boolean } = {},
): (TextRun | ExternalHyperlink)[] {
  const runs: (TextRun | ExternalHyperlink)[] = [];

  for (const el of elements) {
    switch (el.type) {
      case 'text':
        runs.push(new TextRun({ text: el.text, bold: opts.bold, italics: opts.italics }));
        break;
      case 'bold':
        runs.push(...inlineToRuns(el.children, { bold: true, italics: opts.italics }));
        break;
      case 'italic':
        runs.push(...inlineToRuns(el.children, { bold: opts.bold, italics: true }));
        break;
      case 'code':
        runs.push(new TextRun({ text: el.text, font: 'Consolas', color: '333333', bold: opts.bold, italics: opts.italics }));
        break;
      case 'link':
        runs.push(
          new ExternalHyperlink({
            children: el.children.flatMap((c) => {
              if (c.type === 'text') return [new TextRun({ text: c.text, style: 'Hyperlink' })];
              return inlineToRuns([c], opts);
            }),
            link: el.url,
          }),
        );
        break;
      case 'image':
        // 行内图片在段落中跳过（块级图片单独处理）
        break;
    }
  }

  return runs;
}

/** 段落级样式参数（用于 list/blockquote 等容器内子块的样式传递）。 */
interface ParagraphStyle {
  numbering?: { reference: string; level: number };
  indent?: { left: number };
  border?: { left: { style: string; size: number; color: string } };
}

/** 将块级元素转换为 docx Paragraph 或 Table 数组。 */
function blockToParagraphs(
  block: BlockElement,
  assets?: Asset[],
  style?: ParagraphStyle,
): (Paragraph | Table)[] {
  switch (block.type) {
    case 'heading': {
      const levelMap: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
        1: HeadingLevel.HEADING_1,
        2: HeadingLevel.HEADING_2,
        3: HeadingLevel.HEADING_3,
        4: HeadingLevel.HEADING_4,
        5: HeadingLevel.HEADING_5,
        6: HeadingLevel.HEADING_6,
      };
      return [
        new Paragraph({
          heading: levelMap[block.level],
          children: inlineToRuns(block.children),
        }),
      ];
    }
    case 'paragraph':
      return [
        new Paragraph({
          numbering: style?.numbering,
          indent: style?.indent,
          border: style?.border as never,
          children: inlineToRuns(block.children),
        }),
      ];
    case 'codeBlock':
      return [
        new Paragraph({
          numbering: style?.numbering,
          indent: style?.indent,
          border: style?.border as never,
          children: [new TextRun({ text: block.text, font: 'Consolas', size: 20 })],
          shading: { fill: 'F5F5F5' },
        }),
      ];
    case 'blockquote':
      return block.children.flatMap((child) =>
        blockToParagraphs(child, assets, {
          indent: { left: 720 },
          border: { left: { style: 'single', size: 3, color: '808080' } },
        }),
      );
    case 'list': {
      const numbering = block.ordered
        ? { reference: 'ordered-list', level: 0 }
        : { reference: 'unordered-list', level: 0 };
      return block.items.flatMap((item) =>
        item.flatMap((subBlock) =>
          blockToParagraphs(subBlock, assets, { numbering }),
        ),
      );
    }
    case 'table': {
      const colCount = block.headers.length;
      /** 计算每列内容的字符宽度（中文字符算 2，英文算 1）。 */
      const textWidth = (elems: InlineElement[]): number => {
        let w = 0;
        for (const el of elems) {
          switch (el.type) {
            case 'text':
            case 'code':
              w += [...el.text].reduce((s, ch) => s + (ch.charCodeAt(0) > 127 ? 2 : 1), 0);
              break;
            case 'bold':
            case 'italic':
            case 'link':
              w += textWidth(el.children);
              break;
            case 'image':
              break;
          }
        }
        return w;
      };
      /** 计算每列的最大内容宽度（含表头）。 */
      const colWidths: number[] = [];
      for (let c = 0; c < colCount; c++) {
        let maxW = textWidth(block.headers[c] ?? []);
        for (const row of block.rows) {
          const w = textWidth(row[c] ?? []);
          if (w > maxW) maxW = w;
        }
        colWidths.push(maxW);
      }
      /**
       * 将内容宽度映射到 DXA 单位（总可用宽度 9000 DXA）。
       * 最小列宽保证表头 4 个中文字（8 宽度单位）不换行：
       *   - 最小 800 DXA（约 0.89 英寸 / 22.6mm），足以容纳 4 个五号中文字
       *   - 若按比例分配后总宽超出 9000，则等比压缩
       */
      const totalContentWidth = colWidths.reduce((s, w) => s + w, 0);
      const totalDxa = 9000;
      const minDxa = 800;
      let colDxaWidths = colWidths.map((w) => {
        if (totalContentWidth === 0) return Math.floor(totalDxa / colCount);
        return Math.max(minDxa, Math.floor((w / totalContentWidth) * totalDxa));
      });
      // 若最小列宽导致总宽超出可用宽度，等比压缩到 9000
      const allocatedTotal = colDxaWidths.reduce((s, w) => s + w, 0);
      if (allocatedTotal > totalDxa) {
        const scale = totalDxa / allocatedTotal;
        colDxaWidths = colDxaWidths.map((w) => Math.floor(w * scale));
      }
      const makeCells = (cells: InlineElement[][], isHeader: boolean, colIdx: number): TableCell[] =>
        cells.map(
          (inlineElems, c) =>
            new TableCell({
              width: { size: colDxaWidths[c] ?? colDxaWidths[colIdx] ?? 500, type: WidthType.DXA },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1, color: '808080' },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: '808080' },
                left: { style: BorderStyle.SINGLE, size: 1, color: '808080' },
                right: { style: BorderStyle.SINGLE, size: 1, color: '808080' },
              },
              children: [
                new Paragraph({
                  children: inlineElems.length > 0 ? inlineToRuns(inlineElems) : [new TextRun('')],
                  ...(isHeader ? { heading: HeadingLevel.HEADING_3 } : {}),
                }),
              ],
            }),
        );
      const headerRow = new TableRow({
        children: makeCells(block.headers, true, 0),
      });
      const dataRows = block.rows.map(
        (row) =>
          new TableRow({
            children: makeCells(row, false, 0),
          }),
      );
      return [
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [headerRow, ...dataRows],
        }),
      ];
    }
    case 'hr':
      return [
        new Paragraph({
          border: { bottom: { style: 'single', size: 1, color: '808080' } },
          children: [],
        }),
      ];
    case 'image': {
      if (assets) {
        const src = block.src.startsWith('./') ? block.src.slice(2) : block.src;
        const asset = assets.find((a) => a.name === src);
        if (asset && asset.dataUrl.startsWith('data:image/')) {
          const mimeMatch = asset.dataUrl.match(/^data:image\/(\w+);/);
          const ext = mimeMatch ? mimeMatch[1] : 'png';
          const type = ext === 'svg' ? 'png' : ext === 'jpeg' ? 'jpg' : ext;
          const base64 = asset.dataUrl.split(',')[1];
          const buffer = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
          return [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new ImageRun({
                  type: type as 'png' | 'jpg' | 'gif' | 'bmp',
                  data: buffer,
                  transformation: { width: 400, height: 300 },
                  altText: { title: block.alt, description: block.alt, name: block.alt },
                }),
              ],
            }),
          ];
        }
      }
      return [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: `[图片: ${block.alt}]`, italics: true, color: '999999' })],
        }),
      ];
    }
  }
}

/**
 * 将 Markdown 转换为 docx Document。
 * @internal 导出用于测试
 */
export function buildDocxDocument(markdown: string, title: string, assets?: Asset[]): Document {
  const blocks = parseMarkdown(markdown);
  const children = blocks.flatMap((b) => blockToParagraphs(b, assets));

  return new Document({
    title,
    styles: {
      default: {
        document: {
          run: { font: 'SimSun', size: 24 },
          paragraph: { spacing: { line: 360 } },
        },
        heading1: {
          run: { font: 'SimSun', size: 36, bold: true, color: '1A1A1A' },
          paragraph: { spacing: { before: 240, after: 120 } },
        },
        heading2: {
          run: { font: 'SimSun', size: 30, bold: true, color: '2D2D2D' },
          paragraph: { spacing: { before: 200, after: 100 } },
        },
        heading3: {
          run: { font: 'SimSun', size: 26, bold: true, color: '3D3D3D' },
          paragraph: { spacing: { before: 160, after: 80 } },
        },
      },
    },
    numbering: {
      config: [
        {
          reference: 'unordered-list',
          levels: [
            {
              level: 0,
              format: 'bullet',
              text: '•',
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
          ],
        },
        {
          reference: 'ordered-list',
          levels: [
            {
              level: 0,
              format: 'decimal',
              text: '%1.',
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        children,
      },
    ],
  });
}

/**
 * 导出 markdown 为 .docx 文件。
 * @returns Promise<void> —— 下载完成（或失败抛错由调用方捕获）。
 */
export async function exportDocx(opts: ExportDocxOptions): Promise<void> {
  const { markdown, title = 'MD-Bundle 文档', assets = [], filename = DEFAULT_DOCX_FILENAME } = opts;
  const download = opts.download ?? downloadBlob;

  const doc = buildDocxDocument(markdown, title, assets);
  const blob = await Packer.toBlob(doc);
  download(blob, filename);
}
