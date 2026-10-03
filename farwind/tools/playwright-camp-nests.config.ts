import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'../tests',testMatch:'camp-nests.spec.ts',workers:1,retries:0,timeout:300000,
  use:{baseURL:'http://127.0.0.1:5487',headless:false,viewport:{width:1280,height:800},screenshot:'only-on-failure',launchOptions:{args:['--enable-gpu','--use-gl=angle','--use-angle=metal']}},
  webServer:{cwd:process.cwd(),command:'./node_modules/.bin/vite preview --host 127.0.0.1 --port 5487 --strictPort',url:'http://127.0.0.1:5487',reuseExistingServer:false},
  outputDir:'../.camp-nests-local/results',reporter:'list'});
