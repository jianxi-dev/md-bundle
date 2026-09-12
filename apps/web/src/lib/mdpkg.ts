// mdpkg 网页打开器 —— 类型化封装层。
// 底层为 vendored ESM bundle（apps/web/vendor/mdpkg-web.js，来自 jianxi-dev/mdpkg）。
// 职责：
//   1. 把 openMdpkg 的「非 ZIP / 0 条目直接 throw MdeError」行为收敛为确定性结果对象，
//      调用方永远拿到 OpenPackageResult，不会出现未捕获异常 / 白屏。
//   2. 透出类型（Manifest / ValidationResult / OpenResult），供 UI 层（任务 2.2）直接消费。
//   3. 将底层技术性错误码（MDPKG-E101 等）翻译为用户友好的中文提示。
// 注意：校验错误（validation.errors）与渲染错误（error 字段）是两条不同路径，见 OpenResult 注释。
import { openMdpkg } from '../../vendor/mdpkg-web.js';
import type { Manifest, OpenOptions, OpenResult, ValidationResult } from '../../vendor/mdpkg-web.js';

export type { Manifest, OpenOptions, OpenResult, ValidationResult };

/** openPackage 的返回：成功为完整 OpenResult；打开失败（非 ZIP / 损坏 / 0 条目）为 { error } */
export type OpenPackageResult = OpenResult | { error: string };

/** 将底层技术性错误码（MDPKG-E101/103/303 等）翻译为用户友好提示。 */
function translateVendorError(msg: string): string {
  const map: [RegExp, string][] = [
    [/MDPKG-E103/i, '文件格式不正确，无法打开此文件'],
    [/MDPKG-E101/i, '不是有效的 .mdpkg 文件'],
    [/MDPKG-E303/i, '该文件包内没有可显示的文档内容'],
    [/MDPKG-E401/i, '文档引用了未导入的本地资源，请先导入图片或移除引用后重试'],
  ];
  for (const [pattern, friendly] of map) {
    if (pattern.test(msg)) return friendly;
  }
  // 回退：剥离技术性错误码前缀，返回清理后的消息
  const cleaned = msg.replace(/^\[?MDPKG-E\d+\]?\s*/i, '').trim();
  return cleaned || '文件处理失败，请检查文件是否完整';
}

/** 打开 .mdpkg：解包 → 校验 → 渲染。任何硬错误都被捕获并转为 { error }，绝不抛出。 */
export async function openPackage(bytes: Uint8Array, opts?: OpenOptions): Promise<OpenPackageResult> {
  try {
    const result = await openMdpkg(bytes, opts);
    // 渲染阶段失败（html 为 null）时，翻译 error 字段中的技术性错误码
    if (result.html === null && result.error) {
      return { ...result, error: translateVendorError(result.error) };
    }
    return result;
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return { error: translateVendorError(detail) };
  }
}

// 透出：读取入口 Markdown 原文（include 未展开），预览源码用；入口缺失时抛 MdeError。
export { readEntrySource, MdeError } from '../../vendor/mdpkg-web.js';
