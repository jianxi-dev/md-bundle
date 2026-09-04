# 部署指南（Vercel）

目标：把 `apps/web` 构建产物部署到 Vercel，绑定域名 `bundle.jianxi.me`。

## 前置条件

- Node ≥ 22 + pnpm（仓库根 `packageManager: pnpm@10.32.1`）
- Vercel CLI：`npm i -g vercel`（或 `pnpm dlx vercel`）
- 一个 Vercel 账号（org：jianxi-dev）

## 一次性准备

1. 登录：

   ```bash
   vercel login
   ```

2. 关联项目（在仓库根目录执行）：

   ```bash
   vercel link --yes
   ```

   选择 jianxi-dev org，项目名 `md-bundle`（首次会创建）。

3. 首次部署：

   ```bash
   vercel --prod
   ```

   构建命令与输出目录由仓库根 `vercel.json` 指定：

   - framework: `vite`
   - buildCommand: `pnpm --filter @md-bundle/web build`
   - outputDirectory: `apps/web/dist`
   - rewrites: `/spec → /spec.html`、`/about → /about.html`

   Vite MPA 的干净 URL（`/spec`、`/about`）在 dev / `vite preview` 下可用，但
   Vercel 静态托管只按字面路径服务，必须显式 rewrite 到 `.html` 文件。
   `/examples/*` 是静态直通，无需 rewrite。

   首次部署会得到一个 `md-bundle-xxx.vercel.app` 地址。

## 绑定域名 bundle.jianxi.me

方式 A（Dashboard）：

1. Vercel Dashboard → 项目 `md-bundle` → Settings → Domains
2. Add → 输入 `bundle.jianxi.me`
3. 按 Vercel 提示配置 DNS（A 记录 / NS 委托，按提示操作）
4. DNS 生效后重新部署：`vercel --prod`

方式 B（CLI）：

```bash
vercel domains add bundle.jianxi.me
vercel domains inspect bundle.jianxi.me
```

## 验证

本地冒烟（无需部署，证明冒烟本身可用）：

```bash
pnpm --filter @md-bundle/web build
npx vite preview --port 4174   # 另开终端；4174 避开 playwright webServer 的 4173
TARGET_URL=http://localhost:4174 pnpm --filter @md-bundle/web test:e2e --grep=production
```

生产冒烟（部署 + 域名绑定后）：

```bash
TARGET_URL=https://bundle.jianxi.me pnpm --filter @md-bundle/web test:e2e --grep=production
```

冒烟断言（`apps/web/test/smoke-prod.spec.ts`）：

- `/`、`/spec`、`/about` 均返回 200，正文含关键词（分享不再裂图 / 格式规范 / 关于）
- 首页 gallery 点击官方示例 → mdpkg iframe 渲染 + 校验通过 + 无 pageerror

## 回滚

Vercel Dashboard → 项目 → Deployments → 选择上一个成功的部署 → ⋯ → Promote to Production。

## 备注

- 凭证阻塞：本机无 vercel CLI 登录态，实际部署与域名绑定需用户执行上述命令。
- 证据：`apps/web/test-results/smoke-prod-local.json`（本地 preview 冒烟事实；
  生产目标待部署后运行）。