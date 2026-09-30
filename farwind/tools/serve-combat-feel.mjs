import {createServer} from 'vite';
import {resolve} from 'node:path';
import {copyFile} from 'node:fs/promises';
const baseline=process.env.COMBAT_FEEL_VERSION==='baseline',root=resolve(baseline?'.enemy-local/combat-feel/baseline':'.');
if(baseline)await copyFile('src/game/systems/combatFeelDebug.ts',`${root}/src/game/systems/combatFeelDebug.ts`);
const server=await createServer({configFile:false,root,cacheDir:resolve('.enemy-local/combat-feel/cache'),envDir:false,define:{'import.meta.env.VITE_DEV_GRANT_SWORD_WIND':JSON.stringify('0')},server:{host:'127.0.0.1',port:baseline?5213:5212,strictPort:true,hmr:false},plugins:baseline?[{name:'隔离基线样板',enforce:'pre',transform(code,id){
 if(id.endsWith('/systems/save.ts'))return code.replace("export const SAVE_DATABASE = 'farwind-first-map';","export const SAVE_DATABASE = 'farwind-combat-feel-isolated';");
 if(id.endsWith('/scenes/World.ts'))return code.replace('this.keys.uiKey=',"if(import.meta.env.DEV&&new URLSearchParams(location.search).has('combatFeel'))void import('../systems/combatFeelDebug').then(m=>m.installCombatFeelDebug(this));this.keys.uiKey=");
}}]:[]});
await server.listen();server.printUrls();
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await server.close();process.exit(0);});
