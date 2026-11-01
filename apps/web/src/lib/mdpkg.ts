// 打开路径已迁入 @md-bundle/app-kit（#508）。此处保留同名出口，避免一次性改动
// 所有调用点；真正的接线在 #512。
export {
  MdeError,
  openPackage,
  readEntrySource,
} from '@md-bundle/app-kit/mdpkg';
export type {
  Manifest,
  OpenOptions,
  OpenResult,
  OpenPackageResult,
  ValidationResult,
} from '@md-bundle/app-kit/mdpkg';
