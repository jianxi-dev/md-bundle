// #498：图片 widget 解析/写回 `<!--w=N-->`，并渲染缩放手柄。
import { describe, expect, it } from 'vitest'
import { EditorView } from '@codemirror/view'
import {
  applyImageWidth,
  createImageDecorations,
  MAX_IMAGE_WIDTH,
  MIN_IMAGE_WIDTH,
  parseImageWidth,
} from '../src/decorations/image'
import { createMarkdownEditor } from '../src/editor'

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

describe('image width comment (#498)', () => {
  it('parses a trailing width comment after the image', () => {
    const text = '![a](p.png)<!--w=240-->'
    const after = '![a](p.png)'.length
    expect(parseImageWidth(text, after)).toBe(240)
    expect(parseImageWidth('![a](p.png)', after)).toBeNull()
  })

  it('rejects out-of-range values', () => {
    const text = '![a](p.png)<!--w=9999-->'
    const after = '![a](p.png)'.length
    expect(parseImageWidth(text, after)).toBeNull()
  })

  it('renders a resize handle for a resolved image', () => {
    const parent = document.createElement('div')
    document.body.appendChild(parent)
    const view = createMarkdownEditor(parent, { value: '![a](p.png)' }).view
    const decorations = createImageDecorations(
      view.state.doc.toString(),
      () => PNG,
      {},
    )
    expect(decorations.length).toBe(1)
    const widget = decorations[0].value.spec.widget as { toDOM: () => HTMLElement }
    const dom = widget.toDOM()
    expect(dom.querySelector('[data-testid="cm-image-resize"]')).not.toBeNull()
    expect(dom.querySelector('img')).not.toBeNull()
  })

  it('writes and replaces the width comment in the document', () => {
    const parent = document.createElement('div')
    document.body.appendChild(parent)
    const view: EditorView = createMarkdownEditor(parent, { value: '![a](p.png)' }).view

    applyImageWidth(view, 0, 180)
    expect(view.state.doc.toString()).toBe('![a](p.png)<!--w=180-->')

    applyImageWidth(view, 0, 260)
    expect(view.state.doc.toString()).toBe('![a](p.png)<!--w=260-->')

    // clamp
    applyImageWidth(view, 0, 1)
    expect(view.state.doc.toString()).toBe(`![a](p.png)<!--w=${MIN_IMAGE_WIDTH}-->`)
    applyImageWidth(view, 0, 999999)
    expect(view.state.doc.toString()).toBe(`![a](p.png)<!--w=${MAX_IMAGE_WIDTH}-->`)
  })
})
