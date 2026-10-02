import { beforeEach, describe, expect, it } from 'vitest'
import { isEmptyLine } from '../src/empty-line-entry'

// jsdom lacks requestAnimationFrame/ResizeObserver; CodeMirror 6 uses both.
function installPolyfills(): void {
  if (typeof globalThis.requestAnimationFrame !== 'function') {
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 16)) as unknown as typeof requestAnimationFrame
    globalThis.cancelAnimationFrame = ((id: number) =>
      clearTimeout(id)) as unknown as typeof cancelAnimationFrame
  }
  if (typeof globalThis.ResizeObserver !== 'function') {
    globalThis.ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver
  }
}

describe('empty-line-entry pure helpers', () => {
  beforeEach(() => {
    installPolyfills()
  })

  describe('isEmptyLine', () => {
    it('returns true for empty string', () => {
      expect(isEmptyLine('')).toBe(true)
    })

    it('returns true for whitespace-only string', () => {
      expect(isEmptyLine('   ')).toBe(true)
      expect(isEmptyLine('\t')).toBe(true)
      expect(isEmptyLine(' \t \n ')).toBe(true)
    })

    it('returns false for non-empty string', () => {
      expect(isEmptyLine('hello')).toBe(false)
      expect(isEmptyLine(' hello')).toBe(false)
      expect(isEmptyLine('hello ')).toBe(false)
      expect(isEmptyLine('  hello  ')).toBe(false)
    })

    it('returns false for string with non-whitespace characters', () => {
      expect(isEmptyLine('a')).toBe(false)
      expect(isEmptyLine('1')).toBe(false)
      expect(isEmptyLine('#')).toBe(false)
      expect(isEmptyLine('- ')).toBe(false)
    })
  })
})
