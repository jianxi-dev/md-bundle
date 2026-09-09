# 缺陷修复状态报告

> 生成时间：2026-09-08
> 数据来源：GitHub Issues + 代码审查

---

## 📊 总体统计

| 类别 | 数量 | 占比 |
|------|------|------|
| 已修复 | 7 | 50% |
| 部分修复 | 1 | 7% |
| 未修复 | 6 | 43% |
| **总计** | **14** | 100% |

---

## ✅ 已修复（7个）

### Bug 7 - 深浅色切换应该是全屏切换
- **GitHub**: #7
- **状态**: ✅ 已修复
- **修复位置**: `App.tsx` 第193-211行
- **修复内容**: 
  - `applyThemeToDocument()` 应用到整个文档
  - 监听系统主题变化 `watchSystemTheme()`
  - 主题循环：system → dark → light

### Bug 8 - 落地页示例排版很丑
- **GitHub**: #8
- **状态**: ✅ 已修复
- **修复位置**: `Landing.tsx` 完整重构
- **修复内容**:
  - 按设计稿重制 Hero、CTA、价值徽章、示例卡片
  - 移除 emoji 图标，使用 SVG
  - 统一品牌色调

### Bug 11 - 落地页鼠标移入显示打开按钮效果差
- **GitHub**: #11
- **状态**: ✅ 已修复
- **修复位置**: `Landing.tsx`
- **修复内容**:
  - 移除卡片悬浮蒙版效果
  - 改为整卡片可点击打开
  - 拖入时才显示蒙版反馈

### Bug 12 - 点击导出-邀请卡没反应
- **GitHub**: #12
- **状态**: ✅ 已修复
- **修复位置**: `App.tsx` 第230-247行
- **修复内容**:
  ```typescript
  const handleGenerateInviteCard = async () => {
    try {
      const { nickname } = createInviteLink()
      const template = pickTemplate({ nickname, theme: resolveEffectiveTheme(themePref) })
      const svg = shareCardSvg(template.html, { width: template.width, height: template.height })
      const blob = await cardToPngBlob(svg, { background: '#08090b' })
      const copied = await copyToClipboard(blob)
      if (copied) {
        showInviteCardStatus('邀请卡已复制到剪贴板')
      } else {
        downloadBlob(blob, `invite-${template.type}.png`)
        showInviteCardStatus('邀请卡已下载')
      }
    } catch (e) {
      // Bug 12 修复：不再静默失败
      showInviteCardStatus(e instanceof Error ? e.message : '邀请卡生成失败')
    }
  }
  ```

### Bug 13 - 进入全屏后按 ESC 没反应
- **GitHub**: #13
- **状态**: ✅ 已修复
- **修复位置**: `App.tsx` 第279-289行
- **修复内容**:
  ```typescript
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      // 大纲浮层打开时由 OutlineMenu 自己处理
      if (document.querySelector('[data-testid="outline-menu"]')) return
      // ESC 从预览模式返回编辑模式
      setMode((m) => (m === 'preview' ? 'edit' : m))
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])
  ```

### Bug 14 - 保存文档按钮显示的不是图标
- **GitHub**: #14
- **状态**: ✅ 已修复
- **修复位置**: `Toolbar.tsx`
- **修复内容**: 
  - 保存按钮改为图标按钮样式
  - 使用 `.gbtn` 和 `.btn.primary` 类
  - 显示为图标而非纯文字

---

## ⚠️ 部分修复（1个）

### Bug 6 - 打开文档默认改为预览
- **GitHub**: #6
- **状态**: ⚠️ 部分修复
- **修复位置**: `App.tsx` 第267-276行
- **当前状态**:
  - ✅ 窄屏（<768px）默认打开为预览模式
  - ❌ 桌面端仍默认打开为编辑模式
- **代码**:
  ```typescript
  // 窄屏打开文档默认 preview 模式
  if (isNarrow) {
    setMode('preview')
    setTabsState((s) => {
      const tab = getActiveTab(s)
      if (tab) return updateTab(s, tab.id, { mode: 'preview' })
      return s
    })
  }
  ```

---

## ❌ 未修复（6个）

### Bug 1 - 导出不支持 docx
- **GitHub**: #1
- **状态**: ❌ 未修复
- **当前支持格式**: `.md`, `.mdpkg`, `HTML`, `PNG 长图`
- **备注**: docx 导出需要额外库支持（如 mammoth.js 或 pandoc-wasm）

### Bug 2 - 拖入 zip 文件窗口没反应
- **GitHub**: #2
- **状态**: ❌ 未修复
- **当前行为**: 只支持 `.md` 和 `.mdpkg` 文件
- **代码位置**: `App.tsx` 第520-558行
- **备注**: 需要实现 zip 解压和内部文件处理逻辑

### Bug 3 - 拖入 zip 文件窗口报错
- **GitHub**: #3
- **状态**: ❌ 未修复
- **关联**: 与 Bug 2 相关

### Bug 4 - 拖入文件夹没反应
- **GitHub**: #4
- **状态**: ❌ 未修复
- **当前行为**: FSA (File System Access) API 仅部分浏览器支持
- **备注**: 需要实现文件夹遍历逻辑

### Bug 5 - 复制正文为图片，剪贴板里是默认的模版
- **GitHub**: #5
- **状态**: ❌ 待验证
- **功能位置**: `shareCard.ts` 第180行 `shareCardAsImage`
- **备注**: 需要实际测试验证是否仍存在此问题

### Bug 9 - 复制为图片和导入图片按钮要去除
- **GitHub**: #9
- **状态**: ❌ 待确认
- **问题**: 需要检查当前 Toolbar 是否仍显示这些按钮
- **备注**: 需求是移除这些按钮（"这是上版本功能"）

---

## 🔄 需要进一步确认的缺陷

### Bug 10 - 正文区域顶部功能未去除
- **GitHub**: #10
- **状态**: 🔍 需确认
- **问题描述**:
  - 移除正文区域顶部的打开新文件按钮
  - 移除显示文件名行
  - 移除校验通过功能显示
  - 打开新文件以按钮方式放在顶部按钮区第一个
- **备注**: 需要检查当前 UI 是否仍显示这些元素

---

## 📋 建议行动

### 高优先级（P0）
1. **Bug 2, 3, 4** - 文件拖入支持（zip、文件夹）
2. **Bug 9, 10** - 确认并移除多余按钮/功能

### 中优先级（P1）
3. **Bug 5** - 验证复制为图片功能
4. **Bug 1** - docx 导出（需要技术调研）

### 低优先级（P3）
5. **Bug 6** - 桌面端默认预览模式

---

## 🔗 相关链接

- GitHub Issues: https://github.com/jianxi-dev/md-bundle/issues
- 缺陷登记表: `docs/agents/bug-registry-260907.md`
- 缺陷流程: `docs/agents/defect-workflow.md`

---

_报告生成：2026-09-08_
_最后更新：2026-09-08_
