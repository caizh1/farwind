import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'../tests',workers:1,retries:0,timeout:240000,
 projects:[{name:'preview',testMatch:'boss-motion.spec.ts',use:{baseURL:'http://127.0.0.1:5482'}}],
 use:{headless:false,viewport:{width:1280,height:800},video:'on',trace:'retain-on-failure',launchOptions:{args:['--enable-gpu','--use-gl=angle','--use-angle=metal']}},
 webServer:{command:'node tools/serve-boss-motion-preview.mjs',url:'http://127.0.0.1:5482',reuseExistingServer:false,cwd:process.cwd()},
 outputDir:'../.boss-motion-local/browser-results',reporter:[['list']]});
