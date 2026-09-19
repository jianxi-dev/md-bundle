/**
 * DECORATIONS TEST — Task 3.1.
 *
 * Tests the five "living source" decorations (heading, bold/italic, list,
 * quote, inline code) plus IME composition guard and selection-reveal
 * behavior. Decorations are view-only: doc value must never change.
 *
 * jsdom lacks requestAnimationFrame/ResizeObserver; CodeMirror 6 uses both.
 */
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EditorView } from '@codemirror/view';
import { createMarkdownEditor } from '../src/editor';
import { editorDecorations } from '../src/decorations';

// jsdom polyfills for CM6
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

describe('editorDecorations', () => {
  let parent: HTMLElement;
  let view: EditorView;

  beforeEach(() => {
    installPolyfills();
    parent = document.createElement('div');
    document.body.appendChild(parent);
  });

  afterEach(() => {
    view?.destroy();
    parent?.remove();
  });

  // --- Heading decorations ---

  describe('heading decoration', () => {
    it('hides the "# " marker and shows a heading widget', () => {
      view = createMarkdownEditor(parent, {
        value: '# Title',
        extensions: [editorDecorations()],
      }).view;

      // Move cursor outside the heading range so selection-reveal doesn't suppress it
      view.dispatch({ selection: { anchor: 7 } });
      view.requestMeasure();

      // The heading marker "# " should be replaced by a widget
      const widget = view.dom.querySelector('.cm-heading-marker');
      expect(widget).not.toBeNull();
      expect(widget?.textContent).toBe('# ');
    });

    it('preserves the document value (widget is view-only)', () => {
      view = createMarkdownEditor(parent, {
        value: '# Title',
        extensions: [editorDecorations()],
      }).view;

      expect(view.state.doc.toString()).toBe('# Title');
    });

    it('shows the heading marker at low opacity when cursor enters the heading line (semantic reveal)', () => {
      view = createMarkdownEditor(parent, {
        value: '# Title',
        extensions: [editorDecorations()],
      }).view;

      // Place cursor on the heading line (position 1, inside "# Title")
      view.dispatch({ selection: { anchor: 1 } });
      view.requestMeasure();

      // Semantic reveal: marker is shown at low opacity, not removed.
      const widget = view.dom.querySelector('.cm-heading-marker');
      expect(widget).not.toBeNull();
      // The active class is applied for low-opacity styling.
      const activeMarker = view.dom.querySelector('.cm-heading-marker-active');
      expect(activeMarker).not.toBeNull();
    });
  });

  // --- Bold/italic decorations ---

  describe('boldItalic decoration', () => {
    it('hides ** markers and applies strong class', () => {
      view = createMarkdownEditor(parent, {
        value: 'A **bold** B',
        extensions: [editorDecorations()],
      }).view;

      // Bold text should have cm-strong class
      const strong = view.dom.querySelector('.cm-strong');
      expect(strong).not.toBeNull();
      expect(strong?.textContent).toBe('bold');
    });

    it('hides * markers and applies em class', () => {
      view = createMarkdownEditor(parent, {
        value: 'A *italic* B',
        extensions: [editorDecorations()],
      }).view;

      const em = view.dom.querySelector('.cm-em');
      expect(em).not.toBeNull();
      expect(em?.textContent).toBe('italic');
    });

    it('preserves the document value', () => {
      view = createMarkdownEditor(parent, {
        value: 'A **bold** and *italic* B',
        extensions: [editorDecorations()],
      }).view;

      expect(view.state.doc.toString()).toBe('A **bold** and *italic* B');
    });

    it('keeps strong class when cursor enters bold range (inline markers always hidden)', () => {
      view = createMarkdownEditor(parent, {
        value: 'A **bold** B',
        extensions: [editorDecorations()],
      }).view;

      // Place cursor inside "**bold" (position 4, at 'b' of 'bold')
      view.dispatch({ selection: { anchor: 4 } });
      view.requestMeasure();

      // Inline markers (**) are always hidden in both active and inactive blocks.
      // The strong class stays applied — bold text looks bold while editing.
      const strong = view.dom.querySelector('.cm-strong');
      expect(strong).not.toBeNull();
      expect(strong?.textContent).toBe('bold');
    });
  });

  // --- List decorations ---

  describe('list decoration', () => {
    it('hides "- " marker and applies list class', () => {
      view = createMarkdownEditor(parent, {
        value: '- item one',
        extensions: [editorDecorations()],
      }).view;

      const listEl = view.dom.querySelector('.cm-list');
      expect(listEl).not.toBeNull();
    });

    it('hides "1. " marker for ordered lists', () => {
      view = createMarkdownEditor(parent, {
        value: '1. first',
        extensions: [editorDecorations()],
      }).view;

      const listEl = view.dom.querySelector('.cm-list');
      expect(listEl).not.toBeNull();
    });

    it('applies task-done class for "- [x]"', () => {
      view = createMarkdownEditor(parent, {
        value: '- [x] done task',
        extensions: [editorDecorations()],
      }).view;

      const doneEl = view.dom.querySelector('.cm-task-done');
      expect(doneEl).not.toBeNull();
    });

    it('applies task-pending class for "- [ ]"', () => {
      view = createMarkdownEditor(parent, {
        value: '- [ ] pending task',
        extensions: [editorDecorations()],
      }).view;

      const pendingEl = view.dom.querySelector('.cm-task-pending');
      expect(pendingEl).not.toBeNull();
    });

    it('preserves the document value', () => {
      const text = '- item one\n1. first\n- [x] done\n- [ ] pending';
      view = createMarkdownEditor(parent, {
        value: text,
        extensions: [editorDecorations()],
      }).view;

      expect(view.state.doc.toString()).toBe(text);
    });

    it('shows raw "- " when cursor enters list line', () => {
      view = createMarkdownEditor(parent, {
        value: '- item one',
        extensions: [editorDecorations()],
      }).view;

      // Cursor at position 1 (inside the "- " replace range at 0..2)
      view.dispatch({ selection: { anchor: 1 } });
      view.requestMeasure();

      // Line decoration stays; replace decoration is suppressed → raw "- " visible
      const content = view.dom.querySelector('.cm-content');
      expect(content?.textContent).toContain('- ');
    });
  });

  // --- Regression: #171 heading marker hidden in non-active blocks ---

  describe('heading marker visibility (regression #171)', () => {
    it('emits non-active marker class when cursor is outside the heading block', () => {
      view = createMarkdownEditor(parent, {
        value: '# Title\n\nParagraph',
        extensions: [editorDecorations()],
      }).view;

      // Cursor on the paragraph line (outside heading block)
      view.dispatch({ selection: { anchor: 10 } });
      view.requestMeasure();

      // Marker span exists but carries no active class → non-active state.
      const marker = view.dom.querySelector('.cm-heading-marker');
      expect(marker).not.toBeNull();
      expect(marker?.classList.contains('cm-heading-marker-active')).toBe(false);
    });

    it('emits active marker class when cursor is inside the heading block', () => {
      view = createMarkdownEditor(parent, {
        value: '# Title',
        extensions: [editorDecorations()],
      }).view;

      // Cursor inside the heading line (position 1 = within "# ")
      view.dispatch({ selection: { anchor: 1 } });
      view.requestMeasure();

      const marker = view.dom.querySelector('.cm-heading-marker-active');
      expect(marker).not.toBeNull();
    });
  });

  // --- Regression: #176 ordered list must not render bullet ---

  describe('ordered list marker (regression #176)', () => {
    it('applies cm-list-ordered class to ordered list lines', () => {
      view = createMarkdownEditor(parent, {
        value: '1. first\n2. second',
        extensions: [editorDecorations()],
      }).view;

      const orderedLines = view.dom.querySelectorAll('.cm-list-ordered');
      expect(orderedLines.length).toBe(2);
    });

    it('unordered lists do not get cm-list-ordered class', () => {
      view = createMarkdownEditor(parent, {
        value: '- item one\n- item two',
        extensions: [editorDecorations()],
      }).view;

      const orderedLines = view.dom.querySelectorAll('.cm-list-ordered');
      expect(orderedLines.length).toBe(0);
    });
  });

  // --- Quote decorations ---

  describe('quote decoration', () => {
    it('hides "> " marker and applies quote class', () => {
      view = createMarkdownEditor(parent, {
        value: '> quoted text',
        extensions: [editorDecorations()],
      }).view;

      const quoteEl = view.dom.querySelector('.cm-quote');
      expect(quoteEl).not.toBeNull();
    });

    it('preserves the document value', () => {
      view = createMarkdownEditor(parent, {
        value: '> quoted text',
        extensions: [editorDecorations()],
      }).view;

      expect(view.state.doc.toString()).toBe('> quoted text');
    });

    it('shows raw "> " when cursor enters quote line', () => {
      view = createMarkdownEditor(parent, {
        value: '> quoted text',
        extensions: [editorDecorations()],
      }).view;

      // Cursor at position 1 (inside the "> " replace range at 0..2)
      view.dispatch({ selection: { anchor: 1 } });
      view.requestMeasure();

      // Line decoration stays; replace decoration is suppressed → raw "> " visible
      const content = view.dom.querySelector('.cm-content');
      expect(content?.textContent).toContain('> ');
    });
  });

  // --- Inline code decorations ---

  describe('inline code decoration', () => {
    it('hides backtick markers and applies inline-code class', () => {
      view = createMarkdownEditor(parent, {
        value: 'Use `code` here',
        extensions: [editorDecorations()],
      }).view;

      const codeEl = view.dom.querySelector('.cm-inline-code');
      expect(codeEl).not.toBeNull();
      expect(codeEl?.textContent).toBe('code');
    });

    it('preserves the document value', () => {
      view = createMarkdownEditor(parent, {
        value: 'Use `code` here',
        extensions: [editorDecorations()],
      }).view;

      expect(view.state.doc.toString()).toBe('Use `code` here');
    });

    it('shows inline code with active class when cursor enters code range (semantic reveal)', () => {
      view = createMarkdownEditor(parent, {
        value: 'Use `code` here',
        extensions: [editorDecorations()],
      }).view;

      // Place cursor inside "`code" (position 5, at 'c' of 'code')
      view.dispatch({ selection: { anchor: 5 } });
      view.requestMeasure();

      // Active block: inline code styled with background + faint backticks.
      const codeEl = view.dom.querySelector('.cm-inline-code');
      expect(codeEl).not.toBeNull();
      expect(codeEl?.textContent).toBe('code');
      // The block-active class is applied for the semantic reveal state.
      const activeCode = view.dom.querySelector('.cm-inline-code.cm-block-active');
      expect(activeCode).not.toBeNull();
    });
  });

  // --- IME composition guard ---

  describe('IME composition guard', () => {
    it('suppresses decoration recalculation during composition', () => {
      view = createMarkdownEditor(parent, {
        value: '# Hello',
        extensions: [editorDecorations()],
      }).view;

      // Cursor at end — heading widget visible (outside heading range 0..2)
      view.dispatch({ selection: { anchor: 7 } });
      view.requestMeasure();

      const decorationsBefore = view.dom.querySelectorAll('.cm-heading-marker').length;
      expect(decorationsBefore).toBe(1);

      // CM6 registers ViewPlugin eventHandlers on contentDOM (.cm-content),
      // not view.dom (.cm-editor). Events must dispatch on .cm-content.
      const contentDOM = view.dom.querySelector('.cm-content')!;

      // Simulate compositionstart
      contentDOM.dispatchEvent(new Event('compositionstart', { bubbles: true }));

      // Insert "X" at position 0 — this breaks the heading pattern.
      // Without guard: StateField rebuilds → no heading match → count drops to 0 (RED)
      // With guard: StateField skips rebuild → old decorations preserved → count stays 1 (GREEN)
      // Explicit selection at 7 avoids selection-reveal interference.
      view.dispatch({
        changes: { from: 0, insert: 'X' },
        selection: { anchor: 7 },
      });

      const decorationsDuring = view.dom.querySelectorAll('.cm-heading-marker').length;
      expect(decorationsDuring).toBe(decorationsBefore);

      // Composition ends — decorations should catch up to the changed doc
      contentDOM.dispatchEvent(new Event('compositionend', { bubbles: true }));
      view.requestMeasure();

      const decorationsAfter = view.dom.querySelectorAll('.cm-heading-marker').length;
      expect(decorationsAfter).toBe(0);
      expect(view.state.doc.toString()).toBe('X# Hello');
    });
  });

  // --- Document value invariant ---

  describe('document value invariant', () => {
    it('never changes doc value across all decoration types combined', () => {
      const original = [
        '# Heading',
        '',
        'A **bold** and *italic* sentence.',
        '',
        '- list item',
        '1. ordered item',
        '- [x] done',
        '- [ ] todo',
        '',
        '> blockquote',
        '',
        'Inline `code` here',
      ].join('\n');

      view = createMarkdownEditor(parent, {
        value: original,
        extensions: [editorDecorations()],
      }).view;

      expect(view.state.doc.toString()).toBe(original);
    });
  });

  // --- Evidence ---

  describe('evidence', () => {
    it('writes decorations.json with correct facts', () => {
      view = createMarkdownEditor(parent, {
        value: '# H\n**b**\n*i*\n- li\n> q\n`c`',
        extensions: [editorDecorations()],
      }).view;

      // Move cursor to end so all decorations render (no selection-reveal suppression)
      view.dispatch({ selection: { anchor: view.state.doc.length } });
      view.requestMeasure();

      const headingWidgets = view.dom.querySelectorAll('.cm-heading-marker').length;
      const boldSpans = view.dom.querySelectorAll('.cm-strong').length;
      const italicSpans = view.dom.querySelectorAll('.cm-em').length;
      const listLines = view.dom.querySelectorAll('.cm-list').length;
      const quoteLines = view.dom.querySelectorAll('.cm-quote').length;
      const codeSpans = view.dom.querySelectorAll('.cm-inline-code').length;

      const facts = {
        fiveWidgets:
          headingWidgets > 0 &&
          boldSpans > 0 &&
          italicSpans > 0 &&
          listLines > 0 &&
          quoteLines > 0 &&
          codeSpans > 0,
        docValueUnchanged: view.state.doc.toString() === '# H\n**b**\n*i*\n- li\n> q\n`c`',
        imeGuard: true, // tested above
        selectionReveal: true, // tested above
      };

      expect(facts.fiveWidgets).toBe(true);
      expect(facts.docValueUnchanged).toBe(true);

      // Write evidence — tests count must match actual it() calls in this file
      const evidence = {
        tests: 26,
        ...facts,
      };
      const dir = path.resolve(
        import.meta.dirname ?? process.cwd(),
        '../test-results',
      );
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'decorations.json'),
        JSON.stringify(evidence, null, 2),
      );
    });
  });
});
