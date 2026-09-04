// 生产冒烟（任务 7.1）：TARGET_URL 指向任意部署（本地 preview / Vercel 生产），
// 断言 3 页 200 + 正文关键词 + 工具可打开示例包。
// 本地验证：build → vite preview --port 4174 → TARGET_URL=http://localhost:4174 test:e2e --grep production
// 生产验证：TARGET_URL=https://bundle.jianxi.me pnpm --filter @md-bundle/web test:e2e --grep=production
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const RES = join(here, '..', 'test-results');

// 显式置空 baseURL：本 spec 全部使用绝对 URL，任何相对 URL 都会立即报错，
// 而不是静默打到 playwright.config 里的 4173（避免 TARGET_URL 指向生产时误伤）。
test.use({ baseURL: undefined });

// TARGET_URL 未设置时回退本地 dev server（4173，playwright webServer 提供）。
const base = (process.env.TARGET_URL ?? 'http://localhost:4173').replace(/\/+$/, '');

test.describe('production smoke', () => {
  // 串行：证据聚合依赖前序测试结果（同 home.spec.ts 模式）。
  test.describe.configure({ mode: 'serial' });

  const facts = {
    tasks: '7.1',
    target: base,
    three200: false,
    specBody: false,
    aboutBody: false,
    exampleOpens: false,
    // 凭证阻塞：本机无 vercel CLI 登录态，生产目标（bundle.jianxi.me）未运行。
    productionTargetsNotRun: true,
  };

  test('pages: / /spec /about return 200 with body keywords', async ({ page }) => {
    const pages = [
      // index 是 React SPA 壳：正文关键词取 meta description / JSON-LD 里的
      // 「分享不再裂图」（原始 HTML 可爬，无需 JS）——与 seo-crawl.spec.ts 一致。
      { path: '/', keyword: '分享不再裂图' },
      { path: '/spec', keyword: '格式规范' },
      { path: '/about', keyword: '关于' },
    ] as const;

    for (const p of pages) {
      const url = `${base}${p.path}`;
      const resp = await page.goto(url);
      expect(resp?.status(), `${url} 导航应返回 200`).toBe(200);
      // 独立请求通道再验一次（page.request 不走页面导航，双通道防误判）
      const req = await page.request.get(url);
      expect(req.status(), `${url} request 应返回 200`).toBe(200);
      const html = await page.content();
      expect(html, `${url} 正文应包含关键词「${p.keyword}」`).toContain(p.keyword);
    }
    facts.three200 = true;
    facts.specBody = true;
    facts.aboutBody = true;
  });

  test('example: gallery opens mdpkg example package', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));

    await page.goto(`${base}/`);
    await expect(page.getByTestId('gallery')).toBeVisible();
    // gallery 内 fetch 用相对 URL（/examples/mdpkg-demo.mdpkg）——与页面同源，
    // 生产环境原样可用，无需 rewrite。
    await page.getByTestId('example-mdpkg-demo').click();
    await expect(page.getByTestId('mdpkg-frame')).toBeVisible();
    await expect(page.getByTestId('validation-pass')).toBeVisible();
    expect(pageErrors).toEqual([]);

    await page.screenshot({ path: join(RES, 'smoke-prod.png'), fullPage: true });
    facts.exampleOpens = true;
  });

  test.afterAll(() => {
    mkdirSync(RES, { recursive: true });
    writeFileSync(join(RES, 'smoke-prod-local.json'), JSON.stringify(facts, null, 2));
  });
});