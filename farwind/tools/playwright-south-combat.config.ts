import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'../tests',testMatch:'south-combat.spec.ts',workers:1,retries:0,timeout:900000,
 use:{baseURL:'http://127.0.0.1:5815',headless:false,viewport:{width:1280,height:720},deviceScaleFactor:1,actionTimeout:15000,video:'on',trace:'retain-on-failure',screenshot:'only-on-failure',launchOptions:{args:['--enable-gpu','--use-gl=angle','--use-angle=metal']}},
 webServer:{command:'npx vite preview --host 127.0.0.1 --port 5815 --strictPort --outDir .combat-expansion-local/production',url:'http://127.0.0.1:5815',reuseExistingServer:false,cwd:process.cwd()},outputDir:'../.combat-expansion-local/results',reporter:[['list']]});
