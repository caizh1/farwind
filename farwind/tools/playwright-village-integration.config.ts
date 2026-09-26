import {defineConfig} from '@playwright/test';
import {resolve,basename} from 'node:path';
import base from './playwright-east-defense.config';
const root=process.env.FARWIND_EVIDENCE_ROOT??`docs/village-defense/m5/run-${new Date().toISOString().replace(/[:.]/g,'-')}`;
process.env.FARWIND_EVIDENCE_ROOT=root;
export default defineConfig({...base,testMatch:['village-integration.spec.ts','economy-production.spec.ts','village-raids.spec.ts','east-defense-recovery.spec.ts'],
 use:{...base.use,baseURL:process.env.FARWIND_URL??'http://127.0.0.1:5204/',launchOptions:{args:['--enable-gpu','--use-gl=angle','--use-angle=metal','--ignore-gpu-blocklist']}},
 outputDir:resolve('.parry-local/m5',basename(root),'browser-output'),reporter:[['list'],['json',{outputFile:resolve(root,'browser-results.json')}]]});
