// #498：`![alt](src)<!--w=N-->` 在预览里把宽度作用到前一个 img。
import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '../src'

const HTML = (body: string): Document =>
  new DOMParser().parseFromString(body, 'text/html')

describe('image width comment (#498)', () => {
  it('applies the width to the preceding image and drops the comment', () => {
    const doc = HTML(renderMarkdown('![a](pic.png)<!--w=120-->\n'))
    const img = doc.querySelector('img')!
    expect(img.getAttribute('width')).toBe('120')
    expect(img.style.width).toBe('120px')
    expect(doc.body.textContent).not.toContain('w=120')
  })

  it('leaves an image without a comment at natural size', () => {
    const doc = HTML(renderMarkdown('![a](pic.png)\n'))
    const img = doc.querySelector('img')!
    expect(img.getAttribute('width')).toBeNull()
  })

  it('ignores out-of-range widths', () => {
    const doc = HTML(renderMarkdown('![a](pic.png)<!--w=5-->\n'))
    expect(doc.querySelector('img')!.getAttribute('width')).toBeNull()
  })
})
