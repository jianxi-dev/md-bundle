// SEO 静态资产断言（任务 5.3）—— node 环境，纯 fs 读取：
//   robots.txt / sitemap.xml / og-banner.png（parsePngSize 复用）/ 三个 HTML 的 head meta。
// 领域约定：所有 URL 一律 bundle.jianxi.me 绝对地址，禁止 localhost / 相对路径。
// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parsePngSize } from '../src/lib/pngMeta';

const here = new URL('.', import.meta.url);
const read = (rel: string) => readFileSync(new URL(rel, here), 'utf8');
const readBytes = (rel: string) => new Uint8Array(readFileSync(new URL(rel, here)));

const DOMAIN = 'https://bundle.jianxi.me';
const OG_IMAGE = `${DOMAIN}/og-banner.png`;

describe('robots.txt', () => {
  const robots = read('../public/robots.txt');

  it('allows all crawlers', () => {
    expect(robots).toContain('User-agent: *');
    expect(robots).toContain('Allow: /');
  });

  it('points to the absolute sitemap URL', () => {
    expect(robots).toContain(`Sitemap: ${DOMAIN}/sitemap.xml`);
  });

  it('contains no localhost / relative URLs', () => {
    expect(robots).not.toMatch(/localhost|127\.0\.0\.1/);
    expect(robots).not.toMatch(/Sitemap: \//);
  });
});

describe('sitemap.xml', () => {
  const sitemap = read('../public/sitemap.xml');

  it('lists exactly the 3 site URLs with absolute domain', () => {
    for (const url of [`${DOMAIN}/`, `${DOMAIN}/spec`, `${DOMAIN}/about`]) {
      expect(sitemap).toContain(`<loc>${url}</loc>`);
    }
    expect(sitemap).not.toMatch(/localhost|127\.0\.0\.1/);
    expect(sitemap).not.toMatch(/<loc>\//);
  });

  it('has lastmod + changefreq + priority per URL, index priority 1.0', () => {
    const urlBlocks = sitemap.split('<url>').slice(1);
    expect(urlBlocks).toHaveLength(3);
    for (const block of urlBlocks) {
      expect(block).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
      expect(block).toMatch(/<changefreq>/);
      expect(block).toMatch(/<priority>/);
    }
    expect(urlBlocks[0]).toContain('<priority>1.0</priority>');
    expect(urlBlocks[1]).toContain('<priority>0.5</priority>');
    expect(urlBlocks[2]).toContain('<priority>0.5</priority>');
  });
});

describe('og-banner.png', () => {
  it('is a PNG of exactly 1200x630', () => {
    const size = parsePngSize(readBytes('../public/og-banner.png'));
    expect(size).toEqual({ width: 1200, height: 630 });
  });
});

describe('page heads', () => {
  const pages = [
    { file: '../index.html', url: `${DOMAIN}/` },
    { file: '../spec.html', url: `${DOMAIN}/spec` },
    { file: '../about.html', url: `${DOMAIN}/about` },
  ] as const;

  for (const { file, url } of pages) {
    const html = read(file);
    describe(file, () => {
      it('has canonical + full OG set + meta description', () => {
        expect(html).toContain(`<link rel="canonical" href="${url}" />`);
        expect(html).toContain('property="og:title"');
        expect(html).toContain('property="og:description"');
        expect(html).toContain(`property="og:url" content="${url}"`);
        expect(html).toContain(`property="og:image" content="${OG_IMAGE}"`);
        expect(html).toContain('property="og:type" content="website"');
        expect(html).toMatch(/<meta\s+name="description"\s+content="[^"]+"/);
      });

      it('uses absolute domain URLs only in head meta (no localhost / relative)', () => {
        const head = html.slice(0, html.indexOf('</head>'));
        expect(head).not.toMatch(/localhost|127\.0\.0\.1/);
        expect(head).not.toMatch(/href="\//);
        expect(head).not.toMatch(/content="\//);
      });

      it('meta description is Chinese and ≤ 120 chars', () => {
        const m = html.match(/<meta\s+name="description"\s+content="([^"]+)"/);
        expect(m).not.toBeNull();
        expect(m![1].length).toBeLessThanOrEqual(120);
        expect(m![1]).toMatch(/[\u4e00-\u9fff]/);
      });
    });
  }
});

describe('index.html JSON-LD', () => {
  const html = read('../index.html');

  it('embeds SoftwareApplication structured data', () => {
    expect(html).toContain('<script type="application/ld+json">');
    expect(html).toContain('"@type": "SoftwareApplication"');
    expect(html).toContain('"name": "MD-Bundle"');
    expect(html).toContain(`"url": "${DOMAIN}"`);
    expect(html).toContain('"applicationCategory": "WebApplication"');
    expect(html).toContain('"operatingSystem": "Any"');
    expect(html).toContain('"author"');
    expect(html).toContain('"license": "https://opensource.org/licenses/MIT"');
    expect(html).toContain('"offers"');
    expect(html).toContain('"price": "0"');
    expect(html).toContain('"priceCurrency": "USD"');
  });
});