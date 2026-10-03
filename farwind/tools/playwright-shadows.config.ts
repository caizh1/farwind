import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'../tests',testMatch:'shadows.spec.ts',workers:1,retries:0,timeout:180000,
  use:{baseURL:'http://127.0.0.1:5495',viewport:{width:1440,height:1100},trace:'retain-on-failure',launchOptions:{args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']}},
  webServer:{command:'npm run dev -- --port 5495 --strictPort',url:'http://127.0.0.1:5495',reuseExistingServer:true},
  outputDir:'../.shadows-local/results',reporter:'list'});
