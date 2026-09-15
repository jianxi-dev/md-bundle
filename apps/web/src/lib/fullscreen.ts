// 任务 13：ESC 退出全屏辅助函数
// 纯函数，抽出 App 以便单元测试。
//
// 关键洞察：
// - Chrome: ESC 退出全屏是浏览器默认行为，fullscreenchange 先于 keydown 触发，
//   所以 keydown 中 document.fullscreenElement 已为 null。
// - Safari: ESC 不自动退出全屏，需要 JS 调用 exitFullscreen()。
// 统一方案：用 fullscreenchange 事件记录"刚退出全屏"，
// 并在 keydown handler 中通过时间窗口判断。
let _lastFsChangeTime = 0
let _lastFsChangeWasExit = false

document.addEventListener('fullscreenchange', () => {
  const isFs = !!document.fullscreenElement
  _lastFsChangeTime = Date.now()
  _lastFsChangeWasExit = !isFs
  console.log(`[FS-DIAG] fullscreenchange: fs=${isFs}, time=${Date.now()}`)
})

export function exitFullscreenOnEscape(e: KeyboardEvent): boolean {
  console.log(`[FS-DIAG] exitFullscreenOnEscape: key=${e.key}, fs=${!!document.fullscreenElement}`)
  if (e.key === 'Escape' && document.fullscreenElement) {
    void document.exitFullscreen()
    return true
  }
  return false
}

/**
 * 检查是否应该跳过模式切换：
 * 1. 当前 keydown 中 fullscreenElement 存在（Safari 路径）→ exitFullscreenOnEscape 已处理
 * 2. 最近 500ms 内触发了 fullscreenchange 退出（Chrome 默认行为路径）
 */
export function shouldSkipModeSwitch(): boolean {
  const sinceFsChange = Date.now() - _lastFsChangeTime
  const wasExit = _lastFsChangeWasExit
  const result = wasExit && sinceFsChange < 500
  if (result) {
    _lastFsChangeWasExit = false  // consume
  }
  console.log(`[FS-DIAG] shouldSkipModeSwitch: wasExit=${wasExit}, sinceFsChange=${sinceFsChange}ms, result=${result}`)
  return result
}
