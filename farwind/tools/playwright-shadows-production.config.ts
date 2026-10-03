import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'../tests',testMatch:'shadows.production.ts',workers:1,retries:0,timeout:90000,
  use:{baseURL:'http://127.0.0.1:5496',viewport:{width:1280,height:800},trace:'retain-on-failure',launchOptions:{args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']}},
  webServer:{command:'npm run preview -- --outDir .shadows-local/production --port 5496 --strictPort',url:'http://127.0.0.1:5496',reuseExistingServer:false},
  outputDir:'../.shadows-local/production-results',reporter:'list'});
