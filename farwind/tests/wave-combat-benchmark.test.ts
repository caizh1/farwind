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
async function fight(sample:typeof samples[number],active:boolean,legacy:boolean,pressureOnly=false){
 const m=await modules(legacy),c=new CombatController(),shots=new m.projectiles.EnemyProjectiles(),hazards=new m.hazards.BossHazards(),winds=new SwordWindSystem();c.swordWindEnabled=true;c.swordWindConfig=resolveSwordWindConfig(3);
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
 const sorted=times.slice(100).sort((a,b)=>a-b);return {版本:legacy?'旧版':'新版',策略:active?'走位风步和支援优先':'站桩自动剑风',样本:sample.name,通关:peers.every(e=>e.hp<=0),损失生命:Math.min(100,damage),命中次数:hits,耗时秒:now/1000,剑风次数:releases,逻辑帧P95毫秒:sorted[Math.floor(sorted.length*.95)]??0};
}
describe.skipIf(!process.env.FARWIND_WAVE_BENCHMARK)('本地冻结版本对照',()=>{
 it('十二个战斗样本、站桩和主动纯剑风，旧新版共四十八场',async()=>{
  const records=[];for(const sample of samples)for(const legacy of [true,false])for(const active of [false,true])records.push(await fight(sample,active,legacy));
  const late=records.filter(r=>r.版本==='新版'&&r.样本!=='入门遭遇'),standing=late.filter(r=>r.策略==='站桩自动剑风'),active=late.filter(r=>r.策略!=='站桩自动剑风');
  const result={说明:'正式战斗模块的固定参考模型：生命100、护甲4、三阶剑风伤害36，无符文、伙伴和药剂；五阶与旅途副本另做实机验收。逻辑帧耗时不包含渲染、GPU和浏览器事件，不能代表真实帧时间。',站桩受伤达标率:standing.filter(r=>r.损失生命>=25).length/standing.length,主动通关率:active.filter(r=>r.通关).length/active.length,记录:records};writeFileSync('.wave-combat-local/battle-comparison.json',JSON.stringify(result,null,2));
  expect(records).toHaveLength(48);expect(result.站桩受伤达标率).toBeGreaterThanOrEqual(.8);expect(result.主动通关率).toBeGreaterThanOrEqual(.8);
 },180000);


 it('十二敌人持续压力的逻辑帧对照，与实际渲染帧时间分别记录',async()=>{
  const sample={name:'十二敌人压力',kinds:['leaf','wolf','shade','archer','spore','guardian','boar','geomancer','priest','leaf','wolf','leaf'],oldKinds:[],level:0,tier:2},records=[];
  for(let repeat=0;repeat<5;repeat++)for(const legacy of [true,false])records.push({...await fight(sample,false,legacy,true),轮次:repeat+1});
  const median=(version:string)=>{const times=records.filter(r=>r.版本===version).map(r=>r.逻辑帧P95毫秒).sort((a,b)=>a-b);return times[2];};
  writeFileSync('.wave-combat-local/logic-pressure-comparison.json',JSON.stringify({说明:'十二个高生命敌人持续九十秒，包含攻击许可、正式追击、攻击预测、远程扫掠和剑风；每版五轮。仅测逻辑CPU，不含场景渲染、纹理、GPU和真实浏览器帧调度，不能用于判定实际P95退化不超过百分之十。',旧版逻辑P95中位数:median('旧版'),新版逻辑P95中位数:median('新版'),记录:records},null,2));
 },60000);
 it('五日最大普通夜袭：守军、居民、设施与奖励保持正式结算',async()=>{
  syncMapGeometry(true);const oldWorld=await import(`${'../.wave-combat-local/baseline/src'}/data/world.ts`);oldWorld.syncMapGeometry(true);const records=[];
  try{for(const count of [3,8])for(const legacy of [true,false]){
   const root=legacy?'../.wave-combat-local/baseline/src':'../src',stateModule=await import(`${root}/game/systems/state.ts`),defenseModule=await import(`${root}/game/systems/defense.ts`),lifeModule=await import(`${root}/game/systems/npcLife.ts`),m=await modules(legacy);
   const s=stateModule.initialState();s.mapProgress.westRoad='open';s.time=1440+360;let d=new defenseModule.EastDefense(s.defense,0);const l=new lifeModule.NpcLife(s,d),shots=new m.projectiles.EnemyProjectiles();const hero={...s.player,hp:0};
   let now=0;
   for(let day=2;day<=6;day++){
    let spawned=false;const before=s.defense.completedSequence;
    for(let time=360;time<1800;time+=.15){now+=100;s.time=(day-1)*1440+time;
     if(!spawned&&time>=1200){const gate=['east-gate','south-gate','north-gate','west-gate','east-gate'][day-2];s.defense=defenseModule.prepareRaid(s.defense,hero,gate,count,true,undefined,[],{source:count===8?'demon-king':'wild',malice:count===8?4:0,profileVersion:legacy?1:2});expect(s.defense.raid!.members).toHaveLength(count);d.state=s.defense;d.restore(now);l.rebind(s,d);spawned=true;}
     const budget={queries:2};d.playerAttackPermit=(e:any,id:string)=>m.tempo.playerAttackPermitted(e,id,hero,d.enemies,now);d.update(now,100,hero,budget);l.step(100,budget);
     for(const e of d.enemies)if(e.hp>0&&e.attack)shots.launch(e.attack,e,now);
     const targets=[...s.defense.guards.filter((g:any)=>!g.dead&&(g.space??'village')==='village'),...d.civilianTargets?.()??[],...d.facilityTargets?.()??[]];
     for(const contact of shots.update(now,{x:-10000,y:-10000},clearMeleeLine,targets)){const source=d.enemies.find((e:any)=>e.id===contact.attack.attackerId),shot=shots.shots.find((shot:any)=>shot.id===contact.projectileId);if(source&&shot){if(s.defense.guards.some((g:any)=>g.id===contact.targetId))d.damageGuard({sourceId:source.id,targetId:contact.targetId,attackId:contact.attack.attackId,amount:contact.attack.damage,sourceType:'enemy-shot',eventId:shot.released.eventId},source,shot.released);else d.civilianContact?.(contact.targetId,source,contact,shot.released);}shots.settle(contact.projectileId,now,false);}
     l.consumeDefense(d.drainNotices());
    }
    records.push({版本:legacy?'旧版':'新版',编队人数:count,日期:day,完成事件:s.defense.completedSequence-before,守卫死亡:s.defense.guards.filter((g:any)=>g.dead).length,守卫总生命:s.defense.guards.reduce((n:number,g:any)=>n+g.hp,0),居民倒地:s.life.people.filter((n:any)=>n.body?.health==='down').length,设施完整度:s.life.facilities,玩家收益:{金币:s.coins,掉落:s.pendingDrops.length}});
    expect(s.defense.raid).toBeNull();expect(s.defense.guards.filter((g:any)=>g.dead)).toHaveLength(0);
   }
  }}finally{syncMapGeometry(false);oldWorld.syncMapGeometry(false);}
  writeFileSync('.wave-combat-local/night-defense-comparison.json',JSON.stringify({说明:'三只小编队与八只扩编普通夜袭分别推进五个完整世界日；沿正式防务与居民生活系统推进，不加玩家伤害。未模拟随机安静夜晚、当前用户村庄或十只混合报复。',记录:records},null,2));
 },240000);
 it('旅途备份经正式迁移保持关键字段，生成独立导入副本',()=>{const raw=JSON.parse(readFileSync('.wave-combat-local/journey-backup.json','utf8')),s=parseSave(JSON.stringify(raw));for(const field of ['bag','coins','quest','killed','pendingDrops','defense','skills','xiaobao','windGifts'])expect(s[field as 'bag']).toEqual(raw[field]);writeFileSync('.wave-combat-local/journey-copy.json',JSON.stringify({...s,说明:'当前旅途的独立本地验收副本，原始导出位于journey-backup.json；不代表原存档原地升级。'},null,2));});
});
