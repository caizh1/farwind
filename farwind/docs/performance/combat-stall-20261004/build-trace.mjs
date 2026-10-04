// 冻结旧页面与当前修复代码，使用相同低频界面和逐帧诊断；不修改正式源码。
import {build,preview} from 'vite';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url)),dir=fileURLToPath(new URL('.',import.meta.url));
const originals=new Map(await Promise.all(['src/data/world.ts','src/game/systems/obstacles.ts','src/game/systems/swordWindGeometry.ts','src/game/systems/enemyAttack.ts'].map(async p=>[root+p,await readFile(root+'.combat-performance-local/baseline-source/'+p.split('/').at(-1),'utf8')])));
const probe=await readFile(dir+'trace.js','utf8');
const measured={'/systems/enemyAttack.ts':[['predictEnemyContact','接触预测']],'/entities/attackWarningView.ts':[['previewWarning','危险区推演']],'/systems/enemy.ts':[['updateEnemy','敌人推进'],['advancePathSearch','寻路批次']],'/systems/xiaobaoWorld.ts':[['xiaobaoEnvironment','伙伴环境']],'/systems/combatObservation.ts':[['observeCombat','只读观察']]};
const counted={'/data/world.ts':['solidPropAt'],'/systems/obstacles.ts':['propLineBlocker'],'/systems/swordWindGeometry.ts':['firstSwordWindBlocker']};
function instrument(code,name,label,timing){
 const marker='export function '+name+'(';if(!code.includes(marker))throw Error('无法定位诊断函数：'+name);
 code=code.replace(marker,'function stallOriginal_'+name+'(');
 const call=`stallOriginal_${name}(...args)`;
 const body=timing?`const start=performance.now(),scope=p.scope;p.scope=${JSON.stringify(label)};try{return ${call};}finally{p.scope=scope;r[${JSON.stringify(label+'毫秒')}]=(r[${JSON.stringify(label+'毫秒')}]??0)+performance.now()-start;r[${JSON.stringify(label+'次数')}]=(r[${JSON.stringify(label+'次数')}]??0)+1;}`:`const key=(p.scope??'其他')+${JSON.stringify(':'+name)};r[key]=(r[key]??0)+1;return ${call};`;
 return code+`\nexport function ${name}(...args:Parameters<typeof stallOriginal_${name}>){const p=(globalThis as any).__combatStall,r=p?.current;if(!r)return ${call};${body}}\n`;
}
for(const [version,port,label] of [['old',5314,'用户旧页面'],['fixed',5315,'当前修复代码']]){
 const outDir=root+'.combat-performance-local/stall-'+version;
 const plugin={name:'持续掉帧逐帧诊断',enforce:'pre',transform(input,id){let code=version==='old'&&originals.has(id)?originals.get(id):input;for(const [suffix,list] of Object.entries(measured))if(id.endsWith(suffix))for(const [name,label] of list)code=instrument(code,name,label,true);for(const [suffix,list] of Object.entries(counted))if(id.endsWith(suffix))for(const name of list)code=instrument(code,name,'',false);if(id.endsWith('/systems/terrain.ts'))code=code.replace("this.events.on('prerender',refresh);",`const measuredRefresh=()=>{const r=(globalThis as any).__combatStall?.current;if(!r){refresh();return;}const start=performance.now();try{refresh();}finally{r['地形烘焙毫秒']=(r['地形烘焙毫秒']??0)+performance.now()-start;}};this.events.on('prerender',measuredRefresh);`).replace("this.events.off('prerender',refresh);","this.events.off('prerender',measuredRefresh);");if(id.endsWith('/src/game/scenes/World.ts'))code+='\nconst traceVersion='+JSON.stringify(label)+';\n'+probe;return code===input?null:code;}};
 await build({root,configFile:false,plugins:[plugin],build:{outDir}});
 const local={name:'本地存档与记录',configurePreviewServer(s){s.middlewares.use(async(req,res,next)=>{try{if(req.url==='/save-19'||req.url==='/save-20'){res.setHeader('Content-Type','application/json');res.end(await readFile('/Users/archer/Downloads/farwind-save ('+req.url.slice(6)+').json'));}else if(req.url==='/trace-result'&&req.method==='POST'){const chunks=[];for await(const c of req)chunks.push(c);const parsed=JSON.parse(Buffer.concat(chunks).toString('utf8'));await writeFile(dir+version+'-'+parsed.样本+'.json',JSON.stringify(parsed));res.end('已保存');}else next();}catch(e){res.statusCode=500;res.end('本地诊断失败：'+e.message);}});}};
 await preview({root,configFile:false,plugins:[local],build:{outDir},preview:{host:'127.0.0.1',port,strictPort:true}});
 console.log(label+'：http://127.0.0.1:'+port+'/?stallTrace=1');
}
