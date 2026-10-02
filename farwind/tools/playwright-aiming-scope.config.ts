import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'../tests',testMatch:'aiming-scope.spec.ts',workers:1,retries:0,timeout:240000,
 outputDir:process.env.SCOPE_BROWSER_DIR??'../docs/aiming-scope/evidence/browser',reporter:[['list']],
 use:{baseURL:'http://127.0.0.1:5239',viewport:{width:1280,height:720},actionTimeout:12000,video:{mode:'on',size:{width:1280,height:720}},trace:'retain-on-failure',launchOptions:{args:['--enable-webgl','--use-angle=metal']}},
 webServer:{cwd:process.cwd(),command:'npx vite preview --host 127.0.0.1 --port 5239 --strictPort',url:'http://127.0.0.1:5239',reuseExistingServer:true},
});
