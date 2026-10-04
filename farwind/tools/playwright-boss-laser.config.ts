import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'../tests',testMatch:'boss-laser.spec.ts',workers:1,retries:0,timeout:360000,
 use:{baseURL:'http://127.0.0.1:5482',headless:false,viewport:{width:1440,height:1000},video:{mode:'on',size:{width:1440,height:1000}},trace:'retain-on-failure',launchOptions:{args:['--enable-gpu','--use-gl=angle','--use-angle=metal']}},
 webServer:{command:'node tools/serve-boss-motion-preview.mjs',url:'http://127.0.0.1:5482',reuseExistingServer:false,cwd:process.cwd()},
 outputDir:process.cwd()+'/.boss-laser-local/browser-results',reporter:[['list']]});
