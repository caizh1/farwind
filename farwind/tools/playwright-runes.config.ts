import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'../tests',testMatch:'runes.spec.ts',workers:1,retries:0,timeout:240000,
 outputDir:'/tmp/farwind-rune-browser',reporter:[['list']],
 use:{baseURL:'http://127.0.0.1:5196',viewport:{width:1280,height:720},video:'on',trace:'retain-on-failure',launchOptions:{args:['--enable-webgl','--use-angle=metal']}},
 webServer:{command:'node tools/serve-runes.mjs',url:'http://127.0.0.1:5196',reuseExistingServer:true,cwd:process.cwd()}});
