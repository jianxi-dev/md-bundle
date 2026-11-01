// #507：包骨架只导出契约（type-only）。这里锁住「可被消费者 import」这一点，
// 避免骨架退化成空包或提前塞进未完成的实现。
import { describe, expect, it } from 'vitest'
import * as kit from '../src'

describe('app-kit skeleton', () => {
  it('exposes no runtime values yet (contracts are type-only)', () => {
    expect(Object.keys(kit)).toEqual([])
  })
})
