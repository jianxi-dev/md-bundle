// 文件打开 —— 类型检测 + 分发。把「选择/拖拽进来的 File」转成统一的 OpenOutcome。
// 职责：
//   1. 按扩展名检测类型（.md / .mdpkg / 其它 → null），并对 .mdpkg 做 ZIP 魔数兜底
//      （PK\x03\x04 —— 即使扩展名写错，只要内容是 ZIP 就按 .mdpkg 打开）。
//   2. .md → 读文本；.mdpkg → 交给 openPackage（mdpkg.ts 封装层，绝不抛出）。
//   3. 任何异常都收敛为 { kind: 'error', message }，调用方永远拿到确定性结果，无白屏。
import { openPackage, type OpenPackageResult } from './mdpkg';

export type OpenOutcome =
  | { kind: 'md'; name: string; content: string }
  | { kind: 'mdpkg'; name: string; result: OpenPackageResult }
  | { kind: 'error'; message: string };

/** ZIP 本地文件头魔数 PK\x03\x04 */
const ZIP_MAGIC = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);

/** 按扩展名检测：.md → md；.mdpkg → mdpkg；其它 → null（大小写不敏感）。 */
export function detectFileType(file: File): 'md' | 'mdpkg' | null {
  const name = file.name.toLowerCase();
  if (name.endsWith('.md')) return 'md';
  if (name.endsWith('.mdpkg')) return 'mdpkg';
  return null;
}

/** 前 4 字节是否为 ZIP 魔数 PK\x03\x04（防御：扩展名写错的 .mdpkg 也能识别）。 */
export function hasZipMagic(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  return (
    bytes[0] === ZIP_MAGIC[0] &&
    bytes[1] === ZIP_MAGIC[1] &&
    bytes[2] === ZIP_MAGIC[2] &&
    bytes[3] === ZIP_MAGIC[3]
  );
}

/** 读取 File 的原始字节。 */
export async function readFileBytes(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

const decoder = new TextDecoder('utf-8', { fatal: false });

/**
 * 打开一个文件 → 确定性 OpenOutcome。
 * - 内容为 ZIP（含 PK 魔数）→ .mdpkg（即使扩展名不是 .mdpkg）
 * - 扩展名 .md 且非 ZIP → 文本内容
 * - 其它 → 错误结果
 * 任何 throw（含 openPackage 漏网的）都被 try/catch 收敛为错误结果。
 */
export async function openFile(file: File): Promise<OpenOutcome> {
  try {
    const bytes = await readFileBytes(file);

    // 魔数优先：只要内容是 ZIP 就当 .mdpkg 打开（防扩展名写错）。
    const type = hasZipMagic(bytes) ? 'mdpkg' : detectFileType(file);

    if (type === 'mdpkg') {
      const result = await openPackage(bytes);
      return { kind: 'mdpkg', name: file.name, result };
    }
    if (type === 'md') {
      const content = decoder.decode(bytes);
      return { kind: 'md', name: file.name, content };
    }
    return {
      kind: 'error',
      message: `不支持的文件类型：${file.name}（仅支持 .md / .mdpkg）。`,
    };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return { kind: 'error', message: `打开文件失败：${detail}` };
  }
}
