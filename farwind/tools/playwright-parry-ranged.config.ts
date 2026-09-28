import {defineConfig} from '@playwright/test';
import {resolve} from 'node:path';
// 使用源码等内容副本及独立端口，不触碰5173的用户存档。
export default defineConfig({
 testDir:'../tests',testMatch:'*.spec.ts',workers:1,retries:0,timeout:60000,
 outputDir:resolve('.parry-local/ranged/results'),reporter:[['list'],['json',{outputFile:resolve(process.env.FARWIND_RANGED_RESULTS??'docs/parry-ranged/browser-results.json')}]],
 use:{baseURL:'http://127.0.0.1:5216',viewport:{width:1280,height:720},video:{mode:'on',size:{width:1280,height:720}},trace:'retain-on-failure',launchOptions:{args:['--enable-gpu','--enable-webgl','--use-angle=metal']}},
 webServer:{cwd:resolve('.'),command:'VITE_DEV_GRANT_SWORD_WIND=0 FARWIND_RUNTIME_ROOT=.parry-local/ranged/runtime FARWIND_RUNTIME_PORT=5216 FARWIND_RUNTIME_EVIDENCE=docs/parry-ranged/runtime-snapshot.json FARWIND_RUNTIME_EXTRA_SOURCES=\'["src/game/systems/swordWind.ts","src/game/systems/enemyProjectiles.ts","src/game/systems/combatFeedback.ts","src/game/entities/swordWindView.ts"]\' node tools/serve-parry-runtime.mjs',url:'http://127.0.0.1:5216',reuseExistingServer:false}
});
