import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'../tests',testMatch:'camp-bosses.spec.ts',workers:1,retries:0,timeout:600000,
 use:{baseURL:'http://127.0.0.1:5814',headless:false,viewport:{width:1280,height:720},deviceScaleFactor:1,actionTimeout:15000,video:'on',trace:'retain-on-failure',screenshot:'only-on-failure',launchOptions:{args:['--enable-gpu','--use-gl=angle','--use-angle=metal']}},
 webServer:{command:'npx vite preview --host 127.0.0.1 --port 5814 --strictPort --outDir .camp-boss-local/production',url:'http://127.0.0.1:5814',reuseExistingServer:false,cwd:process.cwd()},outputDir:'../.camp-boss-local/results',reporter:[['list']]});
