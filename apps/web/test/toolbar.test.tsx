// 主题按钮三态图标测试（change: theme-icon-tri-state）。
// 覆盖：light → 太阳 / dark → 月亮 / system → 半月；title/aria-label 反映状态；点击后图标随 prop 更新。
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { Toolbar } from '../src/components/Toolbar'

type ThemeProp = 'system' | 'dark' | 'light'

// 与 App.handleThemeClick 一致的循环顺序：system → dark → light → system。
const CYCLE: Record<ThemeProp, ThemeProp> = { system: 'dark', dark: 'light', light: 'system' }

function baseProps() {
  return {
    canSave: true,
    sourceKind: 'md' as const,
    onSave: vi.fn(),
    onExport: vi.fn(),
    onOpenFile: vi.fn(),
  }
}

/** 主题按钮内 svg 的标记，用于区分太阳 / 月亮 / 半月。 */
function themeIconMarkup(): string {
  return screen.getByTestId('theme-btn').innerHTML
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('Toolbar 主题按钮：三态图标', () => {
  it('light 渲染太阳图标（核心圆 r=4 + 八向光线）', () => {
    render(<Toolbar {...baseProps()} themeProp="light" />)
    const markup = themeIconMarkup()
    expect(markup).toContain('r="4"')
    expect(markup).toContain('M12 2v2')
    expect(markup).not.toContain('12.79')
    expect(markup).not.toContain('r="9"')
  })

  it('dark 渲染月亮图标', () => {
    render(<Toolbar {...baseProps()} themeProp="dark" />)
    const markup = themeIconMarkup()
    expect(markup).toContain('12.79')
    expect(markup).not.toContain('r="4"')
    expect(markup).not.toContain('r="9"')
  })

  it('system 渲染现有半月图标（外圈 r=9 + 实心半圆）', () => {
    render(<Toolbar {...baseProps()} themeProp="system" />)
    const markup = themeIconMarkup()
    expect(markup).toContain('r="9"')
    expect(markup).toContain('fill="currentColor"')
    expect(markup).not.toContain('12.79')
    expect(markup).not.toContain('r="4"')
  })

  it('title / aria-label 反映当前状态与下一步操作', () => {
    const { rerender } = render(<Toolbar {...baseProps()} themeProp="light" />)
    let btn = screen.getByTestId('theme-btn')
    expect(btn).toHaveAttribute('aria-label', '当前浅色主题')
    expect(btn).toHaveAttribute('title', '当前：浅色（点击切换到深色）')

    rerender(<Toolbar {...baseProps()} themeProp="dark" />)
    btn = screen.getByTestId('theme-btn')
    expect(btn).toHaveAttribute('aria-label', '当前深色主题')
    expect(btn).toHaveAttribute('title', '当前：深色（点击切换到跟随系统）')

    rerender(<Toolbar {...baseProps()} themeProp="system" />)
    btn = screen.getByTestId('theme-btn')
    expect(btn).toHaveAttribute('aria-label', '当前跟随系统主题')
    expect(btn).toHaveAttribute('title', '当前：跟随系统（点击切换到浅色）')
  })

  it('点击后图标随 themeProp 更新：system → dark → light → system', () => {
    function Harness() {
      const [themeProp, setThemeProp] = useState<ThemeProp>('system')
      return (
        <Toolbar
          {...baseProps()}
          themeProp={themeProp}
          onThemeClick={() => setThemeProp(CYCLE[themeProp])}
        />
      )
    }

    render(<Harness />)

    expect(themeIconMarkup()).toContain('r="9"')

    fireEvent.click(screen.getByTestId('theme-btn'))
    expect(themeIconMarkup()).toContain('12.79')

    fireEvent.click(screen.getByTestId('theme-btn'))
    expect(themeIconMarkup()).toContain('r="4"')

    fireEvent.click(screen.getByTestId('theme-btn'))
    expect(themeIconMarkup()).toContain('r="9"')
  })
})
