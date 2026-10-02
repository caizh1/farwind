import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '../tests', testMatch: 'wind-boots.spec.ts', workers: 1, retries: 0, timeout: 360000,
  outputDir: '../.wind-boots-local/browser', reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5251', viewport: { width: 1280, height: 720 },
    actionTimeout: 12000, screenshot: 'only-on-failure', trace: 'retain-on-failure',
    launchOptions: { args: ['--enable-webgl', '--use-angle=metal'] },
  },
  webServer: {
    cwd: process.cwd(), command: 'npx vite preview --outDir .wind-boots-local/production --host 127.0.0.1 --port 5251 --strictPort',
    url: 'http://127.0.0.1:5251', reuseExistingServer: false,
  },
});
