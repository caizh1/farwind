import {defineConfig} from '@playwright/test';
// 隔离浏览器存档；候选构建先使用另一端口验收，再更新现有试玩地址。
const port=Number(process.env.ENEMY_PURSUIT_PORT??5216),outDir=port===5216?'.enemy-local/pursuit/production':'.enemy-local/pursuit/candidate';
export default defineConfig({
  testDir:'../tests',testMatch:'enemy-pursuit.spec.ts',workers:1,retries:0,timeout:180000,
  outputDir:`../.enemy-local/pursuit/browser-${Date.now()}`,reporter:[['list']],
  use:{baseURL:`http://127.0.0.1:${port}`,viewport:{width:1280,height:720},screenshot:'only-on-failure',trace:'retain-on-failure',video:{mode:'on',size:{width:1280,height:720}},launchOptions:{args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']}},
  webServer:{command:`./node_modules/.bin/vite preview --host 127.0.0.1 --port ${port} --strictPort --outDir ${outDir}`,cwd:process.cwd(),url:`http://127.0.0.1:${port}`,reuseExistingServer:port===5216},
});
