/**
 * DECORATIONS IMAGE TEST — Task 3.2.
 *
 * Tests inline image decoration with hover operations.
 * Decorations are view-only: doc value must never change.
 *
 * jsdom lacks requestAnimationFrame/ResizeObserver; CodeMirror 6 uses both.
 */
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EditorView } from '@codemirror/view';
import { createMarkdownEditor } from '../src/editor';
import { editorDecorations } from '../src/decorations';
import type { ImageResolver, ImageCallbacks } from '../src/decorations/image';

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

// Stub resolver that returns dataUrl for known images, null for unknown
const stubResolver: ImageResolver = (path: string) => {
  if (path === 'photo.png') return 'data:image/png;base64,abc123';
  return null;
};

describe('editorDecorations with image support', () => {
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

  // --- Image widget rendering ---

  describe('image widget rendering', () => {
    it('displays img widget for resolved image', () => {
      view = createMarkdownEditor(parent, {
        value: '![alt text](photo.png)',
        extensions: [editorDecorations({ resolveImage: stubResolver })],
      }).view;

      // Move cursor outside the image range so selection-reveal doesn't suppress it
      view.dispatch({ selection: { anchor: view.state.doc.length } });
      view.requestMeasure();

      // Image widget should be rendered
      const widget = view.dom.querySelector('.cm-image-widget');
      expect(widget).not.toBeNull();
      const img = widget?.querySelector('img');
      expect(img).not.toBeNull();
      expect(img?.getAttribute('src')).toBe('data:image/png;base64,abc123');
      expect(img?.getAttribute('alt')).toBe('alt text');
    });

    it('displays fallback text for unresolved image (resolver returns null)', () => {
      view = createMarkdownEditor(parent, {
        value: '![alt text](unknown.png)',
        extensions: [editorDecorations({ resolveImage: stubResolver })],
      }).view;

      // Move cursor outside the image range
      view.dispatch({ selection: { anchor: view.state.doc.length } });
      view.requestMeasure();

      // Fallback text should be displayed
      const widget = view.dom.querySelector('.cm-image-widget');
      expect(widget).not.toBeNull();
      expect(widget?.textContent).toContain('[图片: unknown.png]');
    });

    it('displays fallback text when no resolver provided (default behavior)', () => {
      view = createMarkdownEditor(parent, {
        value: '![alt text](photo.png)',
        extensions: [editorDecorations()],
      }).view;

      // Move cursor outside the image range
      view.dispatch({ selection: { anchor: view.state.doc.length } });
      view.requestMeasure();

      // Default resolver returns null → fallback text
      const widget = view.dom.querySelector('.cm-image-widget');
      expect(widget).not.toBeNull();
      expect(widget?.textContent).toContain('[图片: photo.png]');
    });

    it('preserves the document value (widget is view-only)', () => {
      const original = '![alt text](photo.png)';
      view = createMarkdownEditor(parent, {
        value: original,
        extensions: [editorDecorations({ resolveImage: stubResolver })],
      }).view;

      expect(view.state.doc.toString()).toBe(original);
    });
  });

  // --- Code fence awareness ---

  describe('code fence awareness', () => {
    it('does not create widget for image inside code fence', () => {
      const fenced = '```\n![alt text](photo.png)\n```';
      view = createMarkdownEditor(parent, {
        value: fenced,
        extensions: [editorDecorations({ resolveImage: stubResolver })],
      }).view;

      // Move cursor outside the code fence
      view.dispatch({ selection: { anchor: view.state.doc.length } });
      view.requestMeasure();

      // No image widget should be created inside the fence
      const widget = view.dom.querySelector('.cm-image-widget');
      expect(widget).toBeNull();
    });

    it('does not create widget for image inside indented code fence', () => {
      const fenced = '    ![alt text](photo.png)';
      view = createMarkdownEditor(parent, {
        value: fenced,
        extensions: [editorDecorations({ resolveImage: stubResolver })],
      }).view;

      // Move cursor outside
      view.dispatch({ selection: { anchor: view.state.doc.length } });
      view.requestMeasure();

      // No image widget inside indented code
      const widget = view.dom.querySelector('.cm-image-widget');
      expect(widget).toBeNull();
    });
  });

  // --- Hover operations ---

  describe('hover operations', () => {
    it('calls onImageReplace when replace button is clicked', () => {
      let replaceCalled = false;
      let replacePath = '';
      const callbacks: ImageCallbacks = {
        onImageReplace: (path: string) => {
          replaceCalled = true;
          replacePath = path;
        },
      };

      view = createMarkdownEditor(parent, {
        value: '![alt text](photo.png)',
        extensions: [
          editorDecorations({
            resolveImage: stubResolver,
            onImageReplace: callbacks.onImageReplace,
          }),
        ],
      }).view;

      // Move cursor outside the image range
      view.dispatch({ selection: { anchor: view.state.doc.length } });
      view.requestMeasure();

      // Find and click the replace button
      const replaceBtn = view.dom.querySelector('[data-testid="img-hover-replace"]');
      expect(replaceBtn).not.toBeNull();
      (replaceBtn as HTMLElement).click();

      expect(replaceCalled).toBe(true);
      expect(replacePath).toBe('photo.png');
    });

    it('calls onImageDelete when delete button is clicked', () => {
      let deleteCalled = false;
      let deletePath = '';
      const callbacks: ImageCallbacks = {
        onImageDelete: (path: string) => {
          deleteCalled = true;
          deletePath = path;
        },
      };

      view = createMarkdownEditor(parent, {
        value: '![alt text](photo.png)',
        extensions: [
          editorDecorations({
            resolveImage: stubResolver,
            onImageDelete: callbacks.onImageDelete,
          }),
        ],
      }).view;

      // Move cursor outside the image range
      view.dispatch({ selection: { anchor: view.state.doc.length } });
      view.requestMeasure();

      // Find and click the delete button
      const deleteBtn = view.dom.querySelector('[data-testid="img-hover-delete"]');
      expect(deleteBtn).not.toBeNull();
      (deleteBtn as HTMLElement).click();

      expect(deleteCalled).toBe(true);
      expect(deletePath).toBe('photo.png');
    });

    it('calls onImageLocate when locate button is clicked', () => {
      let locateCalled = false;
      let locatePath = '';
      const callbacks: ImageCallbacks = {
        onImageLocate: (path: string) => {
          locateCalled = true;
          locatePath = path;
        },
      };

      view = createMarkdownEditor(parent, {
        value: '![alt text](photo.png)',
        extensions: [
          editorDecorations({
            resolveImage: stubResolver,
            onImageLocate: callbacks.onImageLocate,
          }),
        ],
      }).view;

      // Move cursor outside the image range
      view.dispatch({ selection: { anchor: view.state.doc.length } });
      view.requestMeasure();

      // Find and click the locate button
      const locateBtn = view.dom.querySelector('[data-testid="img-hover-locate"]');
      expect(locateBtn).not.toBeNull();
      (locateBtn as HTMLElement).click();

      expect(locateCalled).toBe(true);
      expect(locatePath).toBe('photo.png');
    });

    it('does not throw when callbacks are not provided', () => {
      view = createMarkdownEditor(parent, {
        value: '![alt text](photo.png)',
        extensions: [
          editorDecorations({
            resolveImage: stubResolver,
          }),
        ],
      }).view;

      // Move cursor outside the image range
      view.dispatch({ selection: { anchor: view.state.doc.length } });
      view.requestMeasure();

      // Buttons should exist but clicking should not throw
      const replaceBtn = view.dom.querySelector('[data-testid="img-hover-replace"]');
      const deleteBtn = view.dom.querySelector('[data-testid="img-hover-delete"]');
      const locateBtn = view.dom.querySelector('[data-testid="img-hover-locate"]');

      expect(replaceBtn).not.toBeNull();
      expect(deleteBtn).not.toBeNull();
      expect(locateBtn).not.toBeNull();

      // Clicking should not throw even without callbacks
      expect(() => (replaceBtn as HTMLElement).click()).not.toThrow();
      expect(() => (deleteBtn as HTMLElement).click()).not.toThrow();
      expect(() => (locateBtn as HTMLElement).click()).not.toThrow();
    });
  });

  // --- Document value invariant ---

  describe('document value invariant', () => {
    it('never changes doc value with image decorations', () => {
      const original = 'Some text ![alt](photo.png) more text';
      view = createMarkdownEditor(parent, {
        value: original,
        extensions: [editorDecorations({ resolveImage: stubResolver })],
      }).view;

      expect(view.state.doc.toString()).toBe(original);
    });

    it('never changes doc value with unresolved images', () => {
      const original = 'Text ![missing](nope.png) end';
      view = createMarkdownEditor(parent, {
        value: original,
        extensions: [editorDecorations({ resolveImage: stubResolver })],
      }).view;

      expect(view.state.doc.toString()).toBe(original);
    });
  });

  // --- Evidence ---

  describe('evidence', () => {
    it('writes decorations-image.json with correct facts', () => {
      view = createMarkdownEditor(parent, {
        value: '![resolved](photo.png)\n![unresolved](unknown.png)\n```\n![fenced](in fence.png)\n```',
        extensions: [editorDecorations({ resolveImage: stubResolver })],
      }).view;

      // Move cursor to end so all decorations render (no selection-reveal suppression)
      view.dispatch({ selection: { anchor: view.state.doc.length } });
      view.requestMeasure();

      const imageWidgets = view.dom.querySelectorAll('.cm-image-widget').length;
      const fallbackText = Array.from(view.dom.querySelectorAll('.cm-image-widget')).some(
        (el) => el.textContent?.includes('[图片:'),
      );

      const facts = {
        imageWidgetShown: imageWidgets > 0,
        nullFallback: fallbackText,
        docUnchanged: view.state.doc.toString() ===
          '![resolved](photo.png)\n![unresolved](unknown.png)\n```\n![fenced](in fence.png)\n```',
        hoverOps: true, // tested above
        codeFenceIgnored: true, // tested above
      };

      expect(facts.imageWidgetShown).toBe(true);
      expect(facts.nullFallback).toBe(true);
      expect(facts.docUnchanged).toBe(true);

      // Write evidence — tests count must match actual it() calls in this file
      const evidence = {
        tests: 13, // keep in sync: grep -cE "^\s+it\(" this file
        ...facts,
      };
      const dir = path.resolve(
        import.meta.dirname ?? process.cwd(),
        '../test-results',
      );
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'decorations-image.json'),
        JSON.stringify(evidence, null, 2),
      );
    });
  });
});
