// 仅定义独立验收起点，全部战斗使用正式导入入口和键鼠。
import {createServer} from 'vite';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {validate}=await server.ssrLoadModule('/src/game/systems/state.ts');
 const {initialEncounters,activateAdventure,settleEncounterDeath}=await server.ssrLoadModule('/src/game/systems/encounterState.ts');
 const {ADVENTURE_ROUTES,encounterUnit}=await server.ssrLoadModule('/src/data/maps/windbell/encounters.ts');
 const {initialBossBattle}=await server.ssrLoadModule('/src/game/systems/campBossState.ts');
 const {syncMapGeometry}=await server.ssrLoadModule('/src/data/world.ts');syncMapGeometry(false);
 const {motionBlocked,clearMeleeLine}=await server.ssrLoadModule('/src/game/systems/obstacles.ts');
 const original=JSON.parse(await readFile('docs/wind-memory/evidence/boss.json','utf8')),out='docs/east-boss-tier-five/fixtures';await mkdir(out,{recursive:true});
 for(const name of ['summon','vine','vine-two','vine-far','vine-wall','vine-simple','vine-six','duo','duo-relocated','duo-death','black-hole','level-four','level-six','clone-parry',...Array.from({length:8},(_,i)=>'vine-dir-'+i)]){
  const s=structuredClone(original);
  // 原样本为第五档；第四、六档使用一致的正式难度快照与成员生命上限。
  const level=name==='level-four'?4:['level-six','vine-six'].includes(name)?6:5;
  s.windMemory.counts.east=level;s.windMemory.active.encounters=initialEncounters(s.windMemory.active.seed,`memory:${s.windMemory.serial}`,{version:1,level});const data=s.windMemory.active.encounters;for(const id of ADVENTURE_ROUTES.east){activateAdventure(data,id);for(const m of [...data.groups[id].members])if(!encounterUnit(m.id)?.boss)settleEncounterDeath(data,m.id,false);}const g=data.groups['east-thorn-camp'],m=g.members.find(m=>m.id.endsWith('|boss-bound-branch'));
  s.catBond.score=0;s.windGifts.held=[{id:'armor',level:20}];s.windGifts.pending=[];s.skills.swordWindStage=1;s.skills.legacySwordWind=true;
  Object.assign(s.player,{hp:100,stamina:100,x:3710,y:1350});
  Object.assign(m,{hp:2500*(1+level*.18),x:3710,y:1100,face:{x:0,y:1},serial:0});
  const b=initialBossBattle(0);Object.assign(b,{nextAt:1800,move:name.startsWith('vine')?8:name==='level-four'?0:-1,part:0,cooldowns:Array(level>=5?9:7).fill(0)});
  const c={battle:b,attack:null,hazards:[],shots:[],stagger:0,parried:null};g.boss={stage:'battle',warning:0,attempt:0,away:0,combat:c};
  if(['summon','black-hole'].includes(name))m.hp=m.hp*.74;
  if(name==='vine-two'){b.phase=2;m.hp=m.hp*.54;b.cloneUsed=true;}
  if(name.startsWith('vine-dir-')){const d=Number(name.at(-1));Object.assign(s.player,{x:3710+Math.sin(d*Math.PI/4)*200,y:1100+Math.cos(d*Math.PI/4)*200});}
  if(name==='vine-far'){s.player.x=3710;s.player.y=1850;}
  if(name==='vine-wall'){s.player.x=3400.795818654905;s.player.y=846.2426863345419;}
  if(name==='vine-simple')s.runes.settings={simple:true,lowFlash:true};
  if(name.startsWith('duo')||name==='clone-parry'){b.cloneUsed=true;const cb=initialBossBattle(0);cb.nextAt=1800;const p=[{x:3950,y:1100},{x:3490,y:1100},{x:3710,y:1400}].find(p=>!motionBlocked(p.x,p.y)&&clearMeleeLine(m,p));c.clone={id:m.id+':clone:0:0',hp:m.hp,...p,serial:0,face:{x:0,y:1},combat:{battle:cb,attack:null,hazards:[],shots:[],stagger:0,parried:null}};if(name==='duo-death'){m.hp=1;b.move=3;}if(name==='clone-parry'){b.nextAt=15000;cb.move=0;Object.assign(s.player,{x:p.x,y:p.y+110});}}
  if(name==='duo-relocated'){s.player.x=3710;s.player.y=1100;m.y=900;c.clone.y=900;}
  if(name==='black-hole')s.windGifts.held.push({id:'blackHole',level:6},{id:'riftSuction',level:5},{id:'riftDuration',level:3});
  await writeFile(`${out}/${name}.json`,JSON.stringify(validate(s),null,2));
 }
 await writeFile(`${out}/README.md`,'# 独立初始样本\n\n通过正式导入菜单载入。基础风步无减耗、无体力恢复风赐，护甲仅延长观察时间。双实体与残血样本用于生命周期验证，不计作自然旅途通关。未访问或覆盖玩家 5173 存档。\n');
 console.log('第五档及边界专项初始样本全部通过校验。');
}finally{await server.close();}
