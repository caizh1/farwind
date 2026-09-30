import {defineConfig} from '@playwright/test';
import original from './playwright-camp-bosses.config';
// 使用既有两阶段、读档和正式清除断言，只切换固定包及证据目录。
export default defineConfig({...original,
 use:{...original.use,trace:{mode:'retain-on-failure',screenshots:false,snapshots:true,sources:true}},
 webServer:{command:'npx vite preview --host 127.0.0.1 --port 5814 --strictPort --outDir .camp-boss-local/vfx-production',url:'http://127.0.0.1:5814',reuseExistingServer:false,cwd:process.cwd()},
 outputDir:'../.camp-boss-local/vfx-balance-results',reporter:[['list']]});
