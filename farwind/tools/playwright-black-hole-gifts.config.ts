import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'../tests',testMatch:'black-hole-gifts.spec.ts',workers:1,retries:0,timeout:60000,
 outputDir:'../test-results/black-hole-gifts',reporter:[['list']],
 use:{baseURL:'http://127.0.0.1:5351',viewport:{width:1280,height:800},screenshot:'only-on-failure',trace:'retain-on-failure',launchOptions:{args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']}},
 webServer:{command:'npm run dev -- --port 5351 --strictPort',url:'http://127.0.0.1:5351',reuseExistingServer:true},
});
