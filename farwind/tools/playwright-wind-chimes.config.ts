import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'../tests',testMatch:'wind-chimes.spec.ts',workers:1,retries:0,timeout:90000,
  outputDir:'../.wind-chimes-local/browser-results',reporter:[['list']],
  use:{baseURL:'http://127.0.0.1:5224',viewport:{width:1280,height:720},trace:'retain-on-failure',screenshot:'only-on-failure',video:'on',launchOptions:{args:['--enable-webgl','--use-angle=metal']}},
  webServer:{cwd:process.cwd(),command:'npx vite preview --outDir .wind-chimes-local/production --host 127.0.0.1 --port 5224 --strictPort',url:'http://127.0.0.1:5224',reuseExistingServer:false},
});
