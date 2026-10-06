// 编辑/预览正文字号与行高**同源**一致性（#383）
//
// 根因（已核实，非推测）：
//   - 预览侧 `packages/renderer/src/readerCss.ts` 声明 `--type-font-size: 17px`
//     并以 `font-size: var(--type-font-size)` 消费 → 真正绑定 token。
//   - 编辑侧 `packages/editor/src/decorations/theme.ts` 同样桥接了
//     `--type-font-size`，但 `editorContentScope` 的 `.cm-content` 规则**根本没赢**：
//     它与 `packages/editor/src/editor.ts` 的 `createTheme()` 一样，都是 CM6 生成的
//     `.ͼN .cm-content`（特异性 0,2,0），而 theme compartment 是**后**追加的
//     → 同特异性的后到者胜。所以字号实际来自 `editor.ts` 的硬编码字面量
//     `fontSize: '17px'`；`editorContentScope` 里并列的 fontFamily / color /
//     lineHeight 同理失效（证据：编辑态 line-height 28.9px = 17×1.7 走的是
//     `editor.ts` 的 '1.7'，而非 token 的 1.78）。
//   - 因此修复必须落在注入的 `[data-theme] .cm-editor .cm-content`（特异性 0,3,0），
//     靠**特异性**取胜；而不是塞进 editorContentScope——塞进去是空操作（已实测）。
//
// 分两条独立红线锁住 #383：
//   1) 行高**相等**——今天唯一真实可复现的差异就是行高：编辑态 28.9px
//      （= 17×1.7，`editor.ts` 硬编码）vs 预览态 30.26px（= 17×1.78，走 token）。
//      故直接断言两侧计算行高相等；修复前必然红。
//   2) 字号**耦合**——把 `--type-font-size` 改成非基线值后，两侧计算字号都必须跟随。
//      断言不能是「两侧都等于 17px」——那是拿硬编码比硬编码，恒真且无法红
//      （第一版就这么写，带着 bug 也 2 passed）。同理对 `--type-line` 也做一次
//      探针，证明编辑态消费的是 token 而非 `editor.ts` 的字面量。
//
// 手法：把自定义属性以**行内样式**写在容器上（行内优先级高于任何选择器规则），
// 再读 getComputedStyle。改 token 而计算值不动 = 未同源 = 红。
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(here, 'fixtures');
const RESULTS = join(here, '..', 'test-results');
const ARTIFACTS = join(here, '..', '.artifacts', '383');

/** 当前基线字号（`--type-font-size` 现值），仅作证据记录，不作红绿分界。 */
const BASELINE_FONT_SIZE = '17px';
/** 探针值：必须显著区别于基线，避免「恰好相同」造成的假绿。 */
const PROBE_FONT_SIZE = '23px';
/** `--type-line` 探针值：区别于基线 1.78，用于证明编辑态消费的是行高 token。 */
const PROBE_LINE = '2.4';
/** 双探针同时生效后的期望计算行高 = 探针字号 × 探针行高 = 23 × 2.4 = 55.2px。
 *  必须先四舍五入到两位小数：JS 里 23 × 2.4 的浮点结果是 55.199999999999996，
 *  而浏览器给出的计算值是 "55.2px"，两者做字符串全等比对会假红。 */
const PROBED_LINE_HEIGHT_PX =
  Math.round(Number.parseFloat(PROBE_FONT_SIZE) * Number.parseFloat(PROBE_LINE) * 100) / 100;

interface Measurement {
  container: string;
  text: string;
  lineHeight: string;
}

interface ThemeEvidence {
  editBaseline: Measurement;
  editProbed: Measurement;
  previewBaseline: Measurement;
  previewProbed: Measurement;
}

