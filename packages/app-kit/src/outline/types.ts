/**
 * 大纲组件消费的编辑模式。与 web 的 EditorMode（'edit' | 'source' | 'preview'）结构一致；
 * app-kit 不能反向依赖 apps/web 的组件模块，故此处按值集合声明一次。
 */
export type OutlineMode = 'edit' | 'source' | 'preview';
