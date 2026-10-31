// #471：图标 SSOT。命令 id → 图标名必须一一映射，且映射到的名字必须已注册。
import { describe, expect, it } from 'vitest'
import { COMMAND_ICON_NAME, hasIcon } from '../src/icons'

/** 豆包 spec (.lavish/doubao-editor-spec-v2.html) 里有、我们缺的 8 个。 */
const DOUBAO_MISSING = [
  'BoldOutlined',
  'ItalicOutlined',
  'UnderlineOutlined',
  'StrikethroughOutlined',
  'FontcolorOutlined',
  'DocColumnsOutlined',
  'GlobalLinkOutlined',
  'DeleteTrashOutlined',
] as const

describe('icons SSOT (#471)', () => {
  it('补齐豆包 spec 缺的图标', () => {
    for (const name of DOUBAO_MISSING) {
      expect(hasIcon(name), name).toBe(true)
    }
  })

  it('所有格式/插入/对齐/颜色命令都映射到已注册图标', () => {
    const ids = Object.keys(COMMAND_ICON_NAME)
    expect(ids.length).toBeGreaterThanOrEqual(40)
    for (const id of ids) {
      const name = COMMAND_ICON_NAME[id]
      expect(hasIcon(name), `${id} → ${name}`).toBe(true)
    }
  })

  it('映射表覆盖工具栏默认项与常用命令', () => {
    for (const id of [
      'toggle-bold',
      'toggle-italic',
      'toggle-underline',
      'toggle-strikethrough',
      'toggle-code',
      'toggle-link',
      'color-red',
      'align-left',
      'col-2',
      'code-copy',
      'turn-into-h2',
      'insert-task-list',
      'insert-quote',
      'insert-code-block',
      'insert-callout',
      'insert-table',
    ]) {
      expect(COMMAND_ICON_NAME[id], id).toBeTruthy()
    }
  })
})
