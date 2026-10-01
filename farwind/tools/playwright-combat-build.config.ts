import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'../tests',testMatch:'combat-build.spec.ts',workers:1,retries:0,timeout:360000,
 outputDir:'../docs/combat-build/evidence/browser',reporter:[['list']],
 use:{actionTimeout:15000,baseURL:'http://127.0.0.1:5228',viewport:{width:1280,height:720},video:{mode:'on',size:{width:1280,height:720}},trace:'retain-on-failure',launchOptions:{args:['--enable-webgl','--use-angle=metal']}},
 webServer:{command:'VITE_DEV_GRANT_SWORD_WIND=0 npm run dev -- --port 5228 --strictPort',url:'http://127.0.0.1:5228',reuseExistingServer:true},
});
