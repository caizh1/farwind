import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'../tests',testMatch:'recovery-cancel.spec.ts',workers:1,retries:0,timeout:30000,
 outputDir:'/tmp/farwind-recovery-cancel-browser',reporter:[['list']],
 use:{baseURL:'http://127.0.0.1:5225',viewport:{width:1280,height:720},video:'on',trace:'retain-on-failure',launchOptions:{args:['--enable-webgl','--use-angle=metal']}},
 webServer:{command:'node tools/serve-recovery-cancel.mjs',url:'http://127.0.0.1:5225',reuseExistingServer:true,cwd:process.cwd()}});
