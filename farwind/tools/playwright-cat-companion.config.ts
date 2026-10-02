import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'../tests',testMatch:'cat-companion.spec.ts',workers:1,retries:0,timeout:180000,
 outputDir:'../.cat-companion-local/browser',reporter:[['list']],
 use:{baseURL:'http://127.0.0.1:5271',viewport:{width:1280,height:720},actionTimeout:12000,screenshot:'only-on-failure',trace:'retain-on-failure',launchOptions:{args:['--enable-webgl','--use-angle=metal']}},
 webServer:{cwd:process.cwd(),command:'npx vite preview --outDir .cat-companion-local/production --host 127.0.0.1 --port 5271 --strictPort',url:'http://127.0.0.1:5271',reuseExistingServer:true},
});
