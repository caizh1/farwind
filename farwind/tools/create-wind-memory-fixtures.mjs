// 独立验收初始条件；不访问用户浏览器存档，不把预设战斗阶段计作正常通关。
import {createServer} from 'vite';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try {
 const {parseSave,validate,add}=await server.ssrLoadModule('/src/game/systems/state.ts');
 const {startWindMemory,endWindMemory}=await server.ssrLoadModule('/src/game/systems/windMemory.ts');
 const {activateAdventure,settleEncounterDeath,encounterDefinitions}=await server.ssrLoadModule('/src/game/systems/encounterState.ts');
 const {ADVENTURE_ROUTES,ENCOUNTERS,encounterUnit}=await server.ssrLoadModule('/src/data/maps/windbell/encounters.ts');
 const {initialBossBattle}=await server.ssrLoadModule('/src/game/systems/campBossState.ts');
 const {syncMapGeometry}=await server.ssrLoadModule('/src/data/world.ts');syncMapGeometry(false);
 const {motionBlocked}=await server.ssrLoadModule('/src/game/systems/obstacles.ts');
 const out='docs/wind-memory/evidence';await mkdir(out,{recursive:true});
 const original=await readFile('docs/combat-v2/evidence/four-camps-exported-save.json','utf8');
 for(const [name,level,direction,bossOnly] of [['low',1,'north',false],['high',20,'north',false],['boss',5,'east',true],['preview',1,'north',null]]) {
  let s=parseSave(original);const route=ADVENTURE_ROUTES[direction],camp=ENCOUNTERS.find(d=>d.id===route[4]);Object.assign(s.player,{x:camp.x,y:camp.y});
  for(let i=0;i<level;i++){s=startWindMemory(s,direction,1234);if(i+1<level)s=endWindMemory(s);}
  // 配备基础剑风与药剂，所有招式、伤害和存读档由正式运行系统产生。
  s.player.hp=100;s.player.swordWindStage=1;add(s,'potion',40);s.windGifts.pending=[];
  if(bossOnly===null)s=endWindMemory(s);
  else if(bossOnly){
   const data=s.windMemory.active.encounters;
   for(const id of route){activateAdventure(data,id);for(const m of [...data.groups[id].members])if(!encounterUnit(m.id)?.boss)settleEncounterDeath(data,m.id,false);}
   const g=data.groups[camp.id],m=encounterDefinitions(data,camp).find(m=>m.boss);g.boss={stage:'battle',warning:0,attempt:0,away:0,combat:{battle:initialBossBattle(0,true),attack:null,hazards:[],shots:[],stagger:0,parried:null}};
   Object.assign(s.player,[{x:m.x-250,y:m.y},{x:m.x,y:m.y+250},{x:m.x+250,y:m.y}].find(p=>!motionBlocked(p.x,p.y)));
  } else {const d=ENCOUNTERS.find(d=>d.id===route[0]);Object.assign(s.player,[{x:d.x,y:d.y+100},{x:d.x+80,y:d.y},{x:d.x-80,y:d.y}].find(p=>!motionBlocked(p.x,p.y)));}
  await writeFile(`${out}/${name}.json`,JSON.stringify(validate(s),null,2));
 }
 console.log('四个独立样本已通过正式存档校验。');
} finally {await server.close();}
