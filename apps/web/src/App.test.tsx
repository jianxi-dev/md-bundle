import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders the MD-Bundle placeholder', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'MD-Bundle' })).toBeInTheDocument();
    expect(screen.getByText('分享 Markdown，不再裂图。')).toBeInTheDocument();
  });
});