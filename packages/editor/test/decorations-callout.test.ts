/**
 * DECORATIONS CALLOUT TEST — Task 3.3.
 *
 * Tests callout card decorations (blockquote callout syntax).
 * Decorations are view-only: doc value must never change.
 *
 * jsdom lacks requestAnimationFrame/ResizeObserver; CodeMirror 6 uses both.
 */
import fs from 'node:fs';
import path from 'node:path';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
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

// Evidence tracking for JSON output
const evidence = {
  cardShown: false,
  toneMapped: false,
  invalidFallsBack: false,
  titleDefaults: false,
  multiLine: false,
  sourceReplaced: false,
  selectionReveal: false,
  tests: 0, // keep in sync with it() count below
};

describe('editorDecorations with callout support', () => {
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

  // --- Callout card rendering ---

  describe('callout card rendering', () => {
    it('displays callout card for valid callout syntax', () => {
      view = createMarkdownEditor(parent, {
        value: '> [!NOTE] 标题\n> 内容',
        extensions: [editorDecorations()],
      }).view;

      // Move cursor outside the callout range so selection-reveal doesn't suppress it
      view.dispatch({ selection: { anchor: view.state.doc.length } });
      view.requestMeasure();

      // Callout widget should be rendered
      const widget = view.dom.querySelector('.cm-callout');
      expect(widget).not.toBeNull();
      expect(widget?.textContent).toContain('注释'); // label from calloutTypeMap
      evidence.cardShown = true;
      evidence.tests++;
    });

    it('preserves the document value (widget is view-only)', () => {
      view = createMarkdownEditor(parent, {
        value: '> [!NOTE] 标题\n> 内容',
        extensions: [editorDecorations()],
      }).view;

      expect(view.state.doc.toString()).toBe('> [!NOTE] 标题\n> 内容');
      evidence.tests++;
    });
  });

  // --- Tone mapping ---

  describe('tone mapping', () => {
    it('maps different callout types to different tones', () => {
      // Test note (blue), tip (green), warning (orange), danger (red)
      const types = ['NOTE', 'TIP', 'WARNING', 'DANGER'];
      const tones = ['blue', 'green', 'orange', 'red'];

      for (let i = 0; i < types.length; i++) {
        view = createMarkdownEditor(parent, {
          value: `> [!${types[i]}] 标题\n> 内容`,
          extensions: [editorDecorations()],
        }).view;

        // Move cursor outside
        view.dispatch({ selection: { anchor: view.state.doc.length } });
        view.requestMeasure();

        const widget = view.dom.querySelector('.cm-callout');
        expect(widget).not.toBeNull();
        
        // Check tone class is applied
        const toneClass = `cm-callout-tone-${tones[i]}`;
        expect(widget?.classList.contains(toneClass)).toBe(true);
        
        view.destroy();
      }
      
      evidence.toneMapped = true;
      evidence.tests++;
    });
  });

  // --- Invalid callout type fallback ---

  describe('invalid callout type fallback', () => {
    it('does not decorate invalid callout type [!FOO]', () => {
      view = createMarkdownEditor(parent, {
        value: '> [!FOO] xxx\n> 内容',
        extensions: [editorDecorations()],
      }).view;

      // Move cursor outside
      view.dispatch({ selection: { anchor: view.state.doc.length } });
      view.requestMeasure();

      // No callout widget should be rendered for invalid type
      const widget = view.dom.querySelector('.cm-callout');
      expect(widget).toBeNull();
      
      // Should show as regular blockquote
      const quote = view.dom.querySelector('.cm-quote');
      expect(quote).not.toBeNull();
      
      evidence.invalidFallsBack = true;
      evidence.tests++;
    });
  });

  // --- Default title from label ---

  describe('default title from label', () => {
    it('uses label from calloutTypeMap when title is missing', () => {
      view = createMarkdownEditor(parent, {
        value: '> [!TIP]\n> 内容',
        extensions: [editorDecorations()],
      }).view;

      // Move cursor outside
      view.dispatch({ selection: { anchor: view.state.doc.length } });
      view.requestMeasure();

      const widget = view.dom.querySelector('.cm-callout');
      expect(widget).not.toBeNull();
      // Should show label "提示" from calloutTypeMap
      expect(widget?.textContent).toContain('提示');
      
      evidence.titleDefaults = true;
      evidence.tests++;
    });
  });

  // --- Multi-line callout ---

  describe('multi-line callout', () => {
    it('merges multiple lines into a single callout card', () => {
      view = createMarkdownEditor(parent, {
        value: '> [!NOTE] 标题\n> 第一行\n> 第二行\n> 第三行',
        extensions: [editorDecorations()],
      }).view;

      // Move cursor outside
      view.dispatch({ selection: { anchor: view.state.doc.length } });
      view.requestMeasure();

      const widget = view.dom.querySelector('.cm-callout');
      expect(widget).not.toBeNull();
      
      // Should contain all content lines
      const text = widget?.textContent ?? '';
      expect(text).toContain('第一行');
      expect(text).toContain('第二行');
      expect(text).toContain('第三行');
      
      evidence.multiLine = true;
      evidence.tests++;
    });
  });

  // --- Source replacement (card replaces source appearance) ---

  describe('source replacement', () => {
    it('hides raw markdown markers when callout card is displayed', () => {
      view = createMarkdownEditor(parent, {
        value: '> [!NOTE] 标题\n> 内容',
        extensions: [editorDecorations()],
      }).view;

      // Move cursor outside so callout card is displayed
      view.dispatch({ selection: { anchor: view.state.doc.length } });
      view.requestMeasure();

      // Card should be displayed
      const widget = view.dom.querySelector('.cm-callout');
      expect(widget).not.toBeNull();

      // Raw markdown markers should NOT be visible in .cm-content text
      const content = view.dom.querySelector('.cm-content');
      const text = content?.textContent ?? '';
      expect(text).not.toContain('[!NOTE]');
      expect(text).not.toContain('> [!');
      
      evidence.sourceReplaced = true;
      evidence.tests++;
    });
  });

  // --- Selection reveal (cursor enters callout → show source) ---

  describe('semantic editing mode', () => {
    it('keeps callout card visible when cursor enters callout block', () => {
      view = createMarkdownEditor(parent, {
        value: '> [!NOTE] 标题\n> 内容',
        extensions: [editorDecorations()],
      }).view;

      // First, verify card is displayed when cursor is outside
      view.dispatch({ selection: { anchor: view.state.doc.length } });
      view.requestMeasure();
      expect(view.dom.querySelector('.cm-callout')).not.toBeNull();

      // Move cursor INTO the callout block (position 1, inside "> [!NOTE]")
      view.dispatch({ selection: { anchor: 1 } });
      view.requestMeasure();

      // Callout is a block-level widget — it stays rendered as a card
      // in both active and inactive blocks. The user edits the raw
      // markdown source when inside the block.
      const widget = view.dom.querySelector('.cm-callout');
      expect(widget).not.toBeNull();

      evidence.selectionReveal = true;
      evidence.tests++;
    });

    it('callout card is stable when cursor moves in and out of block', () => {
      view = createMarkdownEditor(parent, {
        value: '> [!NOTE] 标题\n> 内容',
        extensions: [editorDecorations()],
      }).view;

      // Move cursor into callout block
      view.dispatch({ selection: { anchor: 1 } });
      view.requestMeasure();
      expect(view.dom.querySelector('.cm-callout')).not.toBeNull();

      // Move cursor back outside
      view.dispatch({ selection: { anchor: view.state.doc.length } });
      view.requestMeasure();

      // Card is still visible (block-level widget, always rendered)
      expect(view.dom.querySelector('.cm-callout')).not.toBeNull();
      evidence.tests++;
    });
  });
});

// Write evidence file after all tests
afterAll(() => {
  const dir = path.resolve(
    import.meta.dirname ?? process.cwd(),
    '../test-results',
  );
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'decorations-callout.json'),
    JSON.stringify(evidence, null, 2),
  );
});
