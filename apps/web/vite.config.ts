import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const root = fileURLToPath(new URL('.', import.meta.url));

// Multi-page Vite site — index (SPA app) + spec/about (pure static HTML, zero JS).
// appType 'mpa': dev serves /spec → spec.html and /about → about.html (clean URLs,
// no SPA fallback); build emits three real static entries.
// NOTE (deploy): Vercel needs rewrites /spec → /spec.html, /about → /about.html
// (vercel.json — lands with T20/T26).
export default defineConfig({
  appType: 'mpa',
  // Relative base: dist assets become ./assets/... so the build works at ANY
  // prefix — GitHub Pages project page (/md-bundle/), domain root
  // (bundle.jianxi.me), or Vercel. Nav uses filename links (index.html /
  // spec.html / about.html) which resolve relative to the current page.
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        index: resolve(root, 'index.html'),
        spec: resolve(root, 'spec.html'),
        about: resolve(root, 'about.html'),
        hello: resolve(root, 'examples/hello.html'),
        guide: resolve(root, 'examples/guide.html'),
        'mdpkg-demo': resolve(root, 'examples/mdpkg-demo.html'),
      },
    },
    // Vendored mdpkg bundle makes the js chunk big — pre-existing warning noise.
    chunkSizeWarningLimit: 1100,
  },
});