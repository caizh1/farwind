import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'../tests',testMatch:'enemy-death.spec.ts',workers:1,retries:0,timeout:120000,
 use:{baseURL:'http://127.0.0.1:5493',viewport:{width:1280,height:800},trace:'retain-on-failure',video:'on',launchOptions:{args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']}},
 webServer:{command:'node tools/serve-enemy-death.mjs',cwd:process.cwd(),url:'http://127.0.0.1:5493',reuseExistingServer:false},
 outputDir:'../.enemy-death-local/results',reporter:[['list']]});