const evidence: Record<'light' | 'dark', ThemeEvidence> = {
  light: {
    editBaseline: { container: '', text: '', lineHeight: '' },
    editProbed: { container: '', text: '', lineHeight: '' },
    previewBaseline: { container: '', text: '', lineHeight: '' },
    previewProbed: { container: '', text: '', lineHeight: '' },
  },
  dark: {
    editBaseline: { container: '', text: '', lineHeight: '' },
    editProbed: { container: '', text: '', lineHeight: '' },
    previewBaseline: { container: '', text: '', lineHeight: '' },
    previewProbed: { container: '', text: '', lineHeight: '' },
  },
};

test.use({ viewport: { width: 1280, height: 800 } });
test.describe.configure({ mode: 'serial' });

function ensureArtifactsDir(): void {
  if (!existsSync(ARTIFACTS)) mkdirSync(ARTIFACTS, { recursive: true });
}

// 主题是三态循环（system → dark → light），点到达目标为止，不假设一次到位。
async function ensureTheme(page: Page, target: 'light' | 'dark'): Promise<void> {
  for (let i = 0; i < 5; i++) {
    const current = await page.evaluate(() => document.documentElement.dataset.theme);
    if (current === target) return;
    await page.getByTestId('theme-btn').click();
    await page.waitForTimeout(100);
  }
  const actual = await page.evaluate(() => document.documentElement.dataset.theme);
  throw new Error(`无法切换到 ${target} 主题：5 次点击后仍为 ${String(actual)}`);
}

async function openFixture(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByTestId('file-input').setInputFiles(join(FIXTURES, 'hello.md'));
  await page.getByTestId('mode-edit-btn').click();
  await expect(page.locator('.cm-editor').first()).toBeVisible();
  await expect(page.locator('.cm-content').first()).toBeVisible();
}

/**
 * 计算行高带 `px` 后缀（"55.2px"），去掉单位后按浮点近似比较，
 * 以吸收浏览器可能给出的亚像素舍入（1/64px 布局单位）。
 */
function parsePx(value: string): number {
  return Number.parseFloat(value);
}

/**
 * 以行内样式改写容器上的排版 token（`--type-font-size` / `--type-line`）。
 * 行内声明优先于 `[data-theme] .cm-editor .cm-content` 这类高特异性规则，
 * 因此覆盖一定生效；若改完计算值纹丝不动，说明该属性压根没消费这个
 * token（而是 `editor.ts` 的硬编码字面量）。
 */
async function probeToken(
  page: Page,
  container: string,
  property: string,
  value: string,
): Promise<void> {
  await page
    .locator(container)
    .first()
    .evaluate(
      (node, payload) => {
        if (!(node instanceof HTMLElement)) throw new Error('容器不是 HTMLElement，无法写行内样式');
        node.style.setProperty(payload.property, payload.value);
      },
      { property, value },
    );
}

async function measureEdit(page: Page): Promise<Measurement> {
  return page.evaluate(() => {
    const container = document.querySelector('.cm-content');
    // CM6 把每行渲染为 `.cm-line` div，不存在真实 p/li，故正文取首行。
    const text = document.querySelector('.cm-line');
    if (!(container instanceof HTMLElement) || !(text instanceof HTMLElement)) {
      throw new Error('编辑态 DOM 未就绪（.cm-content / .cm-line 缺失）');
    }
    return {
      container: getComputedStyle(container).fontSize,
      text: getComputedStyle(text).fontSize,
      lineHeight: getComputedStyle(container).lineHeight,
    };
  });
}

async function measurePreview(page: Page): Promise<Measurement> {
  return page.evaluate(() => {
    const container = document.querySelector('.preview-content');
    const text = document.querySelector('.preview-content p');
    if (!(container instanceof HTMLElement) || !(text instanceof HTMLElement)) {
      throw new Error('预览态 DOM 未就绪（.preview-content / p 缺失）');
    }
    return {
      container: getComputedStyle(container).fontSize,
      text: getComputedStyle(text).fontSize,
      lineHeight: getComputedStyle(container).lineHeight,
    };
  });
}

