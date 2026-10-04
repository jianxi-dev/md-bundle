/**
 * Media + mermaid edit-mode decorations.
 *
 * Covers extension-based classification of `![alt](path)` references (video
 * player vs file card vs unchanged image) and the mermaid fenced-block
 * replacement: inactive → diagram widget, active → raw editable source.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Range } from '@codemirror/state';
import { Decoration, EditorView } from '@codemirror/view';
import { createMarkdownEditor } from '../src/editor';
import { editorDecorations } from '../src/decorations';
import { classifyMedia, createImageDecorations } from '../src/decorations/image';
import { createMermaidDecorations } from '../src/decorations/mermaid';

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

interface WidgetLike {
  eq(other: unknown): boolean;
  toDOM(): HTMLElement;
  ignoreEvent(event?: Event): boolean;
}

function widgetOf(deco: Range<Decoration>): WidgetLike {
  return deco.value.spec.widget;
}

describe('classifyMedia', () => {
  it('classifies by extension, mirroring the shared renderer', () => {
    expect(classifyMedia('clip.mp4')).toBe('video');
    expect(classifyMedia('clip.webm')).toBe('video');
    expect(classifyMedia('clip.mov')).toBe('video');
    expect(classifyMedia('report.pdf')).toBe('file');
    expect(classifyMedia('archive.zip?v=2')).toBe('file');
    expect(classifyMedia('x.png')).toBe('image');
    expect(classifyMedia('photo.JPEG')).toBe('image');
    expect(classifyMedia('no-extension')).toBe('image');
  });
});

describe('createImageDecorations media variants', () => {
  it('renders a video player for a video extension', () => {
    const decos = createImageDecorations('![clip](clip.mp4)');
    expect(decos).toHaveLength(1);
    const dom = widgetOf(decos[0]).toDOM();
    expect(dom.classList.contains('cm-media-widget')).toBe(true);
    expect(dom.classList.contains('cm-media-video')).toBe(true);
    const video = dom.querySelector('video');
    expect(video).not.toBeNull();
    expect(video?.hasAttribute('controls')).toBe(true);
    expect(video?.getAttribute('preload')).toBe('metadata');
    expect(video?.getAttribute('src')).toBe('clip.mp4');
  });

  it('uses the resolver result for the video src, falling back to the path', () => {
    const resolved = createImageDecorations('![clip](clip.mp4)', (path) =>
      path === 'clip.mp4' ? 'data:video/mp4;base64,zzz' : null,
    );
    expect(widgetOf(resolved[0]).toDOM().querySelector('video')?.getAttribute('src')).toBe(
      'data:video/mp4;base64,zzz',
    );
    const unresolved = createImageDecorations('![clip](clip.mp4)');
    expect(widgetOf(unresolved[0]).toDOM().querySelector('video')?.getAttribute('src')).toBe(
      'clip.mp4',
    );
  });

  it('renders a file link card for a non-image, non-video extension', () => {
    const decos = createImageDecorations('![report](report.pdf)');
    const dom = widgetOf(decos[0]).toDOM();
    expect(dom.classList.contains('cm-media-widget')).toBe(true);
    expect(dom.classList.contains('cm-media-file')).toBe(true);
    const link = dom.querySelector('a');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toBe('report.pdf');
    expect(link?.textContent).toBe('report');
  });

  it('falls back to the path as file-card text when alt is empty', () => {
    const decos = createImageDecorations('![](notes.txt)');
    expect(widgetOf(decos[0]).toDOM().querySelector('a')?.textContent).toBe('notes.txt');
  });

  it('keeps the image branch unchanged (resolved img widget)', () => {
    const decos = createImageDecorations('![x](x.png)', () => 'data:image/png;base64,img');
    const dom = widgetOf(decos[0]).toDOM();
    expect(dom.classList.contains('cm-image-widget')).toBe(true);
    expect(dom.querySelector('img')?.getAttribute('src')).toBe('data:image/png;base64,img');
  });

  it('treats different media kinds as unequal in eq()', () => {
    const video = widgetOf(createImageDecorations('![c](c.mp4)')[0]);
    const file = widgetOf(createImageDecorations('![r](r.pdf)')[0]);
    expect(video.eq(video)).toBe(true);
    expect(video.eq(file)).toBe(false);
  });

  it('keeps controls interactive while the card body hands clicks to the editor', () => {
    const video = widgetOf(createImageDecorations('![c](c.mp4)')[0]);
    const videoDom = video.toDOM();
    const videoEl = videoDom.querySelector('video')!;
    expect(video.ignoreEvent({ target: videoEl } as unknown as Event)).toBe(true);
    expect(video.ignoreEvent({ target: videoDom } as unknown as Event)).toBe(false);

    const file = widgetOf(createImageDecorations('![r](r.pdf)')[0]);
    const fileDom = file.toDOM();
    expect(file.ignoreEvent({ target: fileDom.querySelector('a')! } as unknown as Event)).toBe(
      true,
    );
    expect(file.ignoreEvent({ target: fileDom } as unknown as Event)).toBe(false);
  });
});

describe('createMermaidDecorations', () => {
  const DOC = '```mermaid\ngraph TD;\n```';

  it('replaces an inactive mermaid block across its whole line range', () => {
    const decos = createMermaidDecorations(DOC, -1, -1);
    expect(decos).toHaveLength(1);
    expect(decos[0].from).toBe(0);
    expect(decos[0].to).toBe(DOC.length);
    expect(decos[0].value.spec.block).toBe(true);
  });

  it('emits nothing for the active block (source stays editable)', () => {
    expect(createMermaidDecorations(DOC, 0, DOC.length)).toHaveLength(0);
  });

  it('handles tilde fences', () => {
    expect(createMermaidDecorations('~~~mermaid\ngraph TD;\n~~~', -1, -1)).toHaveLength(1);
  });

  it('ignores non-mermaid and unlabelled fences', () => {
    expect(createMermaidDecorations('```ts\nlet x = 1;\n```', -1, -1)).toHaveLength(0);
    expect(createMermaidDecorations('```\nplain\n```', -1, -1)).toHaveLength(0);
  });

  it('hands clicks to the editor so the cursor can enter the block', () => {
    const widget = widgetOf(createMermaidDecorations(DOC, -1, -1)[0]);
    expect(widget.ignoreEvent()).toBe(false);
  });
});

describe('mermaid editing integration', () => {
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

  it('shows the diagram widget when inactive and reveals source when active', () => {
    const hydrate = vi.fn(async (_root: HTMLElement, _theme: 'dark' | 'light') => {});
    const doc = '```mermaid\ngraph TD;\n```';
    view = createMarkdownEditor(parent, {
      value: doc,
      extensions: [editorDecorations({ hydrateMermaid: hydrate })],
    }).view;

    view.dispatch({ selection: { anchor: view.state.doc.length } });
    view.requestMeasure();

    expect(view.dom.querySelector('.cm-mermaid-block')).not.toBeNull();
    expect(view.dom.querySelector('.cm-content')?.textContent ?? '').not.toContain('```mermaid');

    expect(hydrate).toHaveBeenCalled();
    const root = hydrate.mock.calls[0][0];
    expect(root).toBeInstanceOf(HTMLElement);
    expect(root.classList.contains('cm-mermaid-block')).toBe(true);

    view.dispatch({ selection: { anchor: 1 } });
    view.requestMeasure();
    const activeText = view.dom.querySelector('.cm-content')?.textContent ?? '';
    expect(activeText).toContain('```mermaid');
    expect(activeText).toContain('graph TD;');
  });

  it('does not label a mermaid fence with the code language widget', () => {
    view = createMarkdownEditor(parent, {
      value: '```mermaid\ngraph TD;\n```',
      extensions: [editorDecorations({ hydrateMermaid: async () => {} })],
    }).view;
    view.dispatch({ selection: { anchor: view.state.doc.length } });
    view.requestMeasure();
    expect(view.dom.querySelector('.cm-fenced-code-language')).toBeNull();
  });
});
