// ESC 退出全屏辅助函数
export function exitFullscreenOnEscape(e: KeyboardEvent): boolean {
  if (e.key === 'Escape' && document.fullscreenElement) {
    void document.exitFullscreen()
    return true
  }
  return false
}
