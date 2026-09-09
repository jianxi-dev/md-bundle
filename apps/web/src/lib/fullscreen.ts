// 任务 13：ESC 退出全屏辅助函数
// 纯函数，抽出 App 以便单元测试。
export function exitFullscreenOnEscape(e: KeyboardEvent): boolean {
  if (e.key === 'Escape' && document.fullscreenElement) {
    void document.exitFullscreen()
    return true
  }
  return false
}
