import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('..', import.meta.url));
const DIST = join(HERE, 'dist');
const OUT = join(HERE, 'test-results');
mkdirSync(OUT, { recursive: true });

const ENTRY_GZIP_BUDGET = 300 * 1024;

const entryChunks = [];
const asyncChunks = [];
const allChunks = [];

for (const f of readdirSync(join(DIST, 'assets'))) {
  if (!f.endsWith('.js')) continue;
  const full = join(DIST, 'assets', f);
  const raw = readFileSync(full);
  const gz = gzipSync(raw, { level: 9 }).length;
  const info = { file: f, rawBytes: raw.length, gzipBytes: gz };
  allChunks.push(info);
  if (f.startsWith('index-')) entryChunks.push(info);
  else asyncChunks.push(info);
}

const isMdpkgVendor = (f) => f.includes('mdpkg-web') || f.includes('vendor-mdpkg');
const mdpkgChunks = allChunks.filter((c) => isMdpkgVendor(c.file));
const entryInEntry = entryChunks.filter((c) => isMdpkgVendor(c.file));

const hasKatex = asyncChunks.some((c) => c.file.toLowerCase().includes('katex'));
const hasMermaid = asyncChunks.some((c) => c.file.toLowerCase().includes('mermaid'));

const mainEntry = entryChunks.reduce(
  (best, c) => (c.gzipBytes > best.gzipBytes ? c : best),
  { file: '', rawBytes: 0, gzipBytes: 0 },
);

const withinBudget = mainEntry.gzipBytes <= ENTRY_GZIP_BUDGET;

const report = {
  budget: { entryGzipMax: ENTRY_GZIP_BUDGET },
  entry: {
    file: mainEntry.file,
    rawBytes: mainEntry.rawBytes,
    gzipBytes: mainEntry.gzipBytes,
    withinBudget,
  },
  mdpkgVendor: {
    separateChunks: mdpkgChunks.map((c) => c.file),
    inEntryBundle: entryInEntry.map((c) => c.file),
    isAsync: entryInEntry.length === 0 && mdpkgChunks.length > 0,
  },
  asyncChunks: {
    katexPresent: hasKatex,
    mermaidPresent: hasMermaid,
    totalCount: asyncChunks.length,
  },
  allChunks: allChunks.map((c) => ({ file: c.file, gzipKB: +(c.gzipBytes / 1024).toFixed(1) })),
  verdict: 'PASS',
};

if (!withinBudget) {
  report.verdict = 'FAIL';
  console.error(
    `ENTRY BUDGET EXCEEDED: ${mainEntry.file} gzip ${(mainEntry.gzipBytes / 1024).toFixed(1)}KB > ${(ENTRY_GZIP_BUDGET / 1024).toFixed(0)}KB`,
  );
}
if (entryInEntry.length > 0) {
  report.verdict = 'FAIL';
  console.error(
    `VENDOR LEAK: mdpkg-web found in entry bundle chunks: ${entryInEntry.map((c) => c.file).join(', ')}`,
  );
}
if (!hasKatex) {
  report.verdict = 'FAIL';
  console.error('MISSING: katex async chunk not found');
}
if (!hasMermaid) {
  report.verdict = 'FAIL';
  console.error('MISSING: mermaid async chunk not found');
}

const outPath = join(OUT, 'bundle-budget.json');
writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));

if (report.verdict === 'FAIL') {
  process.exit(1);
}
