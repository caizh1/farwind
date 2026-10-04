// 固定项目地形下的十二敌人预测基准，并与原精确扫描逐例对照。
import {createServer} from 'vite';
import {writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const server=await createServer({server:{middlewareMode:true},appType:'custom',plugins:[{name:'暴露纯地形函数以便对照',transform(code,id){if(id.endsWith('/src/game/systems/obstacles.ts'))return code.replace('function terrainLineBlocker(', 'export function terrainLineBlocker(');}}]});
const {createEnemyAttack,predictEnemyContact,sampleEnemyAttack,advanceEnemyAttack,ENEMY_ATTACK,delayEnemyAttack}=await server.ssrLoadModule('/src/game/systems/enemyAttack.ts');
const {motionBlocked,clearMotionLine,clearMeleeLine,propLineBlocker,terrainLineBlocker}=await server.ssrLoadModule('/src/game/systems/obstacles.ts');
const world=await server.ssrLoadModule('/src/data/world.ts');
const {props,propBounds,terrainBlocked,FOOT,syncMapGeometry}=world;
const {enemyBehavior}=await server.ssrLoadModule('/src/data/enemies.ts');
const {previewWarning}=await server.ssrLoadModule('/src/game/entities/attackWarningView.ts');
let calls={点:0,线:0,近战:0};const space={blocked:(...args)=>{calls.点++;return motionBlocked(...args)},clear:(...args)=>{calls.线++;return clearMotionLine(...args)},melee:(...args)=>{calls.近战++;return clearMeleeLine(...args)}};
function candidate(a,root,target,now,s=space,paused=0){if(!a.boss&&!a.bossGeometry&&!['bomber','priest','bell','spore','archer'].includes(a.type)){
 const g=sampleEnemyAttack(a,a.contactAt,root).geometry,reach=Math.max(0,(a.step??ENEMY_ATTACK[enemyBehavior(a.type)].step)-a.motionAt)+g.radius+Math.max(Math.hypot(g.a.x-root.x,g.a.y-root.y),Math.hypot(g.b.x-root.x,g.b.y-root.y));if(Math.hypot(target.x-root.x,target.y-root.y)>reach+1e-7)return null;
 }return predictEnemyContact(a,root,target,now,s,paused);}
const summary=a=>{a.sort((x,y)=>x-y);return{平均毫秒:a.reduce((x,y)=>x+y,0)/a.length,九五毫秒:a[Math.floor(a.length*.95)],最长毫秒:a.at(-1)}};
const cells=new Map(),cellSize=128;let revision=-1;
function rebuild(){cells.clear();for(const [index,p] of props.entries()){if(!p.solid)continue;const b=propBounds(p);for(let x=Math.floor(b.left/cellSize);x<=Math.floor(b.right/cellSize);x++)for(let y=Math.floor(b.top/cellSize);y<=Math.floor(b.bottom/cellSize);y++){const key=x+':'+y;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(index);}}revision=world.mapGeometryRevision;}
function nearby(a,b,marginX=0,marginY=marginX){if(revision!==world.mapGeometryRevision)rebuild();const ids=new Set();for(let x=Math.floor((Math.min(a.x,b.x)-marginX)/cellSize);x<=Math.floor((Math.max(a.x,b.x)+marginX)/cellSize);x++)for(let y=Math.floor((Math.min(a.y,b.y)-marginY)/cellSize);y<=Math.floor((Math.max(a.y,b.y)+marginY)/cellSize);y++)for(const i of cells.get(x+':'+y)??[])ids.add(i);return [...ids].sort((a,b)=>a-b).map(i=>props[i]);}
const indexedSpace={blocked:(x,y)=>terrainBlocked(x,y)||nearby({x,y},{x,y},FOOT.halfWidth,FOOT.halfHeight).some(p=>p.solid&&Math.abs(x-p.x)<p.solid[0]/2+FOOT.halfWidth&&y>p.y-p.solid[1]-FOOT.halfHeight&&y<p.y+FOOT.halfHeight),clear:(a,b)=>!propLineBlocker(a,b,'motion',undefined,nearby(a,b,FOOT.halfWidth,FOOT.halfHeight))&&!terrainLineBlocker(a,b,'motion'),melee:(a,b,id)=>!propLineBlocker(a,b,'melee',id,nearby(a,b))&&!terrainLineBlocker(a,b,'melee')};
const indexedCandidate=(a,r,t,n)=>candidate(a,r,t,n,indexedSpace);
const results=[];
for(const [type,offset] of [['slime',190],['wolf',190],['boar',350]]){
 const root={x:3112,y:1019},target={x:root.x+offset,y:root.y+31},a=createEnemyAttack('诊断',1,type,0,root,target);a.locked=true;a.direction={x:1,y:0};
 for(const [name,fn] of [['原始预测',predictEnemyContact],['范围排除候选',candidate],['附近物件候选',indexedCandidate]]){for(let i=0;i<15;i++)fn(a,root,target,100,space);calls={点:0,线:0,近战:0};const times=[];for(let i=0;i<25;i++){const start=performance.now();for(let j=0;j<12;j++)fn(a,root,target,100,space);times.push(performance.now()-start);}results.push({物种:type,方案:name,目标距离:Math.hypot(offset,31),十二只预测:summary(times),每只查询:Object.fromEntries(Object.entries(calls).map(([k,v])=>[k,v/300])),结果:fn(a,root,target,100,space)});}
 for(const [name,s] of [['原始危险区几何预览',space],['附近物件危险区几何预览',indexedSpace]]){const times=[];for(let i=0;i<15;i++){const start=performance.now();for(let j=0;j<12;j++)previewWarning(a,root,s);times.push(performance.now()-start);}results.push({物种:type,方案:name,十二只预测:summary(times)});}
}
// 真实地形及可控墙面；边界、不同锁向、已推进、受击延迟均使用原裁决作为对照。
let samples=0,hits=0,mismatches=[];
const spaces=[space,{blocked:(x,y)=>x>=120,clear:(a,b)=>b.x<120,melee:()=>true},{blocked:()=>false,clear:()=>true,melee:()=>true}];
for(const type of ['slime','leaf','wolf','boar','raven','burrow','guardian','shade'])for(const distance of [0,40,74,74.0001,125,160,260,360])for(const angle of [0,.7,Math.PI])for(const locked of [true,false])for(const s of spaces){
 const root=s===space?{x:3112,y:1019}:{x:0,y:0},target={x:root.x+Math.cos(angle)*distance,y:root.y+Math.sin(angle)*distance},a=createEnemyAttack('对照',1,type,0,root,target);a.direction={x:1,y:0};a.locked=locked;
 const now=locked?a.contactAt+30:100;if(locked){const consumed={...a,direction:{...a.direction},emitted:true};advanceEnemyAttack(consumed,root,target,now,s);a.motionAt=consumed.motionAt;a.scanAt=consumed.scanAt;}
 const before=structuredClone(a),r1=predictEnemyContact(a,root,target,now,s,50),r2=candidate(a,root,target,now,s,50);samples++;hits+=r1!==null?1:0;if(r1!==r2||JSON.stringify(before)!==JSON.stringify(a))mismatches.push({物种:type,距离:distance,角度:angle,锁向:locked,原始:r1,候选:r2});
}
let spatialSamples=0,spatialMismatches=0,seed=71;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
for(let i=0;i<10000;i++){const p=props[Math.floor(random()*props.length)],a={x:p.x+(random()-.5)*200,y:p.y+(random()-.5)*200},b={x:a.x+(random()-.5)*500,y:a.y+(random()-.5)*500};for(const [raw,fast] of [[motionBlocked(a.x,a.y),indexedSpace.blocked(a.x,a.y)],[clearMotionLine(a,b),indexedSpace.clear(a,b)],[clearMeleeLine(a,b),indexedSpace.melee(a,b)]]){spatialSamples++;spatialMismatches+=!!raw!==!!fast?1:0;}}
let revisionSamples=0,revisionMismatches=0;
for(const open of [true,false,true,false]){syncMapGeometry(open,[],[],{wind:open?4:0,blade:open?4:0});for(const p of props.filter(p=>p.id==='west-gate-barrier'||p.id.startsWith('barrier-')||p.id.startsWith('legacy-'))){const a={x:p.x-5,y:p.y-5},b={x:p.x+5,y:p.y-5};for(const [raw,fast] of [[motionBlocked(a.x,a.y),indexedSpace.blocked(a.x,a.y)],[clearMotionLine(a,b),indexedSpace.clear(a,b)],[clearMeleeLine(a,b),indexedSpace.melee(a,b)]]){revisionSamples++;revisionMismatches+=!!raw!==!!fast?1:0;}}}
const files=['src/game/systems/enemyAttack.ts','src/game/scenes/World.ts','src/game/systems/obstacles.ts','src/data/world.ts','src/game/entities/swordWindView.ts'];const hashes={};for(const f of files)hashes[f]=createHash('sha256').update(await readFile(f)).digest('hex');
const result={说明:'本机Node与Vite服务端模块加载的固定基准，不能替代实战FPS；候选代码未写入生产源码。',日期:new Date().toISOString(),实体总数:props.length,固体总数:props.filter(p=>p.solid).length,结果:results,等价性:{样本数:samples,可命中样本:hits,不一致:mismatches,空间查询样本:spatialSamples,空间查询不一致:spatialMismatches,动态修订查询样本:revisionSamples,动态修订不一致:revisionMismatches},源码哈希:hashes};
await writeFile(new URL('./benchmark-results.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));await server.close();
