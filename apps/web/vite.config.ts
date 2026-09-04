import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Multi-page Vite site (index/spec/about land later) — no SPA router.
export default defineConfig({
  plugins: [react(), tailwindcss()],
});