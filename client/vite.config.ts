import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  server: {
    // Listen on the LAN so the dev server can be opened from a phone, which is
    // the target form factor and cannot be judged in a desktop browser.
    host: true,
    allowedHosts: ['steamdeck', 'steamdeck.local', 'moode', 'moode.local'],
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    globals: false,
    testTimeout: 10_000,
    hookTimeout: 10_000,
    setupFiles: ['./vitest.setup.ts'],
  },
});
