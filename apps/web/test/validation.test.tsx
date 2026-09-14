import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ValidationPanel } from '../src/components/ValidationPanel';
import type { ValidationResult } from '../src/lib/mdpkg';

// vitest 未开 globals:true → testing-library 不会自动 cleanup，必须显式调用
afterEach(cleanup);

describe('ValidationPanel', () => {
  it('renders nothing when validation passes', () => {
    const validation: ValidationResult = { ok: true, errors: [], warnings: [], externalCount: 0 };
    const { container } = render(<ValidationPanel validation={validation} />);
    // 正向锚点：组件完全不产出 DOM（弱于缺席断言的反向验证）
    expect(container.firstChild).toBeNull();
    // 回归锁：旧缺陷（#82）会渲染 validation-pass 面板，此处断言其不存在
    expect(screen.queryByTestId('validation-pass')).not.toBeInTheDocument();
    expect(screen.queryByTestId('validation-fail')).not.toBeInTheDocument();
    expect(screen.queryByText('✅ 通过')).not.toBeInTheDocument();
  });

  it('renders fail state with every error, warnings, and external notice', () => {
    const validation: ValidationResult = {
      ok: false,
      errors: ['[MDPKG-E302] / must NOT have additional properties', '[MDPKG-E303] entrypoint 不存在: document.md'],
      warnings: ['warn'],
      externalCount: 3,
    };
    render(<ValidationPanel validation={validation} />);
    expect(screen.getByTestId('validation-fail')).toBeInTheDocument();
    expect(screen.getByText('校验未通过')).toBeInTheDocument();
    const errors = screen.getByTestId('validation-errors');
    expect(errors.querySelectorAll('li')).toHaveLength(2);
    expect(screen.getByText('[MDPKG-E302] / must NOT have additional properties')).toBeInTheDocument();
    expect(screen.getByText('[MDPKG-E303] entrypoint 不存在: document.md')).toBeInTheDocument();
    expect(screen.getByTestId('validation-warnings')).toBeInTheDocument();
    expect(screen.getByText('warn')).toBeInTheDocument();
    expect(screen.getByTestId('validation-external')).toHaveTextContent('3');
    expect(screen.getByText('包含 3 条外部链接引用')).toBeInTheDocument();
  });

  it('renders neutral state when validation is null', () => {
    render(<ValidationPanel validation={null} />);
    expect(screen.getByTestId('validation-neutral')).toBeInTheDocument();
    expect(screen.getByText('未校验')).toBeInTheDocument();
  });

  it('does not show external notice when externalCount is 0', () => {
    const validation: ValidationResult = { ok: false, errors: ['err'], warnings: [], externalCount: 0 };
    render(<ValidationPanel validation={validation} />);
    expect(screen.queryByTestId('validation-external')).not.toBeInTheDocument();
  });

  it('shows the document name in the header when provided', () => {
    const validation: ValidationResult = { ok: false, errors: ['err'], warnings: [], externalCount: 0 };
    render(<ValidationPanel validation={validation} name="document.md" />);
    expect(screen.getByText('document.md')).toBeInTheDocument();
  });

  it('renders nothing when validation passes even with warnings', () => {
    const validation: ValidationResult = {
      ok: true,
      errors: [],
      warnings: ['[MDPKG-E404] 孤儿资源: images/orphan.png'],
      externalCount: 0,
    };
    const { container } = render(<ValidationPanel validation={validation} />);
    // 正向锚点：ok 态（含 warnings）也不产出任何 DOM
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('validation-pass')).not.toBeInTheDocument();
    expect(screen.queryByTestId('validation-fail')).not.toBeInTheDocument();
  });
});
