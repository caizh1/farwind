import {defineConfig} from '@playwright/test';
import {resolve} from 'node:path';
const stage=process.env.SPORE_VALIDATION_STAGE??'after';
const dir=`docs/enemy-combat-v1/spore-hit-fix/${stage}`;
// 独立端口和源码副本；真实新游戏及键盘行程，不触碰5173的玩家记录。
export default defineConfig({
 testDir:'../tests',testMatch:'spore-hit.spec.ts',workers:1,retries:0,timeout:240000,
 outputDir:resolve(`.enemy-local/spore-hit-fix/${stage}-results`),
 reporter:[['list'],['json',{outputFile:resolve(`${dir}/browser-results.json`)}]],
 use:{baseURL:'http://127.0.0.1:5228',viewport:{width:1280,height:720},video:{mode:'on',size:{width:1280,height:720}},trace:'retain-on-failure',launchOptions:{args:['--enable-gpu','--use-angle=metal']}},
 webServer:{cwd:resolve('.'),command:`VITE_DEV_GRANT_SWORD_WIND=0 FARWIND_RUNTIME_ROOT=.enemy-local/spore-hit-fix/runtime-${stage} FARWIND_RUNTIME_PORT=5228 FARWIND_RUNTIME_EVIDENCE=${dir}/runtime-snapshot.json node tools/serve-parry-runtime.mjs`,url:'http://127.0.0.1:5228',reuseExistingServer:false},
});
