/**
 * structureLinterExtension — default-off inline diagnostics + 结构体检 toggle.
 *
 * Issue #206 regression guard: the linter used to draw dotted underlines on
 * ordinary prose and headings as soon as the extension was mounted, and users
 * read them as spelling/grammar errors. The structural findings already have a
 * dedicated surface (left-rail 🩺 panel, which calls `lintStructure` directly),
 * so inline marks must stay absent until the user opts in via the
 * "结构体检" command (id: structure-check).
 *
 * jsdom lacks requestAnimationFrame/ResizeObserver; CodeMirror 6 uses both.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import {
  isStructureLinterEnabled,
  setStructureLinterEnabled,
  structureLinterExtension,
  toggleStructureLinter,
} from '../src/structure-linter-extension';
import { commandRegistry } from '../src/commands';

// jsdom polyfills for CM6.
function installPolyfills(): void {
  if (typeof globalThis.requestAnimationFrame !== 'function') {
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 16)) as unknown as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = ((id: number) =>
      clearTimeout(id)) as unknown as typeof cancelAnimationFrame;
  }
  if (typeof globalThis.ResizeObserver !== 'function') {
    globalThis.ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver;
  }
}

// The trailing paragraph contains a conclusion word (因此) with no list /
// quote / table after it, so rule "missing-evidence" fires exactly once.
const DOC = '# 标题\n\n因此这是结论。';

function makeView(parent: HTMLElement, doc = DOC): EditorView {
  return new EditorView({
    state: EditorState.create({
      doc,
      extensions: [markdown(), structureLinterExtension()],
    }),
    parent,
  });
}

/** All inline lint marks currently rendered by the view. */
function lintMarks(view: EditorView): HTMLElement[] {
  return Array.from(view.dom.querySelectorAll<HTMLElement>('.cm-lint-mark'));
}

describe('structureLinterExtension default state (issue #206)', () => {
  let parent: HTMLElement;
  let view: EditorView;

  beforeEach(() => {
    installPolyfills();
    parent = document.createElement('div');
    document.body.appendChild(parent);
    view = makeView(parent);
  });

  afterEach(() => {
    view.destroy();
    parent.remove();
  });

  it('renders zero .cm-lint-mark elements with the default configuration', () => {
    expect(isStructureLinterEnabled(view.state)).toBe(false);
    expect(lintMarks(view)).toHaveLength(0);
  });
});

describe('structureLinterExtension opt-in toggle (issue #206)', () => {
  let parent: HTMLElement;
  let view: EditorView;

  beforeEach(() => {
    installPolyfills();
    parent = document.createElement('div');
    document.body.appendChild(parent);
    view = makeView(parent);
  });

  afterEach(() => {
    view.destroy();
    parent.remove();
  });

  it('renders diagnostics carrying their data-rule after toggling on', () => {
    expect(toggleStructureLinter(view)).toBe(true);
    expect(isStructureLinterEnabled(view.state)).toBe(true);

    const marks = lintMarks(view);
    expect(marks).toHaveLength(1);
    expect(marks[0].getAttribute('data-rule')).toBe('missing-evidence');
    expect(marks[0].classList.contains('cm-lint-warning')).toBe(true);
  });

  it('removes every decoration after toggling off again', () => {
    setStructureLinterEnabled(view, true);
    expect(lintMarks(view).length).toBeGreaterThan(0);

    setStructureLinterEnabled(view, false);
    expect(isStructureLinterEnabled(view.state)).toBe(false);
    expect(lintMarks(view)).toHaveLength(0);
  });

  it('re-lints document edits while enabled and keeps marks after toggling back on', () => {
    toggleStructureLinter(view);
    // Erase the conclusion word: the rule no longer fires, so the mark clears.
    view.dispatch({ changes: { from: DOC.indexOf('因此'), to: DOC.indexOf('因此') + 2, insert: '这是' } });
    expect(isStructureLinterEnabled(view.state)).toBe(true);
    expect(lintMarks(view)).toHaveLength(0);

    // Toggling off then on re-enables against the current (clean) document.
    toggleStructureLinter(view);
    toggleStructureLinter(view);
    expect(lintMarks(view)).toHaveLength(0);
  });

  it('keeps the toggle per-view: a sibling editor stays clean', () => {
    const siblingParent = document.createElement('div');
    document.body.appendChild(siblingParent);
    const sibling = makeView(siblingParent, DOC);

    try {
      toggleStructureLinter(view);
      expect(lintMarks(view)).toHaveLength(1);
      expect(lintMarks(sibling)).toHaveLength(0);
    } finally {
      sibling.destroy();
      siblingParent.remove();
    }
  });

  it('the structure-check command flips the linter state on and off', () => {
    const cmd = commandRegistry.all().find((c) => c.id === 'structure-check');
    expect(cmd).toBeDefined();

    commandRegistry.execute('structure-check', view);
    expect(isStructureLinterEnabled(view.state)).toBe(true);
    expect(lintMarks(view)).toHaveLength(1);

    commandRegistry.execute('structure-check', view);
    expect(isStructureLinterEnabled(view.state)).toBe(false);
    expect(lintMarks(view)).toHaveLength(0);
  });
});
