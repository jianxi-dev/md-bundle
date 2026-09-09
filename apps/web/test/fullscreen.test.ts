// 任务 13：ESC 退出全屏单元测试。
// jsdom 无 document.exitFullscreen / fullscreenElement，需 beforeEach 注入 stub。
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { exitFullscreenOnEscape } from '../src/lib/fullscreen'

describe('exitFullscreenOnEscape', () => {
  beforeEach(() => {
    Object.defineProperty(document, 'exitFullscreen', {
      configurable: true,
      writable: true,
      value: () => Promise.resolve(),
    })
  })

  function makeKey(key: string): KeyboardEvent {
    return new KeyboardEvent('keydown', { key })
  }

  it('ESC + fullscreenElement 存在 → 调用 exitFullscreen，返回 true', () => {
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      value: document.body,
    })
    const spy = vi.spyOn(document, 'exitFullscreen')
    const result = exitFullscreenOnEscape(makeKey('Escape'))
    expect(spy).toHaveBeenCalledOnce()
    expect(result).toBe(true)
  })

  it('ESC + fullscreenElement 为 null → 不调用，返回 false', () => {
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      value: null,
    })
    const spy = vi.spyOn(document, 'exitFullscreen')
    const result = exitFullscreenOnEscape(makeKey('Escape'))
    expect(spy).not.toHaveBeenCalled()
    expect(result).toBe(false)
  })

  it('非 ESC 键 + 全屏中 → 不调用，返回 false', () => {
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      value: document.body,
    })
    const spy = vi.spyOn(document, 'exitFullscreen')
    const result = exitFullscreenOnEscape(makeKey('a'))
    expect(spy).not.toHaveBeenCalled()
    expect(result).toBe(false)
  })
})
