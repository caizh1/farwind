import {cp,mkdir,symlink,writeFile,readFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createServer} from 'vite';
import {resolve} from 'node:path';
const root='.parry-local/runtime';
await rm(root,{recursive:true,force:true});
await mkdir(root,{recursive:true});
// 只冻结当前源码与资源，隔离并行开发的热更新；验证中不修改游戏状态。
for(const path of ['src','public','index.html','package.json','tsconfig.json','animation-preview.html'])await cp(path,`${root}/${path}`,{recursive:true});
try{await symlink('../../node_modules',`${root}/node_modules`);}catch(e){if(e.code!=='EEXIST')throw e;}
const sources=['package.json','src/game/scenes/World.ts','src/game/systems/combat.ts','src/game/systems/contact.ts','src/game/systems/enemy.ts','src/game/systems/enemyAttack.ts','src/game/systems/input.ts','src/game/systems/timeline.ts','src/game/systems/parryTraining.ts','src/game/systems/audio.ts','src/game/systems/sprint.ts','src/game/systems/locomotion.ts','src/game/systems/training.ts','src/game/systems/weaponTrail.ts','src/game/systems/obstacles.ts','src/game/systems/state.ts','src/game/systems/save.ts','src/game/systems/session.ts','src/game/entities/actor.ts','src/game/entities/trainingDummy.ts','src/game/ui/interface.ts','src/style.css','src/data/animation.ts','public/assets/animation/hero-parry.png'];
await writeFile('docs/parry/evidence/runtime-snapshot.json',JSON.stringify({说明:'当前工作区等内容副本，仅用于隔离热更新的本地浏览器验证，不发布，不设运行中状态',时间:new Date().toISOString(),文件:await Promise.all(sources.map(async path=>({路径:path,摘要:createHash('sha256').update(await readFile(path)).digest('hex')})))},null,2));
// 每个验收服务拥有自己的依赖缓存，避免多个 Vite 根目录使 Phaser 优化结果失效。
const server=await createServer({root:resolve(root),cacheDir:resolve('.parry-local/vite-cache'),server:{host:'127.0.0.1',port:5188,strictPort:true}});
await server.listen();server.printUrls();
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,async()=>{await server.close();process.exit(0);});
