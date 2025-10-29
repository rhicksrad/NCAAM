import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

const pages = [
  'index',
  'teams',
  'players',
  'games',
  'rankings',
  'standings',
  'team',
  'player',
  'diag'
];

export default defineConfig({
  base: process.env.VITE_BASE || '/',
  build: {
    outDir: 'dist',
    sourcemap: true,
    emptyOutDir: true,
    rollupOptions: {
      input: Object.fromEntries(
        pages.map(page => [page, resolve(rootDir, `${page}.html`)])
      )
    }
  }
});
