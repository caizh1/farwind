// 隔离端口验证：源码保持不变，仅在诊断构建加入候选优化与计时。
import {createServer} from 'vite';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const dir=fileURLToPath(new URL('.',import.meta.url));
const probe=await readFile(dir+'probe.js','utf8');
const spatial=await readFile(dir+'spatial-candidate.js','utf8');
const save=await readFile('/Users/archer/Downloads/farwind-save (19).json','utf8');
const candidate=`
 // 非首领近战的保守包围范围；只排除不可能命中的目标，范围内继续原有精确扫描。
 if(globalThis.__combatCandidate&&!a.boss&&!a.bossGeometry){
  const g=sampleEnemyAttack(a,a.contactAt,root).geometry;
  const reach=Math.max(0,(a.step??ENEMY_ATTACK[enemyBehavior(a.type)].step)-a.motionAt)+g.radius+Math.max(Math.hypot(g.a.x-root.x,g.a.y-root.y),Math.hypot(g.b.x-root.x,g.b.y-root.y));
  if(Math.hypot(target.x-root.x,target.y-root.y)>reach+1e-7)return null;
 }
`;
const server=await createServer({root:fileURLToPath(new URL('../../../',import.meta.url)),configFile:false,server:{host:'127.0.0.1',port:5311,strictPort:true},plugins:[{name:'战斗性能诊断',enforce:'pre',configureServer(s){s.middlewares.use(async(req,res,next)=>{if(req.url==='/diagnostic-save'){res.setHeader('Content-Type','application/json');res.end(save);}else if(req.url==='/combat-result'&&req.method==='POST'){let text='';for await(const p of req)text+=p;await writeFile(dir+'browser-results.json',text);res.end('记录已保存');}else next();});},transform(code,id){if(id.endsWith('/src/data/world.ts'))return code.replace('return props.some(', 'return (globalThis.__combatCandidate?diagnosticNearbyProps({x,y},{x,y},FOOT.halfWidth,FOOT.halfHeight):props).some(')+'\n'+spatial;
if(id.endsWith('/src/game/systems/obstacles.ts'))return 'import {diagnosticNearbyProps} from \"../../data/world\";\n'+code.replace('objects: readonly Prop[] = props,', "objects: readonly Prop[] = globalThis.__combatCandidate?diagnosticNearbyProps(a,b,query==='motion'?12:0,query==='motion'?10:0):props,");
if(id.endsWith('/src/game/systems/swordWindGeometry.ts'))return 'import {diagnosticNearbyProps} from \"../../data/world\";\n'+code.replace('objects:readonly Prop[]=props', 'objects:readonly Prop[]=globalThis.__combatCandidate?diagnosticNearbyProps(a,b,radius):props');
if(id.endsWith('/src/game/systems/enemyAttack.ts'))return code.replace('const copy:EnemyAttack={...a,direction:{...a.direction}}',candidate+'const copy:EnemyAttack={...a,direction:{...a.direction}}');if(id.endsWith('/src/game/scenes/World.ts'))return code+'\n'+probe;}}]});
await server.listen();console.log('战斗诊断：http://127.0.0.1:5311/');
