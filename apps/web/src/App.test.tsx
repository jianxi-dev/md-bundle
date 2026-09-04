import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders the shell: header + tagline + file dropzone (empty state)', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'MD-Bundle' })).toBeInTheDocument();
    expect(screen.getByText('分享 Markdown，不再裂图。')).toBeInTheDocument();
    expect(screen.getByTestId('dropzone')).toBeInTheDocument();
    expect(screen.getByTestId('file-input')).toHaveAttribute('accept', '.md,.mdpkg');
    expect(screen.getByText('选择或拖入文件', { exact: true })).toBeInTheDocument();
  });
});
