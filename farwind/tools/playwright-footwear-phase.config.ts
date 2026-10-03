import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'../tests',testMatch:'footwear-phase.spec.ts',workers:1,timeout:60000,use:{baseURL:process.env.FARWIND_URL??'http://127.0.0.1:5301/',viewport:{width:1440,height:900},launchOptions:{args:['--enable-webgl','--use-angle=metal']}},outputDir:'../.footwear-phase-local/browser-output',reporter:'list'});
