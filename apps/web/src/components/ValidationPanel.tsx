import type { ValidationResult } from '../lib/mdpkg';

interface ValidationPanelProps {
  validation: ValidationResult | null;
  /** 文档名（入口文件名），提供时显示在面板头部 */
  name?: string;
}

/**
 * 校验报告面板 —— 纯视图组件，不做任何数据获取。
 * 状态机：null → 未校验；ok → 通过；!ok → 校验未通过 + 错误列表。
 * 警告与外部链接引用为附加区块。
 */
export function ValidationPanel({ validation, name }: ValidationPanelProps) {
  if (validation === null) {
    return (
      <section
        data-testid="validation-neutral"
        className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-500"
      >
        {name ? <h2 className="mb-1 font-medium text-neutral-700">{name}</h2> : null}
        未校验
      </section>
    );
  }

  const { ok, errors, warnings, externalCount } = validation;

  return (
    <section
      data-testid={ok ? 'validation-pass' : 'validation-fail'}
      className={
        ok
          ? 'rounded-lg border border-[rgb(22,93,255,0.35)] bg-[rgb(22,93,255,0.08)] p-3 text-sm text-[rgb(22,93,255)]'
          : 'rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-600'
      }
    >
      {name ? <h2 className="mb-1 font-medium">{name}</h2> : null}
      <p className="font-medium">
        {ok ? '✅ 通过' : '校验未通过'}
        {ok && warnings.length > 0 ? `（${warnings.length} 条警告）` : ''}
      </p>
      {!ok && errors.length > 0 ? (
        <ul data-testid="validation-errors" className="mt-2 list-disc space-y-1 pl-5">
          {errors.map((error, i) => (
            <li key={i}>{error}</li>
          ))}
        </ul>
      ) : null}
      {warnings.length > 0 ? (
        <ul data-testid="validation-warnings" className="mt-2 list-disc space-y-1 pl-5 text-amber-600">
          {warnings.map((warning, i) => (
            <li key={i}>{warning}</li>
          ))}
        </ul>
      ) : null}
      {externalCount > 0 ? (
        <p data-testid="validation-external" className="mt-2">
          包含 {externalCount} 条外部链接引用
        </p>
      ) : null}
    </section>
  );
}