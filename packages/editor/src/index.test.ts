import { describe, expect, it } from 'vitest';
import { editorName, placeholder } from './index';

describe('@md-bundle/editor stub', () => {
  it('exposes the package name', () => {
    expect(editorName).toBe('@md-bundle/editor');
  });

  it('placeholder returns the stub marker', () => {
    expect(placeholder()).toBe('MD-Bundle editor stub');
  });
});