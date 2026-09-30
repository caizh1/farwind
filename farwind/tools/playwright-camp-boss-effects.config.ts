import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'../tests',testMatch:'camp-boss-effects.spec.ts',workers:1,retries:0,timeout:360000,
 use:{baseURL:'http://127.0.0.1:5817',headless:false,viewport:{width:1000,height:628},deviceScaleFactor:1,actionTimeout:15000,video:'on',trace:{mode:'retain-on-failure',screenshots:false,snapshots:true,sources:true},screenshot:'only-on-failure',launchOptions:{args:['--enable-gpu','--use-gl=angle','--use-angle=metal']}},
 webServer:{command:'npx vite preview --host 127.0.0.1 --port 5817 --strictPort --outDir .camp-boss-local/vfx-production',url:'http://127.0.0.1:5817',reuseExistingServer:false,cwd:process.cwd()},outputDir:'../.camp-boss-local/vfx-results',reporter:[['list']]});
