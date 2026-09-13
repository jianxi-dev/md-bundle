// FileTree 更换文件夹入口测试（修复 #76）。
// 覆盖：(a) 已授权时渲染 filetree-switch-btn；(b) 点击调用 grantWorkspaceFolder；
// (c) 更换后 header 显示新文件夹名；(d) 未授权空态不渲染该按钮（保留原授权 CTA）。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  grantWorkspaceFolder,
  isFsaAvailable,
  loadWorkspaceHandle,
  persistWorkspaceHandle,
} from '../src/lib/fsa'
import { FileTree } from '../src/components/FileTree'

vi.mock('../src/lib/fsa', () => ({
  isFsaAvailable: vi.fn(),
  loadWorkspaceHandle: vi.fn(),
  grantWorkspaceFolder: vi.fn(),
  persistWorkspaceHandle: vi.fn(),
  requestReGrant: vi.fn(),
}))

const mockedIsFsaAvailable = vi.mocked(isFsaAvailable)
const mockedLoadWorkspaceHandle = vi.mocked(loadWorkspaceHandle)
const mockedGrantWorkspaceFolder = vi.mocked(grantWorkspaceFolder)
const mockedPersistWorkspaceHandle = vi.mocked(persistWorkspaceHandle)

interface FakeDirEntry {
  kind: 'file' | 'directory'
  name: string
}

// 最小目录句柄：满足 readDirHandle 使用的 name + async iterable values()。
function makeFakeDir(name: string, entries: FakeDirEntry[] = []): FileSystemDirectoryHandle {
  const fake = {
    name,
    async *values(): AsyncIterableIterator<FileSystemHandle> {
      for (const entry of entries) {
        yield entry as unknown as FileSystemHandle
      }
    },
  }
  return fake as unknown as FileSystemDirectoryHandle
}

describe('FileTree 更换文件夹', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedIsFsaAvailable.mockReturnValue(true)
    mockedPersistWorkspaceHandle.mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    cleanup()
  })

  it('已授权时渲染「更换文件夹」按钮并显示当前文件夹名', async () => {
    mockedLoadWorkspaceHandle.mockResolvedValue({ ok: true, handle: makeFakeDir('folder-a') })

    render(<FileTree onOpenFile={vi.fn()} activeTabName={null} />)

    expect(await screen.findByTestId('filetree-switch-btn')).toBeInTheDocument()
    expect(screen.getByText('folder-a')).toBeInTheDocument()
  })

  it('点击「更换文件夹」调用 grantWorkspaceFolder 并显示新文件夹名', async () => {
    mockedLoadWorkspaceHandle.mockResolvedValue({ ok: true, handle: makeFakeDir('folder-a') })
    mockedGrantWorkspaceFolder.mockResolvedValue({ ok: true, handle: makeFakeDir('folder-b') })

    render(<FileTree onOpenFile={vi.fn()} activeTabName={null} />)

    const switchBtn = await screen.findByTestId('filetree-switch-btn')
    expect(screen.getByText('folder-a')).toBeInTheDocument()

    fireEvent.click(switchBtn)

    await waitFor(() => expect(grantWorkspaceFolder).toHaveBeenCalledTimes(1))
    expect(persistWorkspaceHandle).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'folder-b' }),
    )
    expect(await screen.findByText('folder-b')).toBeInTheDocument()
    expect(screen.queryByText('folder-a')).not.toBeInTheDocument()
  })

  it('未授权空态不渲染「更换文件夹」按钮（保留原授权 CTA）', async () => {
    mockedLoadWorkspaceHandle.mockResolvedValue({ ok: false, empty: true })

    render(<FileTree onOpenFile={vi.fn()} activeTabName={null} />)

    expect(await screen.findByTestId('filetree-grant-btn')).toBeInTheDocument()
    expect(screen.queryByTestId('filetree-switch-btn')).toBeNull()
  })
})
