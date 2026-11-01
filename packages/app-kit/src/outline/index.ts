/**
 * `@md-bundle/app-kit/outline` — 目录大纲公共入口（#510）。
 * web 侧 lib/outline.ts 与 components/OutlineMenu.tsx 退化为 re-export 垫片。
 */
export type { OutlineHeading, OutlineNavigator } from '../contracts';
export { extractHeadings } from './headings';
export type { OutlineMode } from './types';
export { OutlineMenu } from './OutlineMenu';
export type { OutlineMenuProps } from './OutlineMenu';
