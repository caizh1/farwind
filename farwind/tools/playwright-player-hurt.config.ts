import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'../tests',testMatch:'player-hurt.spec.ts',workers:1,retries:0,timeout:60000,
  outputDir:`../.parry-local/player-hurt/runs/${Date.now()}`,reporter:[['list']],
  use:{baseURL:'http://127.0.0.1:5173',viewport:{width:1280,height:720},headless:false,video:{mode:'on',size:{width:1280,height:720}},trace:'retain-on-failure',launchOptions:{args:['--use-angle=metal','--ignore-gpu-blocklist']}},
  webServer:{command:'npm run dev',url:'http://127.0.0.1:5173',reuseExistingServer:true}});
