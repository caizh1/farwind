import {defineConfig} from '@playwright/test';
import {resolve} from 'node:path';
const root=process.env.FARWIND_EVIDENCE_ROOT??resolve('docs/village-defense/safety/integrated-current/test-browser');
process.env.FARWIND_EVIDENCE_ROOT=root;
export default defineConfig({testDir:'../tests',testMatch:['safety-performance.spec.ts','safety-defense.spec.ts','day-night-failure.spec.ts','village-raids.spec.ts','east-defense-recovery.spec.ts','economy-production.spec.ts',...(process.env.FARWIND_PRODUCTION?[]:['training.spec.ts']),'economy.spec.ts','adventure.spec.ts'],workers:1,timeout:300000,
 outputDir:resolve(root,'raw'),reporter:[['list'],['json',{outputFile:resolve(root,'results.json')}]],
 use:{headless:false,baseURL:process.env.FARWIND_URL??'http://127.0.0.1:5173/',viewport:{width:1280,height:720},video:{mode:'on',size:{width:1280,height:720}},screenshot:'only-on-failure',trace:'retain-on-failure',launchOptions:{args:['--enable-gpu','--use-gl=angle','--use-angle=metal','--ignore-gpu-blocklist']}}});
