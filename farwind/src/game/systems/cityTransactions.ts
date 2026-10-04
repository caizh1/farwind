import {CITY_BUILDINGS,CITY_QUESTS,CITY_OUTDOOR_USES,cityBuilding,cityFurniture} from '../../data/cityLayout';
import {MAX_COINS} from '../../data/economy';
import {validate,count,remove,add,craft,type State} from './state';
import {cityBusinessOpen} from './cityServices';
import {playerVitals} from './journeyTraining';
import type {SleepSafety} from './sleep';
import {type CitySpace} from '../../data/cityLayout';
export type CityUsePoint={space:'village'|CitySpace;x:number;y:number};
export function cityAt(s:State,p:CityUsePoint){if(s.life.playerSpace!==p.space||Math.hypot(s.player.x-p.x,s.player.y-p.y)>=95)throw Error('请先到对应门口或设施旁，不能隔空间办理。');}
export const CITY_STEP_EVIDENCE:Record<string,string[]>={supply:['market-evidence','supplied'],escort:['escort-start','escort-arrived'],stall:['crate','stall'],forge:['forged'],medicine:['herbs','medicine','delivered-medicine'],tools:['tools-hint','tools','tools-return'],lamps:['lamp-west','lamp-market','lamp-plaza'],letter:['letter-a','letter-b','letter-return'],wall:['wall-stair','wall-north','wall-south'],relief:['supply','post-west','post-hall'],valves:['valve-0','valve-1','valve-2'],pages:['archive-evidence','market-evidence','tower-evidence','archived']};
export function syncCityQuests(s:State){const p=s.city.progress;for(const q of p.quests){if(q.status!=='active')continue;const d=CITY_QUESTS.find(d=>d.id===q.id)!;q.steps=d.steps.filter((_,i)=>{const key=CITY_STEP_EVIDENCE[q.id][i];return key==='escort-start'?p.escort.following||p.escort.arrived:key==='escort-arrived'?p.escort.arrived:p.evidence.includes(key);});if(q.steps.length===d.steps.length)q.status='pending';}}
function evidence(s:State,key:string){const p=s.city.progress;if(!p.evidence.includes(key))p.evidence.push(key);syncCityQuests(s);}
function material(s:State,id:Parameters<typeof remove>[1],n:number){if(count(s,id)<n||!remove(s,id,n))throw Error(`材料不足，需要${id==='wood'?'木材':id==='stone'?'石材':id==='crystal'?'风之结晶':id==='potion'?'药剂':id}×${n}，未扣材料。`);}
export function cityActionSnapshot(state:State,action:string,point:CityUsePoint,safety?:SleepSafety):State{
 cityAt(state,point);const s=validate(state),p=s.city.progress;
 const outdoor=CITY_OUTDOOR_USES.find(u=>u.id===action);
 if(outdoor)cityAt(s,{space:'village',x:outdoor.x,y:outdoor.y});
 else if(action!=='escort'){
  const use=action.startsWith('accept:')||action.startsWith('claim:')?'quests':({'start-boss':'tower','boss-reward':'tower','deliver-supply':'market-evidence','deliver-medicine':'medicine','tools-hint':'tools','tools-return':'forge','letter-return':'letter-a','archived':'archive'} as Record<string,string>)[action]??action;
  const facilities=cityFurniture(s.life.playerSpace).filter(f=>f.use===use);
  const hinted=action==='tools-hint'&&p.residents.some(r=>r.id==='apprentice-a'&&r.space===s.life.playerSpace&&Math.hypot(r.x-s.player.x,r.y-s.player.y)<95);
  if(!hinted&&!facilities.some(f=>Math.hypot(f.x-s.player.x,f.y+25-s.player.y)<95))throw Error('请先走到对应实物或登记处旁操作。');
 }
 if(action.startsWith('accept:')||action.startsWith('claim:')){const [kind,id]=action.split(':'),q=p.quests.find(q=>q.id===id),d=CITY_QUESTS.find(q=>q.id===id);if(s.life.playerSpace!=='city:guild'||!q||!d)throw Error('请到行会登记有效委托。');
  if(kind==='accept'){if(q.status!=='unaccepted')throw Error('委托已登记。');q.status='active';syncCityQuests(s);}
  else{if(q.status!=='pending'||q.receipt)throw Error('委托尚未完成或已经领奖。');if(s.coins+d.reward>MAX_COINS)throw Error('金币达到上限，奖励仍待领取。');s.coins+=d.reward;q.receipt=`city:${id}:1`;q.status='complete';}
 }else if(action==='sleep'){
  if(s.life.playerSpace!=='city:inn'||!safety||Object.values(safety).some(Boolean)||p.alarm==='battle')throw Error('请在安全的驿站客房住宿。');
  if(s.coins<12)throw Error('住宿需要十二金币。');s.coins-=12;s.time=(Math.floor(s.time/1440)+1)*1440+480;const v=playerVitals(s);s.player.hp=v.maxHp;s.player.stamina=v.maxStamina;
 }else if(action==='forge'){
  if(s.life.playerSpace!=='city:forge')throw Error('请到锻造坊。');if(!cityBusinessOpen(s))throw Error('锻造坊七点至二十点营业。');material(s,'wood',4);material(s,'stone',4);material(s,'crystal',1);if(!add(s,'ironSword',1))throw Error('行囊没有成品空间，未扣材料。');evidence(s,'forged');
 }else if(action==='medicine'){
  if(s.life.playerSpace!=='city:clinic')throw Error('请到药坊。');if(!craft(s))throw Error('需要药草两份、浆果一份与成品空间，未扣材料。');evidence(s,'medicine');
 }else if(action==='deliver-supply'){
  if(s.life.playerSpace!=='city:market'||p.evidence.includes('supplied'))throw Error('请核对商馆货单，材料已经交付时无需重复送货。');material(s,'wood',4);material(s,'stone',3);evidence(s,'supplied');
 }else if(action==='deliver-medicine'){
  if(s.life.playerSpace!=='city:clinic'||p.evidence.includes('delivered-medicine'))throw Error('请到药坊交付一次药剂。');material(s,'potion',2);evidence(s,'delivered-medicine');
 }else if(action==='escort'){
  if(p.quests.find(q=>q.id==='escort')?.status!=='active'||s.life.playerSpace!=='village'||Math.hypot(s.player.x-p.escort.x,s.player.y-p.escort.y)>=95)throw Error('请先登记委托，再到西门外与迟到行商集合。');p.escort.following=true;
 }else if(action==='start-boss'){
  if(s.life.playerSpace!=='city:tower'||p.main!==5||p.boss.stage!=='idle')throw Error('先完成入城登记、商馆异常、档案调查、地下三阀维修和风塔蓄能。');p.boss={...p.boss,stage:'battle',hp:1100,age:0,serial:p.boss.serial+1,hit:false,attempt:p.boss.attempt+1,target:{x:s.player.x,y:s.player.y}};
 }else if(action==='boss-reward'){
  if(s.life.playerSpace!=='city:tower'||p.boss.stage!=='defeated')throw Error('首胜尚未结算或已经领取。');if(s.coins+120>MAX_COINS||!add(s,'crystal',3))throw Error('行囊或金币空间不足，首胜奖励保留待领。');s.coins+=120;p.boss.stage='claimed';p.main=7;
 }else{
  const allowed:Record<string,string>= {'register':'hall','market-evidence':'market','archive-evidence':'archive','tower-evidence':'tower','tower':'tower','valve-0':'underground','valve-1':'underground','valve-2':'underground','supply':'barracks','tools-hint':'house-6','tools':'house-6','tools-return':'forge','letter-a':'house-0','letter-b':'house-1','letter-return':'house-0','archived':'archive'};
  if(allowed[action]&&s.life.playerSpace!==`city:${allowed[action]}`)throw Error('请到对应设施操作。');
  if(action==='register'){evidence(s,'registered');p.main=Math.max(p.main,1);}
  else if(action==='market-evidence'){evidence(s,action);if(p.main===1)p.main=2;}
  else if(action==='archive-evidence'){evidence(s,action);if(p.main===2)p.main=3;}
  else if(action==='tower-evidence'){evidence(s,action);}
  else if(action==='tower'){if(p.main!==4)throw Error('请先完成地下三处风阀维护。');p.main=5;}
  else if(action.startsWith('valve-')){if(p.evidence.includes(action))throw Error('这处风阀已经修好。');if(p.main<3)throw Error('先登记城案并阅读档案维护记录。');material(s,'stone',1);evidence(s,action);if([0,1,2].every(i=>p.evidence.includes(`valve-${i}`))&&p.main===3)p.main=4;}
  else if(action.startsWith('lamp-')){if(s.life.playerSpace!=='village'||p.evidence.includes(action))throw Error('灯点已修复或不在街道。');material(s,'wood',1);evidence(s,action);}
  else if(action==='stall'){if(!p.evidence.includes('crate'))throw Error('先调查误放的货箱。');evidence(s,action);}
  else if(action==='tools'){if(!p.evidence.includes('tools-hint'))throw Error('先向阿铎询问工具。');evidence(s,action);}
  else if(action==='tools-return'){if(!p.evidence.includes('tools'))throw Error('先找回工具。');evidence(s,action);}
  else if(action==='letter-return'){if(!p.evidence.includes('letter-a')||!p.evidence.includes('letter-b'))throw Error('先访问周婶和陆伯，调查两份实物。');evidence(s,action);}
  else if(action==='post-west'||action==='post-hall'){if(!p.evidence.includes('supply'))throw Error('先从兵营领取换岗补给。');evidence(s,action);}
  else if(action==='wall-north'||action==='wall-south'){if(s.life.playerSpace!=='city:wall'||!p.evidence.includes('wall-stair'))throw Error('先从内侧梯道进入巡检步道。');evidence(s,action);}
  else if(action==='archived'){if(!['archive-evidence','market-evidence','tower-evidence'].every(k=>p.evidence.includes(k)))throw Error('三处档案证据尚未集齐。');evidence(s,action);}
  else if(['supply','tools-hint','letter-a','letter-b','crate','wall-stair'].includes(action))evidence(s,action);
  else throw Error('城市操作无效。');
 }
 syncCityQuests(s);s.economyRevision++;return validate(s);
}
export function cityEnterSnapshot(state:State,id:string):State{
 const b=cityBuilding(`city:${id}`);if(!b)throw Error('房屋或梯道未登记。');cityAt(state,{space:'village',...b.door});const s=validate(state),p=s.city.progress;
 if(b.private&&(p.invitations[b.id]??0)<s.time)throw Error('请先敲门获得拜访许可；私人物品仍不可取用。');
 s.life.outside={...b.door};s.life.playerSpace=b.space;Object.assign(s.player,{x:700,y:910});s.city.visited=true;
 if(s.xiaobao.task==='follow'){s.xiaobao.space=b.space;Object.assign(s.xiaobao,{x:655,y:910,flight:null,cast:null,command:null,wait:null,effects:[],support:null});}return validate(s);
}
export function cityLeaveSnapshot(state:State):State{
 const s=validate(state),b=cityBuilding(s.life.playerSpace);if(!b)throw Error('不在城市房间内。');
 s.life.playerSpace='village';Object.assign(s.player,b.door);s.life.outside={...b.door};
 if(s.xiaobao.task==='follow'){s.xiaobao.space='village';Object.assign(s.xiaobao,{x:b.door.x+40,y:b.door.y+20,flight:null,cast:null,command:null,wait:null,effects:[],support:null});}return validate(s);
}
