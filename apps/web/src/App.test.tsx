import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders the shell: landing nav + slogan + file dropzone (empty state)', () => {
    render(<App />);
    expect(screen.getByTestId('landing-nav')).toBeInTheDocument();
    expect(screen.getByText('MD-Bundle（本兜）')).toBeInTheDocument();
    const slogan = screen.getByTestId('hero-slogan');
    expect(slogan).toBeInTheDocument();
    expect(slogan.textContent).toMatch(/分享 Markdown/);
    expect(slogan.textContent).toMatch(/不再裂图/);
    expect(screen.getByTestId('dropzone')).toBeInTheDocument();
    expect(screen.getByTestId('file-input')).toHaveAttribute('accept', '.md,.mdpkg');
    expect(screen.getByText('选择或拖入文件', { exact: true })).toBeInTheDocument();
  });
});
