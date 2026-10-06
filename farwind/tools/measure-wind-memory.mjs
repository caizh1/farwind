// 固定种子规则基准；实际身体与攻击均从正式系统创建，数值不冒充实机平衡。
import {createServer} from 'vite';
import {readFile,writeFile} from 'node:fs/promises';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try {
 const {parseSave}=await server.ssrLoadModule('/src/game/systems/state.ts');
 const {startWindMemory,endWindMemory,memoryStrength,memoryCoins}=await server.ssrLoadModule('/src/game/systems/windMemory.ts');
 const {ADVENTURE_ROUTES,ENCOUNTERS,waveMembers}=await server.ssrLoadModule('/src/data/maps/windbell/encounters.ts');
 const {creatureMaxHP}=await server.ssrLoadModule('/src/data/maps/windbell/elites.ts');
 const {createEnemyAttack,creatureCooldown}=await server.ssrLoadModule('/src/game/systems/enemyAttack.ts');
 const {enemyNavigation,updateEnemy,navigationBudget}=await server.ssrLoadModule('/src/game/systems/enemy.ts');
 const {syncMapGeometry}=await server.ssrLoadModule('/src/data/world.ts');syncMapGeometry(false);
 const raw=await readFile('docs/combat-v2/evidence/four-camps-exported-save.json','utf8'),rows=[];
 for(const n of [1,2,5,10,20]) {
  let s=parseSave(raw);const camp=ENCOUNTERS.find(d=>d.id===ADVENTURE_ROUTES.north[4]);Object.assign(s.player,{x:camp.x,y:camp.y});for(let i=0;i<n;i++){s=startWindMemory(s,'north',1234);if(i+1<n)s=endWindMemory(s);}
  const diff=s.windMemory.active.encounters.memoryDifficulty,e={id:'规则基准',type:'slime',x:330,y:-330,homeX:330,homeY:-330,hp:creatureMaxHP('slime',undefined,undefined,diff),maxHP:creatureMaxHP('slime',undefined,undefined,diff),memoryDifficulty:diff,cool:0,windup:0,staggerUntil:0,nav:enemyNavigation(),ai:'家园',disabled:false,recovered:false};
  e.nav.path=[{x:500,y:-330}];e.nav.next=Infinity;e.nav.mode='chase';e.nav.lastSeen={x:500,y:-330};updateEnemy(e,{x:500,y:-330},1000,100,navigationBudget(),'player',()=>false);
  const a=createEnemyAttack(e.id,1,e.type,0,e,{x:380,y:-330});
  rows.push({档位:n,种子:s.windMemory.active.seed,普通强度:memoryStrength(diff),精英首领强度:memoryStrength(diff,true),史莱姆生命:e.maxHP,史莱姆伤害:a.damage,实际每秒移动距离:Math.hypot(e.x-330,e.y+330)*10,攻击前摇毫秒:a.contactAt,锁向后保留毫秒:a.contactAt-a.lockAt,攻击段毫秒:a.activeUntil-a.contactAt,收招毫秒:a.recoveryUntil-a.activeUntil,收招后等待毫秒:creatureCooldown(a)-a.recoveryUntil,五处普通总人数:ADVENTURE_ROUTES.north.map(id=>waveMembers(ENCOUNTERS.find(d=>d.id===id),1234,2,n).filter(m=>!m.boss).length),普通金币:memoryCoins(4,diff),精英金币:memoryCoins(8,diff),首领金币:memoryCoins(16,diff)});
 }
 await writeFile('docs/wind-memory/evidence/fixed-levels.json',JSON.stringify({说明:'固定种子1234的正式规则及100毫秒导航位移基准；不表示键鼠通关。',结果:rows},null,2));console.log('五档规则基准已记录。');
} finally {await server.close();}
