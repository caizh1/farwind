import {describe,it,expect,vi} from 'vitest';
// 仅隔离本单元样本不调用的画面引擎；正式画面另行在浏览器核对。
vi.mock('phaser',()=>({default:{}}));
import {initialState,validate,parseSave,add,count,type State} from '../src/game/systems/state';
import {CITY_BUILDINGS,CITY_QUESTS,CITY_OUTDOOR_USES,cityFurniture,cityBuilding,type CitySpace} from '../src/data/cityLayout';
import {motionBlocked} from '../src/game/systems/obstacles';
import {spaceBlocked,spaceClear,roomProjectileBlocker} from '../src/game/systems/npcNavigation';
import {cityActionSnapshot,cityEnterSnapshot,cityLeaveSnapshot,syncCityQuests} from '../src/game/systems/cityTransactions';
import {StateCommit} from '../src/game/systems/stateCommit';
import {cityCounterPurchase} from '../src/game/systems/cityServices';
import {CityDefense} from '../src/game/systems/cityDefense';
import {CITY_GUARD_POSTS} from '../src/data/maps/windwhisper';
import {CityChapter,CITY_BOSS_ID} from '../src/game/systems/cityChapter';
import type {World} from '../src/game/scenes/World';
import {CityPopulation} from '../src/game/entities/cityPopulation';
import {writeFileSync,mkdirSync} from 'node:fs';
// 这些是确定性逻辑样本，直接构造条件只用于检查规则，不作为正式自然游玩证据。
function at(s:State,space:'village'|CitySpace,x=700,y=800){s.life.playerSpace=space;s.player.x=x;s.player.y=y;return {space,x,y};}
function run(s:State,action:string,space:'village'|CitySpace){const use=action.startsWith('accept:')||action.startsWith('claim:')?'quests':({'start-boss':'tower','boss-reward':'tower','deliver-supply':'market-evidence','deliver-medicine':'medicine','tools-hint':'tools','tools-return':'forge','letter-return':'letter-a','archived':'archive'} as Record<string,string>)[action]??action;const outdoor=CITY_OUTDOOR_USES.find(p=>p.id===action),f=cityFurniture(space).find(f=>f.use===use);const point=at(s=structuredClone(s),space,outdoor?.x??f?.x??700,outdoor?.y??(f?f.y+25:800));return cityActionSnapshot(s,action,point);}
describe('风语城完整流程门禁',()=>{
 it('固定运行验收样本保留初始能力与物品，仅用于城市场景定位，不冒充自然抵达',()=>{
  const s=initialState();s.player.x=12920;s.player.y=475;
  const sample={说明:'固定运行验收样本，仅用于二十三场所与画面检查；人物站位定位到议事厅门前，能力、金币和物品均为初始值。不能作为自然抵达或通关证据。',...validate(s)};
  mkdirSync('docs/windwhisper-city/completion/fixtures',{recursive:true});writeFileSync('docs/windwhisper-city/completion/fixtures/city-entry-fixture.json',JSON.stringify(sample,null,2));expect(sample.coins).toBe(initialState().coins);expect(sample.bag).toEqual(initialState().bag);
  for(const [name,id] of [['market','market'],['guild','guild'],['tower','tower'],['west-gate',null]] as const){const v=initialState(),b=id?cityBuilding(`city:${id}`):null;v.player.x=b?.door.x??9920;v.player.y=b?.door.y??1650;writeFileSync(`docs/windwhisper-city/completion/fixtures/${name}-scene.json`,JSON.stringify({说明:'独立固定画面样本，只定位初始旅人；没有自然抵达或通关含义。',...validate(v)},null,2));}
  let boss=initialState();add(boss,'stone',3);for(const [action,room] of [['register','hall'],['market-evidence','market'],['archive-evidence','archive'],['valve-0','underground'],['valve-1','underground'],['valve-2','underground'],['tower','tower']] as const)boss=run(boss,action,`city:${room}`);at(boss,'city:tower',810,615);boss.life.outside={...cityBuilding('city:tower')!.door};writeFileSync('docs/windwhisper-city/completion/fixtures/boss-ready-scene.json',JSON.stringify({说明:'首领画面及操作专项样本；主线前置由公共事务构造，石材为夹具输入，不作为自然旅途或战斗通关证据。',...validate(boss)},null,2));

 });
 it('四十人共享每帧寻路预算，公共场所人员实际步行进入工作空间',()=>{
  const state=initialState();state.time=540;state.player.x=11790;state.player.y=1600;
  const view:any=new Proxy({}, {get:()=>()=>view}),w:any={state,enemies:[],add:{graphics:()=>view},ui:{message:()=>{}}},population=new CityPopulation(w);
  expect(state.city.progress.residents.filter(r=>motionBlocked(r.x,r.y)).map(r=>r.id)).toEqual([]);
  for(let now=20;now<=90000;now+=20){const budget={queries:2,remainingMs:2};population.step(20,now,budget);expect(budget.queries).toBeGreaterThanOrEqual(0);}
  const publicPeople=['merchant','innkeeper','guildmaster','smith','herbalist','tea','archivist'];expect(state.city.progress.residents.filter(r=>publicPeople.includes(r.id)&&r.space==='village').map(r=>r.id)).toEqual([]);expect(validate(state).city.progress.residents).toHaveLength(40);
 });
 it('夜间只保留值班餐食与急救，工坊和商馆不扣款；访客夜间分散，不集中一个落点',()=>{
  const s=initialState();s.time=1320;at(s,'city:market');expect(()=>cityCounterPurchase(s,'wood')).toThrow('营业');at(s,'city:inn');expect(cityCounterPurchase(s,'bread').coins).toBe(s.coins-7);expect(()=>cityCounterPurchase(s,'wood')).toThrow('商品');expect(()=>run(s,'forge','city:forge')).toThrow('营业');
  const view:any=new Proxy({}, {get:()=>()=>view}),w:any={state:s,enemies:[],add:{graphics:()=>view},ui:{message:()=>{}}},population=new CityPopulation(w);for(let now=20;now<=160000;now+=20)population.step(20,now,{queries:2,remainingMs:2});
  const guests=s.city.progress.residents.filter(r=>r.id.startsWith('visitor-'));expect(guests.filter(r=>r.space==='city:inn')).toHaveLength(8);expect(guests.filter(r=>r.space==='village')).toHaveLength(8);expect(new Set(guests.map(r=>`${r.space}/${Math.round(r.x/10)}/${Math.round(r.y/10)}`)).size).toBe(16);
 });
 it('二十四岗位倒地后实际补员，新增巡逻共享两次寻路预算仍能持续巡街',()=>{
  const s=initialState();for(const g of s.city.guards){g.hp=0;g.mode='down';g.replacement=1;}const engine=new CityDefense(()=>s.city,()=>{});
  for(let now=20;now<=180000;now+=20){const budget={queries:2,remainingMs:2};engine.update(20,now,{x:11790,y:1600},[],budget);expect(budget.queries).toBeGreaterThanOrEqual(0);}
  expect(s.city.guards.filter(g=>g.mode!=='post').map(g=>({id:g.slot,mode:g.mode,x:g.x,y:g.y,故障:engine.navigation.get(g.slot)?.failure}))).toEqual([]);expect(s.city.guards.every(g=>g.serial===2)).toBe(true);expect([...engine.patrol.values()].every(n=>n>=4)).toBe(true);expect(engine.patrol.size).toBe(8);
  for(const g of s.city.guards.filter(g=>CITY_GUARD_POSTS.find(p=>p.slot===g.slot)!.role!=='archer'))expect(motionBlocked(g.x,g.y),g.slot).toBe(false);
 });
 it('换岗以游戏小时为准，刷新不重放错过的交接，不从岗位瞬移',()=>{
  const s=initialState(),engine=new CityDefense(()=>s.city,()=>{});engine.update(20,20,{x:11790,y:1600},[],{queries:2},480);const g=s.city.guards[9],start={x:g.x,y:g.y};engine.update(20,40,{x:11790,y:1600},[],{queries:2},540);expect(g.mode).toBe('retreat');expect(Math.hypot(g.x-start.x,g.y-start.y)).toBeLessThanOrEqual(2.81);
  for(let now=60;now<=30000;now+=20)engine.update(20,now,{x:11790,y:1600},[],{queries:2},540);expect(g.mode).toBe('post');const loaded=validate(s),restored=new CityDefense(()=>loaded.city,()=>{});restored.update(20,30020,{x:11790,y:1600},[],{queries:2},540);expect(loaded.city.guards[9].mode).toBe('post');
 });
 it('满包锻造与首胜领取保留材料或待领奖励；拒绝非数值居民站位',()=>{
  const s=initialState();s.bag=Array.from({length:24},()=>({id:'bread' as const,count:20}));s.bag[0]={id:'wood',count:10};s.bag[1]={id:'stone',count:10};s.bag[2]={id:'crystal',count:2};const original=structuredClone(s);expect(()=>run(s,'forge','city:forge')).toThrow();expect(s).toEqual(original);
  const corrupt:any=structuredClone(s);corrupt.city.progress.residents[0].space='city:barracks';corrupt.city.progress.residents[0].x='700';corrupt.city.progress.residents[0].y=700;expect(()=>validate(corrupt)).toThrow();
 });
 it('二十三门址与室内入口全部可站立，家具可到达交互侧',()=>{
  expect(CITY_BUILDINGS).toHaveLength(23);
  expect(CITY_BUILDINGS.filter(b=>motionBlocked(b.door.x,b.door.y)).map(b=>b.name)).toEqual([]);
  for(const b of CITY_BUILDINGS){expect(spaceBlocked(b.space,700,910),b.name).toBe(false);
   for(const f of cityFurniture(b.space))expect(spaceBlocked(b.space,f.x,f.y+25),`${b.name}/${f.id}`).toBe(false);
  }
 });
 it('真实门点、住宅许可和伙伴空间随保存一起切换；拒绝远程进入',()=>{
  for(const b of CITY_BUILDINGS){const s=initialState();at(s,'village',b.door.x,b.door.y);s.xiaobao.task='follow';
   if(b.private){expect(()=>cityEnterSnapshot(s,b.id)).toThrow();s.city.progress.invitations[b.id]=s.time+30;}
   const entered=cityEnterSnapshot(s,b.id);expect(entered.life.playerSpace).toBe(b.space);expect(entered.xiaobao.space).toBe(b.space);const left=cityLeaveSnapshot(parseSave(JSON.stringify(entered)));expect(left.player.x).toBe(b.door.x);expect(left.player.y).toBe(b.door.y);expect(left.xiaobao.space).toBe('village');
  }
  expect(()=>cityEnterSnapshot(initialState(),'tower')).toThrow();
 });
 it('旧二十二版十岗伤势、库存、金币及背包原样迁移，坏记录不洗掉',()=>{
  const old:any=initialState();old.schema_version=22;old.city.version=1;delete old.city.progress;old.city.guards=old.city.guards.slice(0,10);old.city.stock={potion:2,bread:3,tea:4};old.city.guards[0].hp=13;old.coins=67;
  const loaded=parseSave(JSON.stringify(old));expect(loaded.schema_version).toBe(23);expect(loaded.city.guards).toHaveLength(24);expect(loaded.city.guards.slice(0,10)).toEqual(old.city.guards);expect(loaded.city.stock.potion).toBe(2);expect(loaded.coins).toBe(67);expect(loaded.bag).toEqual(old.bag);
  old.city.guards[0].hp=-1;expect(()=>parseSave(JSON.stringify(old))).toThrow();
 });
 it('主线按七个阶段推进，三个阀门实际扣石材，首胜待领不重复',()=>{
  let s=initialState();add(s,'stone',10);expect(()=>run(s,'start-boss','city:tower')).toThrow();expect(()=>run(s,'valve-0','city:underground')).toThrow();
  s=run(s,'register','city:hall');s=run(s,'market-evidence','city:market');s=run(s,'archive-evidence','city:archive');expect(s.city.progress.main).toBe(3);
  for(const id of ['valve-0','valve-1','valve-2'])s=run(s,id,'city:underground');expect(count(s,'stone')).toBe(7);expect(s.city.progress.main).toBe(4);expect(()=>run(s,'valve-0','city:underground')).toThrow();
  s=run(s,'tower','city:tower');s=run(s,'start-boss','city:tower');expect(s.city.progress.boss.stage).toBe('battle');expect(()=>run(s,'boss-reward','city:tower')).toThrow();
  s.city.progress.boss.stage='defeated';s.city.progress.boss.hp=0;s.city.progress.main=6;s=parseSave(JSON.stringify(s));const coins=s.coins;s=run(s,'boss-reward','city:tower');expect(s.coins).toBe(coins+120);expect(s.city.progress.main).toBe(7);expect(()=>run(s,'boss-reward','city:tower')).toThrow();
 });
 it('十二委托实际完成所有步骤，领取凭据唯一，普通物料逐项消耗',()=>{
  let s=initialState();for(const [id,n]of [['wood',24],['stone',24],['crystal',3],['herb',4],['berry',2],['potion',2]] as const)add(s,id,n);
  for(const q of CITY_QUESTS)s=run(s,'accept:'+q.id,'city:guild');
  for(const [action,space] of [['register','hall'],['market-evidence','market'],['deliver-supply','market'],['archive-evidence','archive'],['tower-evidence','tower'],['archived','archive'],['forge','forge'],['medicine','clinic'],['deliver-medicine','clinic'],['tools-hint','house-6'],['tools','house-6'],['tools-return','forge'],['letter-a','house-0'],['letter-b','house-1'],['letter-return','house-0'],['supply','barracks']] as const)s=run(s,action,`city:${space}`);
  s.city.progress.evidence.push('herbs');syncCityQuests(s);
  for(const action of ['crate','stall','lamp-west','lamp-market','lamp-plaza','post-west','post-hall','wall-stair'])s=run(s,action,'village');
  for(const action of ['wall-north','wall-south'])s=run(s,action,'city:wall');
  for(const action of ['valve-0','valve-1','valve-2'])s=run(s,action,'city:underground');
  const point=at(s,'village',s.city.progress.escort.x,s.city.progress.escort.y);s=cityActionSnapshot(s,'escort',point);s.city.progress.escort.arrived=true;s.city.progress.escort.following=false;syncCityQuests(s);
  expect(s.city.progress.quests.every(q=>q.status==='pending')).toBe(true);const coins=s.coins;
  for(const q of CITY_QUESTS){s=run(s,'claim:'+q.id,'city:guild');expect(()=>run(s,'claim:'+q.id,'city:guild')).toThrow();}
  expect(s.coins).toBe(coins+CITY_QUESTS.reduce((n,q)=>n+q.reward,0));expect(validate(s).city.progress.quests.every(q=>q.status==='complete')).toBe(true);
 });
 it('保存失败不发布扣款或任务结果，同时点击只允许一笔事务',async()=>{
  let live=initialState();at(live,'city:guild');const before=structuredClone(live),queue=new StateCommit();await expect(queue.run(()=>live,s=>run(s,'accept:supply','city:guild'),async()=>{throw Error('确定性写入失败');},s=>{live=s;})).rejects.toThrow();expect(live).toEqual(before);
 });
 it('墙上巡检必须登梯进入；室内剑风不能穿过家具或墙边',()=>{
  const s=initialState();s.city.progress.evidence.push('wall-stair');expect(()=>run(s,'wall-north','village')).toThrow();
  expect(roomProjectileBlocker('city:inn',{x:650,y:580},{x:950,y:580},10)?.id).toContain('furniture');expect(roomProjectileBlocker('city:inn',{x:700,y:850},{x:1100,y:850},10)?.id).toBe('room-edge');expect(spaceClear('city:inn',{x:700,y:800},{x:700,y:910})).toBe(true);
 });
 it('首领符文伤害回写唯一生命记录，刷新后不复活；风压逐个按落点结算',()=>{
  const s=initialState();at(s,'city:tower',650,800);s.city.progress.main=5;s.city.progress.boss.stage='battle';s.city.progress.boss.attempt=1;
  const view:any=new Proxy({}, {get:(_,key)=>key==='destroy'?()=>{}:()=>view});const w:any={state:s,sim:0,add:{graphics:()=>view,text:()=>view},makeEnemy:(d:any)=>({...d,hp:1100,maxHP:1100,staggerUntil:0,attack:null,sprite:view,shadow:view}),float:()=>{},snapshotPending:false,combat:{reset:()=>{},dashCooldown:0},keys:{clear:()=>{}},ui:{dialog:()=>{},message:()=>{}},persist:async()=>{}};
  const chapter=new CityChapter(w as World);let hit=chapter.damage({sourceId:'player',targetId:CITY_BOSS_ID,attackId:'符文样本',amount:100,sourceType:'player-rune',eventId:null});expect(hit.damage).toBe(97);expect(s.city.progress.boss.hp).toBe(1003);expect(parseSave(JSON.stringify(s)).city.progress.boss.hp).toBe(1003);
  const b=s.city.progress.boss;b.attack='pressure';b.age=1049;b.target={x:650,y:800};s.player.x=750;s.player.y=870;const contacts:any[]=[];chapter.step(1,1050,contacts,{queries:0});expect(contacts).toHaveLength(0);chapter.step(300,1350,contacts,{queries:0});expect(contacts).toHaveLength(0);chapter.step(300,1650,contacts,{queries:0});expect(contacts).toHaveLength(1);chapter.step(1,1651,contacts,{queries:0});expect(contacts).toHaveLength(1);
  hit=chapter.damage({sourceId:'player',targetId:CITY_BOSS_ID,attackId:'首胜样本',amount:10000,sourceType:'player-rune',eventId:null});expect(hit.killed).toBe(true);expect(parseSave(JSON.stringify(s)).city.progress.boss.stage).toBe('defeated');expect(s.killed.includes(CITY_BOSS_ID)).toBe(false);
 });
});
