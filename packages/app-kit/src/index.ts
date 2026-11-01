/**
 * `@md-bundle/app-kit` — application-layer capabilities shared by the web app
 * and the Clairis desktop client.
 *
 * Public surface is the barrel below; implementation modules arrive with
 * #508 (mdpkg), #509 (export), #510 (outline) and #511 (clipboard). Until then
 * this package exports contracts only, so nothing imports a stub.
 */
export type {
  ClipboardWriter,
  ExportFormat,
  FilePayload,
  OpenPackageResult,
  OutlineHeading,
  OutlineNavigator,
  SaveFile,
} from './contracts';
