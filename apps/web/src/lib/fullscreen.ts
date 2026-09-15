// 任务 13：ESC 退出全屏辅助函数
// 纯函数，抽出 App 以便单元测试。
export function exitFullscreenOnEscape(e: KeyboardEvent): boolean {
  if (e.key === 'Escape' && document.fullscreenElement) {
    void document.exitFullscreen()
    return true
  }
  return false
}

// 追踪全屏状态：fullscreenchange 在 keydown 之前触发（Chrome）或之后触发（Safari）
// 用时间戳判断"最近是否刚退出全屏"
let _lastExitFullscreenTs = 0
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) {
    _lastExitFullscreenTs = Date.now()
  }
})

/** 检查最近 200ms 内是否刚退出全屏（用于 ESC handler 跳过模式切换） */
export function wasJustFullscreen(): boolean {
  return Date.now() - _lastExitFullscreenTs < 200
}
