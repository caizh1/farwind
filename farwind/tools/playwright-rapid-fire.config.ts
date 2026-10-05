import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'../tests',testMatch:'sword-wind-rapid-fire.spec.ts',workers:1,retries:0,timeout:240000,
 outputDir:'../.rapid-fire-local/browser-results',reporter:[['list']],
 use:{baseURL:'http://127.0.0.1:4173',viewport:{width:1280,height:720},actionTimeout:60000,trace:'retain-on-failure',launchOptions:{executablePath:'/usr/bin/chromium',args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']}},
 webServer:{command:'npm run preview -- --strictPort',url:'http://127.0.0.1:4173',reuseExistingServer:true},
});
