import {defineConfig} from '@playwright/test';

// 直接验用户指定的已运行本机实例；不另起替代服务。
export default defineConfig({
 testDir:'../tests',testMatch:'sword-wind-audio.spec.ts',workers:1,timeout:120000,
 outputDir:'../.sword-wind-local/howl/browser-results',
 reporter:[['list'],['json',{outputFile:'.sword-wind-local/howl/browser-results.json'}]],
 use:{baseURL:'http://127.0.0.1:5173/',viewport:{width:1280,height:720},
  video:{mode:'on',size:{width:1280,height:720}},trace:'retain-on-failure',screenshot:'only-on-failure',
  launchOptions:{args:['--enable-gpu','--enable-webgl','--use-angle=metal']},
 },
});
