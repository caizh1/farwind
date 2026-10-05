import {describe,it,expect} from 'vitest';
import {writeFileSync,readFileSync} from 'node:fs';
import {ENCOUNTERS,ADVENTURE_ROUTES,waveMembers} from '../src/data/maps/windbell/encounters';
import {RETALIATION_COMPOSITIONS,raidUnitProfile} from '../src/data/demonKing';
import {enemyProfile} from '../src/data/enemies';
import {motionBlocked,clearMotionLine,clearMeleeLine} from '../src/game/systems/obstacles';
import {enemyProtection} from '../src/game/systems/enemyTraits';
import {refreshFungalShields} from '../src/game/systems/fungalCombat';
import {resolveDamage} from '../src/game/systems/damage';
import {SwordWindSystem} from '../src/game/systems/swordWind';
import {CombatController,sweepMove,attackConfig,type Attack} from '../src/game/systems/combat';
import {resolveSwordWindConfig,SWORD_WIND} from '../src/data/swordWind';
import {initialState,parseSave} from '../src/game/systems/state';
import {NpcLife} from '../src/game/systems/npcLife';
import {syncMapGeometry} from '../src/data/world';
// 固定参考构筑与自动策略只衡量确定性战斗链路；不替代真人可读性、手感和GPU帧时间验收。
const dir=(a:{x:number;y:number},b:{x:number;y:number})=>{const d=Math.hypot(b.x-a.x,b.y-a.y)||1;return {x:(b.x-a.x)/d,y:(b.y-a.y)/d};};
const center={x:3300,y:1500};
const samples=[...Object.entries(ADVENTURE_ROUTES).map(([direction,route])=>({name:`${({south:'南路',west:'西路',north:'北路',east:'东路'} as Record<string,string>)[direction]}中后期`,group:route[2],kinds:waveMembers(ENCOUNTERS.find(d=>d.id===route[2])!,42,2).filter(m=>m.wave===1).map(m=>m.type),oldKinds:[] as string[],level:0,tier:2})),
 ...RETALIATION_COMPOSITIONS.map((kinds,i)=>({name:`第${i+1}轮报复`,kinds:[...kinds],oldKinds:Array(10).fill('leaf'),level:i+1,tier:i>=2?2:1})),
 ...[0,1,2].map(wave=>({name:`商路第${wave+1}阶段`,kinds:['canyonHunter','cliffLancer','cragAxeman','canyonHunter','cliffLancer',...Array(wave).fill('canyonHunter')],oldKinds:[] as string[],level:0,tier:wave?2:1})),
 {name:'入门遭遇',kinds:waveMembers(ENCOUNTERS.find(d=>d.id===ADVENTURE_ROUTES.south[0])!,42,2).filter(m=>m.wave===0).map(m=>m.type),oldKinds:[] as string[],level:0,tier:1}];
