import {defineConfig} from '@playwright/test';
import base from './playwright-first-map.config';
export default defineConfig({...base,testMatch:'demon-king.spec.ts',timeout:1500000,
 use:{...base.use,baseURL:'http://127.0.0.1:5207'},
 webServer:{command:'npx vite preview --host 127.0.0.1 --port 5207 --strictPort --outDir .demon-king-local/production',url:'http://127.0.0.1:5207',reuseExistingServer:false,cwd:process.cwd()},
 outputDir:'../.demon-king-local/browser-results'});
