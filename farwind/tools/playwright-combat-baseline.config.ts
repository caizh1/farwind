import {defineConfig} from '@playwright/test';
// 原始源码与相同正式测试，用于区分旧地图夹具问题和本轮回归；证据写入独立目录。
const run=Date.now();
export default defineConfig({testDir:'../tests',testMatch:['adventure.spec.ts','combat-action.spec.ts','combat-feel.spec.ts','combat-followup.spec.ts','combat.spec.ts','combat-contact.spec.ts','day-night-failure.spec.ts','npc-life.spec.ts','water-effects.spec.ts'],timeout:240000,workers:1,retries:0,outputDir:`../.enemy-local/combat-feel/baseline-browser-${run}`,reporter:[['list'],['json',{outputFile:`.enemy-local/combat-feel/baseline-browser-${run}.json`}]],use:{baseURL:'http://127.0.0.1:5213',viewport:{width:1280,height:720},trace:'retain-on-failure',launchOptions:{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}}});
