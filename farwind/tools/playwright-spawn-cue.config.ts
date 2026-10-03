import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'../tests',testMatch:'spawn-cue.spec.ts',workers:1,retries:0,timeout:90000,
 use:{baseURL:'http://127.0.0.1:5299',viewport:{width:1280,height:720},deviceScaleFactor:1,trace:'retain-on-failure',screenshot:'only-on-failure',launchOptions:{args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']}},
 webServer:{command:'npm run preview -- --port 5299 --strictPort',url:'http://127.0.0.1:5299',reuseExistingServer:false},outputDir:'../.spawn-cue-local/results',reporter:[['list']]});
