// 用同一计时控件构建修复前后生产代码；不注入授予或战斗优化开关。
import {build,preview} from 'vite';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url)),dir=fileURLToPath(new URL('.',import.meta.url));
const save=await readFile('/Users/archer/Downloads/farwind-save (19).json','utf8');
const originalFiles=new Map(await Promise.all(['src/data/world.ts','src/game/systems/obstacles.ts','src/game/systems/swordWindGeometry.ts','src/game/systems/enemyAttack.ts'].map(async path=>[root+path,await readFile(root+'.combat-performance-local/baseline-source/'+path.split('/').at(-1),'utf8')])));
let probe=await readFile(root+'docs/performance/combat-warning-wind-20261003/probe.js','utf8');
probe=probe.replace('globalThis.__combatCandidate=candidate;','').replace("(candidate?'候选优化':'原始代码')",'runtimeVersion').replace("方案:candidate?'候选范围排除与空间索引':'原始预测'",'方案:runtimeVersion');
probe=probe.replace("button('原始静止采样',()=>sample(false,false));button('原始按住I采样',()=>sample(false,true));button('候选按住I采样',()=>sample(true,true));", "button('静止采样',()=>sample(false,false));button('按住I采样',()=>sample(false,true));");
probe=probe.replace("说明:'当前工作树的隔离开发构建；候选仅用于证明可行性；模拟按键样本不等于用户正式键鼠验收。'", "说明:'固定生产代码的运行对照，修复前后共用同一只读计时控件；诊断模拟按键不等同于原生键鼠。'");
probe=probe.replace('scene.ui.open(\'pause\');const keys=', "scene.ui.open('pause');const keys=");
probe=probe.replace("九五:a[Math.floor(a.length*.95)]??0,最长", "九五:a[Math.floor(a.length*.95)]??0,九九:a[Math.floor(a.length*.99)]??0,最长");
probe=probe.replace('组合帧:rows.filter', "超过16毫秒帧:rows.filter(r=>r.间隔>16.67).length,超过33毫秒帧:rows.filter(r=>r.间隔>33.34).length,组合帧:rows.filter");
probe=probe.replace('installCombatProbe(this);', "if(new URLSearchParams(location.search).has('performanceCheck'))installCombatProbe(this);");
for(const [version,port,label] of [['baseline',5312,'修复前'],['fixed',5313,'修复后']]){
 const outDir=root+'.combat-performance-local/'+version+'-instrumented';
 const plugin={name:'固定性能复核',enforce:'pre',transform(code,id){if(version==='baseline'&&originalFiles.has(id))return originalFiles.get(id);if(id.endsWith('/src/game/scenes/World.ts'))return code+'\nconst runtimeVersion='+JSON.stringify(label)+';\n'+probe;}};
 await build({root,configFile:false,plugins:[plugin],build:{outDir}});
 const middleware={name:'本地验证副本',configurePreviewServer(s){s.middlewares.use(async(req,res,next)=>{if(req.url==='/diagnostic-save'){res.setHeader('Content-Type','application/json');res.end(save);}else if(req.url==='/combat-result'&&req.method==='POST'){let data='';for await(const p of req)data+=p;await writeFile(dir+version+'-runtime.json',data);res.end('已保存');}else next();});}};
 await preview({root,configFile:false,plugins:[middleware],build:{outDir},preview:{host:'127.0.0.1',port,strictPort:true}});
 console.log(label+'固定构建：http://127.0.0.1:'+port+'/?performanceCheck=1');
}
