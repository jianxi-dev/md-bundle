// 平台感知快捷键：CM6 的 Mod 在 macOS 绑定 Cmd（Playwright 键名 Meta），
// 在 Linux/Windows 绑定 Ctrl（Playwright 键名 Control）。
// e2e 必须按运行平台发送正确键位，否则 CI（Linux）上对应功能永不触发（历史教训：v2-modes/v2-outline 曾因写死 Meta+z 在 CI 全挂）。

// 撤销快捷键（#206 之前已有教训）
export const UNDO_KEY = process.platform === 'darwin' ? 'Meta+z' : 'Control+z'

// 命令面板快捷键：CM6 的 Mod-k 在 macOS 绑定 Cmd+k，Linux/Windows 绑定 Ctrl+k。
// #206 structure-lint.spec.ts 因写死 Meta+k 在 Linux CI 上命令面板打不开而全挂。
export const PALETTE_KEY = process.platform === 'darwin' ? 'Meta+k' : 'Control+k'