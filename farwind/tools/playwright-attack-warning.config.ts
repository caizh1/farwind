import {defineConfig} from '@playwright/test';
const production=process.env.ATTACK_WARNING_PRODUCTION==='1',port=production?5297:5296,url=`http://127.0.0.1:${port}`;
export default defineConfig({testDir:'../tests',testMatch:production?'attack-warning.production.ts':'attack-warning.spec.ts',workers:1,retries:0,timeout:90000,
  use:{baseURL:url,viewport:{width:1280,height:720},deviceScaleFactor:1,trace:'retain-on-failure',screenshot:'only-on-failure',launchOptions:{args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']}},
  webServer:{command:production?`npm run preview -- --port ${port} --strictPort --outDir .attack-warning-local/production`:`npm run dev -- --port ${port} --strictPort`,url,reuseExistingServer:!production,cwd:process.cwd()},outputDir:production?'../.attack-warning-local/production-results':'../.attack-warning-local/test-results',reporter:[['list']]});
