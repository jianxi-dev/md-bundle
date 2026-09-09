// 大纲解析 —— 纯函数，code-fence aware。
// 编辑/源码模式从 markdown 文本解析；预览模式由 OutlineMenu 从 DOM 解析（h1–h6）。
// 提取 ATX 标题（# → ######），跳过 ``` 代码块内的 # 行。

export interface OutlineHeading {
  /** 标题级别 1–6。 */
  level: number;
  /** 标题文本（去掉前导 # 和尾部空格）。 */
  text: string;
  /** 0-based 行号（用于 CM6 scrollIntoView 定位）。 */
  line: number;
}

/**
 * 从 markdown 文本中提取标题列表（code-fence aware）。
 * - ATX 标题：行首 1–6 个 # + 空格 + 文本
 * - 跳过 ``` 代码块内的所有行（包括 ``` 本身）
 * - 返回按出现顺序排列的标题数组
 */
export function extractHeadings(markdown: string): OutlineHeading[] {
  const lines = markdown.split('\n');
  const headings: OutlineHeading[] = [];
  let inFence = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 代码围栏开关：``` 开始 / 结束代码块
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }

    // 代码块内跳过
    if (inFence) continue;

    // ATX 标题匹配：行首 1–6 个 # 后跟空格或行尾
    const m = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (m) {
      headings.push({
        level: m[1].length,
        text: m[2],
        line: i,
      });
    }
  }

  return headings;
}
