// 文档状态机：none（empty）| md | mdpkg | error。
// 打开动作是异步的，用自增序号保证「后开的文件胜出」——快速连开多个文件时，
// 只有最后一次 open 的结果会落地（前序慢结果被丢弃）。
import { useCallback, useRef, useState } from 'react';
import { openFile } from './openFile';
import type { Manifest, ValidationResult } from './mdpkg';

export type DocumentState =
  | { status: 'empty' }
  | { status: 'md'; name: string; content: string }
  | {
      status: 'mdpkg';
      name: string;
      html: string;
      validation: ValidationResult;
      files: Map<string, Uint8Array>;
      /** 包内 manifest（重打包时透传给 packMdpkg 继承 entrypoint/extensions/source_url）。 */
      manifest: Manifest | null;
    }
  | { status: 'error'; message: string };

export interface UseDocument {
  state: DocumentState;
  /** 打开文件：替换当前文档。异步；返回后状态才切换。 */
  open: (file: File) => Promise<void>;
  /** 清空，回到空态。 */
  clear: () => void;
}

export function useDocument(): UseDocument {
  const [state, setState] = useState<DocumentState>({ status: 'empty' });
  const seq = useRef(0);

  const open = useCallback(async (file: File) => {
    const id = ++seq.current;
    const outcome = await openFile(file);
    if (id !== seq.current) return; // 已被更新的 open 取代，丢弃过期结果

    switch (outcome.kind) {
      case 'md':
        setState({ status: 'md', name: outcome.name, content: outcome.content });
        break;
      case 'mdpkg': {
        const r = outcome.result;
        if ('files' in r && r.html !== null) {
          setState({
            status: 'mdpkg',
            name: outcome.name,
            html: r.html,
            validation: r.validation,
            files: r.files,
            manifest: r.manifest,
          });
        } else {
          // 打开成功但渲染失败（如截断包 E303）→ 同样是确定性错误态
          const err = 'files' in r ? (r.error ?? '未知渲染错误') : r.error;
          setState({ status: 'error', message: err });
        }
        break;
      }
      case 'error':
        setState({ status: 'error', message: outcome.message });
        break;
    }
  }, []);

  const clear = useCallback(() => {
    seq.current++; // 使在途 open 结果失效
    setState({ status: 'empty' });
  }, []);

  return { state, open, clear };
}
