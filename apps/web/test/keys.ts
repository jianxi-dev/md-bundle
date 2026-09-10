// 平台感知撤销快捷键：CM6 的 Mod-z 在 macOS 绑定 Cmd+z（Playwright 键名 Meta+z），
// 在 Linux/Windows 绑定 Ctrl+z（Playwright 键名 Control+z）。
// e2e 必须按运行平台发送正确键位，否则 CI（Linux）上 undo 永不触发（历史教训：v2-modes/v2-outline 曾因写死 Meta+z 在 CI 全挂）。
export const UNDO_KEY = process.platform === 'darwin' ? 'Meta+z' : 'Control+z'