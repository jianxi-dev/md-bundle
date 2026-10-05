import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const FIX = join(here, 'fixtures');
const RES = join(here, '..', 'test-results');
const ART = join(here, '..', '.artifacts', '364');

const evidence = {
  editLightBg: '',
  previewLightBg: '',
  editDarkBg: '',
  previewDarkBg: '',
  lightMatch: false,
  darkMatch: false,
};

test.use({ viewport: { width: 1280, height: 800 } });
test.describe.configure({ mode: 'serial' });

async function getBgColor(page: any, selector: string): Promise<string> {
  return await page.locator(selector).first().evaluate((el: HTMLElement) => {
    return getComputedStyle(el).backgroundColor;
  });
}

async function ensureArtifactsDir(): Promise<void> {
  if (!existsSync(ART)) {
    mkdirSync(ART, { recursive: true });
  }
}

async function ensureTheme(page: any, target: 'light' | 'dark'): Promise<void> {
  for (let i = 0; i < 5; i++) {
    const current = await page.evaluate(() => document.documentElement.dataset.theme);
    if (current === target) return;
    await page.getByTestId('theme-btn').click();
    await page.waitForTimeout(100);
  }
  throw new Error(`Failed to switch to ${target} theme after 5 clicks`);
}

test('编辑模式与预览模式背景色一致 — light 主题', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(join(FIX, 'hello.md'));
  await page.getByTestId('mode-edit-btn').click();
  await expect(page.locator('.cm-editor').first()).toBeVisible();

  await ensureTheme(page, 'light');

  const editBg = await getBgColor(page, '.cm-editor');

  await ensureArtifactsDir();
  await page.locator('.cm-editor').first().screenshot({ path: join(ART, 'edit-light.png') });

  await page.getByTestId('mode-preview-btn').click();
  await expect(page.locator('.preview-content').first()).toBeVisible();
  const previewBg = await getBgColor(page, '.preview-content');

  await page.locator('.preview-content').first().screenshot({ path: join(ART, 'preview-light.png') });

  evidence.editLightBg = editBg;
  evidence.previewLightBg = previewBg;
  evidence.lightMatch = editBg === previewBg;

  await expect(editBg).toBe(previewBg);
});

test('编辑模式与预览模式背景色一致 — dark 主题', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(join(FIX, 'hello.md'));
  await page.getByTestId('mode-edit-btn').click();
  await expect(page.locator('.cm-editor').first()).toBeVisible();

  await ensureTheme(page, 'dark');

  const editBg = await getBgColor(page, '.cm-editor');

  await ensureArtifactsDir();
  await page.locator('.cm-editor').first().screenshot({ path: join(ART, 'edit-dark.png') });

  await page.getByTestId('mode-preview-btn').click();
  await expect(page.locator('.preview-content').first()).toBeVisible();
  const previewBg = await getBgColor(page, '.preview-content');

  await page.locator('.preview-content').first().screenshot({ path: join(ART, 'preview-dark.png') });

  evidence.editDarkBg = editBg;
  evidence.previewDarkBg = previewBg;
  evidence.darkMatch = editBg === previewBg;

  await expect(editBg).toBe(previewBg);
});

test.afterAll(() => {
  writeFileSync(join(RES, 'edit-preview-bg-fidelity2.json'), JSON.stringify(evidence, null, 2) + '\n');
});
