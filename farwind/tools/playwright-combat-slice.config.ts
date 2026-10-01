import {resolve} from 'node:path';
import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'../tests',testMatch:'combat-slice.spec.ts',workers:1,retries:0,timeout:90000,
  outputDir:resolve(`.enemy-local/combat-slice/${Date.now()}`),reporter:[['list']],
  use:{baseURL:'http://127.0.0.1:5226',viewport:{width:1280,height:720},video:{mode:'on',size:{width:1280,height:720}},trace:'retain-on-failure',
    launchOptions:{args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']}},
  webServer:{command:'npm run dev -- --port 5226 --strictPort',url:'http://127.0.0.1:5226',reuseExistingServer:true},
});
