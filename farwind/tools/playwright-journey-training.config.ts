import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '../tests', testMatch: 'journey-training.spec.ts', workers: 1, retries: 0,
  timeout: 480000, outputDir: '../.journey-training-local/browser', reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5252', viewport: { width: 1280, height: 720 },
    actionTimeout: 12000, screenshot: 'only-on-failure', trace: 'retain-on-failure',
    launchOptions: { args: ['--enable-webgl', '--use-angle=metal'] },
  },
  webServer: {
    cwd: process.cwd(),
    command: 'npx vite preview --outDir .journey-training-local/production --host 127.0.0.1 --port 5252 --strictPort',
    url: 'http://127.0.0.1:5252', reuseExistingServer: false,
  },
});