test.describe('编辑/预览正文字号与行高同源一致性（#383）', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`${theme} 主题：改写 --type-font-size / --type-line 后编辑态与预览态同步跟随`, async ({ page }) => {
      await openFixture(page);
      await ensureTheme(page, theme);

      // —— 编辑态：基线 → 改 token → 再测 ——
      const editBaseline = await measureEdit(page);
      await probeToken(page, '.cm-content', '--type-font-size', PROBE_FONT_SIZE);
      await probeToken(page, '.cm-content', '--type-line', PROBE_LINE);
      const editProbed = await measureEdit(page);

      ensureArtifactsDir();
      await page
        .locator('.cm-editor')
        .first()
        .screenshot({ path: join(ARTIFACTS, `edit-${theme}.png`) });

      // —— 预览态：基线 → 改 token → 再测 ——
      await page.getByTestId('mode-preview-btn').click();
      await expect(page.locator('.preview-content').first()).toBeVisible();

      const previewBaseline = await measurePreview(page);
      await probeToken(page, '.preview-content', '--type-font-size', PROBE_FONT_SIZE);
      await probeToken(page, '.preview-content', '--type-line', PROBE_LINE);
      const previewProbed = await measurePreview(page);

      await page
        .locator('.preview-content')
        .first()
        .screenshot({ path: join(ARTIFACTS, `preview-${theme}.png`) });

      evidence[theme] = { editBaseline, editProbed, previewBaseline, previewProbed };

      // 基线一致性：今天两侧确实都是 17px（记录用，说明「视觉无差异」不能当验收）。
      expect(editBaseline.container, '编辑态基线字号').toBe(BASELINE_FONT_SIZE);
      expect(previewBaseline.container, '预览态基线字号').toBe(BASELINE_FONT_SIZE);

      // 红线 1：基线行高两侧必须相等。
      // 修复前编辑态 28.9px（17×1.7，`editor.ts` 硬编码）≠ 预览态 30.26px（17×1.78，
      // 走 token）→ 此断言失败。这是 #383 今天唯一真实可复现的视觉差异。
      expect(editBaseline.lineHeight, '编辑态基线行高与预览态不一致（未消费 --type-line）').toBe(
        previewBaseline.lineHeight,
      );

      // 红绿分界：字号必须消费 token，跟随探针值。
      // 修复前编辑态是 `editor.ts` 的硬编码 '17px'，改 token 无效 → 此断言失败。
      expect(editProbed.container, '编辑态容器字号未跟随 --type-font-size（未同源）').toBe(
        PROBE_FONT_SIZE,
      );
      expect(editProbed.text, '编辑态正文字号未跟随 --type-font-size（未同源）').toBe(
        PROBE_FONT_SIZE,
      );
      expect(previewProbed.container, '预览态容器字号未跟随 --type-font-size').toBe(
        PROBE_FONT_SIZE,
      );
      expect(previewProbed.text, '预览态正文字号未跟随 --type-font-size').toBe(PROBE_FONT_SIZE);

      // 红线 2：行高也必须消费 token。探针下两侧计算行高都应是 23 × 2.4 = 55.2px。
      // 修复前编辑态是 `editor.ts` 的硬编码 '1.7'，改 token 无效 → 编辑态停在 39.1px。
      expect(parsePx(editProbed.lineHeight), '编辑态行高未跟随 --type-line（未同源）').toBeCloseTo(
        PROBED_LINE_HEIGHT_PX,
        2,
      );
      expect(parsePx(previewProbed.lineHeight), '预览态行高未跟随 --type-line').toBeCloseTo(
        PROBED_LINE_HEIGHT_PX,
        2,
      );
    });
  }
});

test.afterAll(() => {
  if (!existsSync(RESULTS)) mkdirSync(RESULTS, { recursive: true });
  writeFileSync(
    join(RESULTS, 'editor-font-size-fidelity.json'),
    `${JSON.stringify(
      {
        baselineFontSize: BASELINE_FONT_SIZE,
        probeFontSize: PROBE_FONT_SIZE,
        probeLine: PROBE_LINE,
        probedLineHeight: `${PROBED_LINE_HEIGHT_PX}px`,
        ...evidence,
      },
      null,
      2,
    )}\n`,
  );
});