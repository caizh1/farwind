import {createServer} from 'vite';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
// 启动时冻结当前地形作为对照；显式指定旧版时读取提交中的原始模块。
const source=process.argv.includes('--head')?execFileSync('git',['show','HEAD:farwind/src/game/systems/terrain.ts'],{encoding:'utf8'}):readFileSync('src/game/systems/terrain.ts','utf8');
const server=await createServer({server:{host:'127.0.0.1',port:5188,strictPort:true},plugins:[{name:'地形修改前对照',enforce:'pre',transform(code,id){if(id.split('?')[0].endsWith('/src/game/systems/terrain.ts'))return {code:source,map:null};}}]});
await server.listen();
console.log('地形修改前对照已启动：http://127.0.0.1:5188/tools/terrain-preview.html');