async function modules(legacy:boolean){const root=legacy?'../.wave-combat-local/baseline/src':'../src';const enemy=await import(`${root}/game/systems/enemy.ts`),attack=await import(`${root}/game/systems/enemyAttack.ts`),projectiles=await import(`${root}/game/systems/enemyProjectiles.ts`),tempo=await import(`${root}/game/systems/encounterTempo.ts`),hazards=await import(`${root}/game/systems/campBossCombat.ts`),reaction=await import(`${root}/game/systems/enemyReaction.ts`);return {enemy,attack,projectiles,tempo,hazards,reaction};}
async function fight(sample:typeof samples[number],active:boolean,variant:'baseline'|0|3,pressureOnly=false){
 const legacy=false;const Controller=variant==='baseline'?(await import('../.rapid-fire-local/baseline/src/game/systems/combat')).CombatController:CombatController;
 const m=await modules(legacy),c=new Controller(),shots=new m.projectiles.EnemyProjectiles(),hazards=new m.hazards.BossHazards(),winds=new SwordWindSystem();c.swordWindEnabled=true;c.swordWindConfig=resolveSwordWindConfig(3,variant==='baseline'?3:variant);
 const hero={...center,hp:pressureOnly?100000:100,stamina:100},kinds=legacy&&'group' in sample?(await import(`${'../.wave-combat-local/baseline/src'}/data/maps/windbell/encounters.ts`)).waveMembers(ENCOUNTERS.find(d=>d.id===sample.group)!,42).filter((e:any)=>e.wave===1).map((e:any)=>e.type):legacy&&sample.oldKinds.length?sample.oldKinds:sample.kinds,peers=kinds.map((type,i)=>{const angle=(i+.35)*Math.PI*2/kinds.length,point={x:center.x+Math.cos(angle)*245,y:center.y+Math.sin(angle)*245};return {id:`样本:${i}`,type,...point,homeX:point.x,homeY:point.y,hp:pressureOnly?100000:sample.level?raidUnitProfile(type,sample.level,2).maxHP:enemyProfile(type).hp,cool:0,windup:0,staggerUntil:0,nav:m.enemy.enemyNavigation(),ai:'家园',disabled:false,recovered:false,targetId:'player',combatTier:legacy?0:sample.tier,leashRadius:800};});
 c.resolveWindAim=root=>{const targets=peers.filter(e=>e.hp>0&&!e.disabled&&Math.hypot(e.x-root.x,e.y-root.y)<=340);targets.sort((a,b)=>(active?Number(!['priest','archer','spore','geomancer'].includes(a.type))-Number(!['priest','archer','spore','geomancer'].includes(b.type)):0)||Math.hypot(a.x-root.x,a.y-root.y)-Math.hypot(b.x-root.x,b.y-root.y));const e=targets[0];if(!e)return null;const d=dir(root,e),facing=Math.abs(d.x)>Math.abs(d.y)?d.x<0?2:3:d.y<0?1:0;return {direction:d,facing,target:e.id};};
 let invulnerable=0,damage=0,hits=0,releases=0,now=0;const times:number[]=[];
 for(now=50;now<=90000&&hero.hp>0&&peers.some(e=>e.hp>0);now+=50){const start=performance.now(),previous={x:hero.x,y:hero.y},oldPositions=peers.map(e=>({x:e.x,y:e.y}));c.advanceFrame(50);hero.stamina=Math.min(100,hero.stamina+.7);
  const live=peers.filter(e=>e.hp>0);
  if(active&&!c.hurting(now)){const nearest=live.slice().sort((a,b)=>Math.hypot(a.x-hero.x,a.y-hero.y)-Math.hypot(b.x-hero.x,b.y-hero.y))[0],away=dir(nearest,hero),radial=dir(center,hero),far=Math.hypot(hero.x-center.x,hero.y-center.y)>230;
   const axis=Math.hypot(nearest.x-hero.x,nearest.y-hero.y)>250?{x:-away.x,y:-away.y}:far?{x:-radial.y-radial.x*.7,y:radial.x-radial.y*.7}:{x:-away.y+away.x*.75,y:away.x+away.y*.75},length=Math.hypot(axis.x,axis.y)||1;
   const danger=live.some(e=>e.attack&&!e.attack.cancelled&&now>=e.attack.lockAt&&now<e.attack.contactAt+100&&Math.hypot(e.x-hero.x,e.y-hero.y)<190)||hazards.hazards.some((h:any)=>Math.hypot(h.point.x-hero.x,h.point.y-hero.y)<85&&h.activeAt-now<200);
   if(danger&&hero.stamina>=20&&c.requestDash(now,hero.stamina,axis,3))hero.stamina-=20;
   if(now>=c.dashUntil)sweepMove(hero,axis.x/length*180*.05,axis.y/length*180*.05,motionBlocked,clearMotionLine,live);
  }
  c.windHeld=true;c.windAuto=true;c.flushActions(now,hero);
  c.update(now-50,now,3,hero,peers,motionBlocked,()=>true,()=>{},()=>{},()=>{},clearMotionLine,(a,root,at)=>{releases++;winds.launch(a,root,at,36);});
  const pressure=[...shots.shots.filter((s:any)=>s.state==='flying'||s.state==='contact').map((s:any)=>({x:s.x,y:s.y,group:s.id.replace(/:spore(?::\d+)?$/,''),owner:s.attack.attackerId,type:s.attack.type,until:s.attack.activeUntil})),...hazards.hazards.map((h:any)=>({...h.point,group:h.id.replace(/:地面\d+$/,''),owner:h.owner,type:'geomancer',until:h.expires}))];
  const contacts:any[]=[];refreshFungalShields(peers,now);
  for(const e of peers){const contact=m.enemy.updateEnemy(e,hero,now,50,{queries:2},'player',(enemy:any,target:string)=>m.tempo.playerAttackPermitted(enemy,target,hero,peers,now,undefined,pressure),peers);if(e.attack){if(sample.level)e.attack.damage=raidUnitProfile(e.type,sample.level,2).damage;shots.launch(e.attack,e,now);hazards.launch(e,now);}if(contact)contacts.push(contact);}
  contacts.push(...shots.update(now,hero),...hazards.update(now-50,now,peers,[{id:'player',...hero,previous}]));
  for(const contact of contacts.sort((a,b)=>a.at-b.at)){if(contact.attack.cancelled||contact.attack.resolved)continue;contact.attack.resolved=true;if(contact.projectileId)shots.settle(contact.projectileId,now,false);if(contact.at<invulnerable||c.invulnerable(contact.at))continue;
   const taken=Math.max(1,contact.attack.damage-4);hero.hp=Math.max(0,hero.hp-taken);damage+=taken;hits++;invulnerable=contact.at+850;c.takeHit(now,3,contact.attack.direction,hero);
  }
  for(const event of winds.advance(now-50,now,peers.map((e,i)=>({target:e,previous:oldPositions[i],current:e}))))if(event.kind==='hit'&&event.target){const e=peers.find(e=>e.id===event.target!.id)!;const protection=enemyProtection(e,event.wind.origin,event.at);const hit=resolveDamage({sourceId:'player',targetId:e.id,attackId:`剑风:${event.wind.id}`,amount:event.wind.config.damage,sourceType:'player-wind',eventId:null},{id:'player',hp:hero.hp,faction:'village',armor:0},{id:e.id,hp:e.hp,faction:'hostile',armor:0,...protection});if(hit.applied){e.hp=hit.hp;m.reaction.reactToEnemyHit(e,event.at,SWORD_WIND.strike,event.wind.direction,(protection.reduction??0)>0,false);}}
  for(const e of peers)if(e.attack&&!e.attack.launched)m.attack.predictEnemyContact(e.attack,e,hero,now);for(const shot of shots.shots)if(shot.state==='flying')shots.prediction(shot,hero);
  times.push(performance.now()-start);
 }
 const sorted=times.slice(100).sort((a,b)=>a-b);return {版本:variant==='baseline'?'修改前':`${variant}级`,策略:active?'走位风步和支援优先':'站桩自动剑风',样本:sample.name,通关:peers.every(e=>e.hp<=0),损失生命:Math.min(100,damage),命中次数:hits,耗时秒:now/1000,剑风次数:releases,逻辑帧P95毫秒:sorted[Math.floor(sorted.length*.95)]??0};
}
describe.skipIf(!process.env.FARWIND_RAPID_FIRE_BENCHMARK)('剑风十二个现有样本对照',()=>{
 it('相同构筑72场，三级恢复修改前节奏',async()=>{
  const records=[];
  for(const sample of samples)for(const active of [false,true])for(const variant of ['baseline',0,3] as const)records.push(await fight(sample,active,variant));
  const summary=Object.fromEntries(['修改前','0级','3级'].map(version=>{const rows=records.filter(r=>r.版本===version);return [version,{场数:rows.length,通关率:rows.filter(r=>r.通关).length/rows.length,平均损失生命:rows.reduce((sum,r)=>sum+r.损失生命,0)/rows.length,平均耗时秒:rows.reduce((sum,r)=>sum+r.耗时秒,0)/rows.length}];}));
  writeFileSync('docs/sword-wind-rapid-fire/battle-comparison.json',JSON.stringify({说明:'复用wave-combat-benchmark的十二个样本、站桩与主动策略。相同三阶剑风伤害36、生命100、护甲4，无符文伙伴药剂；额外运行冻结提交dba06d4的原战斗控制器作为修改前基线。确定性逻辑模型，不代表真人通关率或GPU性能。',汇总:summary,记录:records},null,2));
  expect(records).toHaveLength(72);
  for(const sample of samples)for(const strategy of ['站桩自动剑风','走位风步和支援优先']){
   const before=records.find(r=>r.样本===sample.name&&r.策略===strategy&&r.版本==='修改前')!,after=records.find(r=>r.样本===sample.name&&r.策略===strategy&&r.版本==='3级')!;
   for(const key of ['通关','损失生命','命中次数','耗时秒','剑风次数'] as const)expect(after[key],`${sample.name}/${strategy}/${key}`).toEqual(before[key]);
  }
 },180000);
});
