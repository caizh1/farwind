import {cp,mkdir,symlink,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {createServer} from 'vite';
const root=resolve(`.enemy-local/runtime-${Date.now()}`);await mkdir(root,{recursive:true});
// 使用当前工作区等内容副本冻结本次验收，关闭热更新；不修改运行中游戏状态。
for(const p of ['src','public','index.html','enemy-preview.html','package.json','tsconfig.json'])await cp(p,`${root}/${p}`,{recursive:true});
await symlink(resolve('node_modules'),`${root}/node_modules`);await symlink(resolve('docs'),`${root}/docs`);
const files=['src/game/scenes/World.ts','src/game/systems/enemy.ts','src/game/systems/enemyAttack.ts','src/game/systems/enemyAnimation.ts','src/game/systems/enemyProjectiles.ts','src/game/entities/enemyView.ts','src/game/entities/defenders.ts','src/game/systems/slimeAnimation.ts','src/game/systems/parryTraining.ts','src/game/ui/interface.ts','src/data/enemies.ts','src/data/world.ts',...['moss-slime','branch-reaper','ashen-spore','armored-boar','dusk-raven','spore-projectile','spore-burst'].map(n=>`public/assets/enemies-v1/${n}.png`)];
await mkdir('docs/enemy-combat-v1/evidence',{recursive:true});await writeFile('docs/enemy-combat-v1/evidence/runtime-snapshot.json',JSON.stringify({说明:'当前工作区冻结副本；正式入口、隔离数据库、不注入状态；无热更新干扰',目录:root,时间:new Date().toISOString(),文件:await Promise.all(files.map(async p=>({路径:p,摘要:createHash('sha256').update(await readFile(p)).digest('hex')})))},null,2));
const server=await createServer({configFile:false,root,cacheDir:`${root}/cache`,server:{host:'127.0.0.1',port:5175,strictPort:true,hmr:false},plugins:[{name:'isolated-review-storage',transform(code,id){if(!/[/\\]src[/\\]game[/\\]systems[/\\]save\.ts$/.test(id))return;const original='indexedDB.open("farwind-save", 1)';if(!code.includes(original))throw Error('验收数据库隔离失败');return {code:code.replace(original,'indexedDB.open("farwind-enemy-combat-review", 1)'),map:null};}}]});await server.listen();server.printUrls();for(const sig of ['SIGTERM','SIGINT'])process.on(sig,async()=>{await server.close();process.exit(0);});
