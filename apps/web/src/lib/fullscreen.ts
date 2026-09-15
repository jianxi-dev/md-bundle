// 任务 13：ESC 退出全屏辅助函数
// 纯函数，抽出 App 以便单元测试。
// 关键：exitFullscreen() 是异步的，fullscreenchange 在 keydown 之后才触发，
// 所以不能用 fullscreenchange 时间戳来判断"是否刚退出全屏"。
// 必须在 exitFullscreenOnEscape 中同步设置标志，供后续 keydown handler 检查。
let _exitedFullscreenThisKeydown = false

export function exitFullscreenOnEscape(e: KeyboardEvent): boolean {
  if (e.key === 'Escape' && document.fullscreenElement) {
    _exitedFullscreenThisKeydown = true
    void document.exitFullscreen()
    return true
  }
  return false
}

/** 检查当前 keydown 是否刚触发了退出全屏（用于 ESC handler 跳过模式切换） */
export function didJustExitFullscreen(): boolean {
  if (_exitedFullscreenThisKeydown) {
    _exitedFullscreenThisKeydown = false
    return true
  }
  return false
}
