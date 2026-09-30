import {defineConfig} from '@playwright/test';
import original from './playwright-camp-bosses.config';
// 保留原有完整玩法断言；换用此次固定包及独立记录位置，避免覆盖旧构建证据。
export default defineConfig({...original,
 use:{...original.use,trace:{mode:'retain-on-failure',screenshots:false,snapshots:true,sources:true}},
 webServer:{command:'npx vite preview --host 127.0.0.1 --port 5814 --strictPort --outDir .camp-boss-local/accuracy-production',url:'http://127.0.0.1:5814',reuseExistingServer:false,cwd:process.cwd()},
 outputDir:'../.camp-boss-local/accuracy-balance-results',reporter:[['list']]});
