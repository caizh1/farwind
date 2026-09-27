import {defineConfig} from '@playwright/test';
// 同一主试玩服务；原生Metal验证默认观感，软件渲染选项用于兼容检查。
const software=process.env.FARWIND_WATER_SOFTWARE==='1';
export default defineConfig({
 testDir:'../tests',testMatch:'water-effects.spec.ts',timeout:240000,workers:1,
 outputDir:'../.water-local/pond-redesign-results',
 use:{baseURL:process.env.FARWIND_URL??'http://127.0.0.1:5173',viewport:{width:1280,height:800},
  headless:software,video:'on',trace:'retain-on-failure',screenshot:'only-on-failure',
  launchOptions:{args:software?['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']:['--use-angle=metal','--ignore-gpu-blocklist']}},
 reporter:[['list'],['json',{outputFile:software?'../docs/water-effects/pond-redesign/software-browser-results.json':'../docs/water-effects/pond-redesign/browser-results.json'}]],
});
