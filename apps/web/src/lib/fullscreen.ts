// 任务 13：ESC 退出全屏辅助函数
// 纯函数，抽出 App 以便单元测试。
// 修复：全屏时调用 stopImmediatePropagation 阻止后续 keydown handler（如 preview→edit 切换），
// 确保 ESC 只处理退出全屏，不触发模式切换。
export function exitFullscreenOnEscape(e: KeyboardEvent): boolean {
  if (e.key === 'Escape' && document.fullscreenElement) {
    e.stopImmediatePropagation()
    void document.exitFullscreen()
    return true
  }
  return false
}
