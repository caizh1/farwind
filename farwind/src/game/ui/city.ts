import {merchantDefinition} from '../../data/merchantRoad';
import {CITY_BUILDINGS,CITY_CITIZENS,CITY_QUESTS,CITY_LAMPS,CITY_OUTDOOR_USES,CITY_MAIN_HINTS,cityBuilding,cityFurniture,isCitySpace} from '../../data/cityLayout';
import {CITY_STOCK,CITY_PRICES} from '../../data/maps/windwhisper';
import {items} from '../../data/content';
import type {World} from '../scenes/World';
import type {Prop} from '../../data/world';
import {save} from '../systems/save';
import {validate,count} from '../systems/state';
import {cityCounterPurchase,cityBusinessOpen,restCityRoad} from '../systems/cityServices';
import {cityAt,cityActionSnapshot,cityEnterSnapshot,cityLeaveSnapshot,type CityUsePoint} from '../systems/cityTransactions';
import {transition} from './npcLife';
const mainHints=CITY_MAIN_HINTS;
const outdoor=(id:string,label:string,x:number,y:number):Prop=>({id,label,x,y,art:'',w:0,h:0,kind:'sign'});
export function cityTargets(w:World):Prop[]{
 const s=w.state,space=s.life.playerSpace,p=s.city.progress;
 const residents=p.residents.filter(r=>r.space===space&&r.id!=='captain'&&!merchantDefinition(r.id)).map(r=>({id:`city-resident:${r.id}`,label:CITY_CITIZENS.find(c=>c.id===r.id)?.name??'来访旅客',x:r.x,y:r.y,kind:'npc' as const,art:'',w:0,h:0}));
 if(space==='village')return [...residents,...CITY_BUILDINGS.map(b=>outdoor(`city-door:${b.id}`,`${b.name} · ${b.private?'敲门／拜访':'进入'}`,b.door.x,b.door.y)),...CITY_OUTDOOR_USES.map(p=>outdoor(`city-use:${p.id}`,p.label,p.x,p.y)),...(p.quests.find(q=>q.id==='escort')?.status==='active'&&!p.escort.arrived?[outdoor('city-use:escort','迟到行商 · 集合',p.escort.x,p.escort.y)]:[])];
 if(!isCitySpace(space))return [];
 return [...residents,...cityFurniture(space).map(f=>outdoor(`city-room:${f.id}`,`${f.text} · 查看／操作`,f.x,f.y+25)),outdoor('city-exit',space==='city:wall'?'沿梯道返回街道':'离开房屋',700,910)];
}
export function cityInteractionComplete(w:World,target:Prop){
 if(!target.id.startsWith('city-door:')&&!target.id.startsWith('city-use:')&&!target.id.startsWith('city-resident:')&&!target.id.startsWith('city-room:')&&target.id!=='city-exit')return false;
 const space=w.state.life.playerSpace,point={space,x:target.x,y:target.y} as CityUsePoint;
 const check=()=>{cityAt(w.state,point);if(!w.clearLine(w.state.player.x,w.state.player.y,point.x,point.y))throw Error('通路受阻，请到设施旁办理。');};
 const commit=async(transform:Parameters<typeof w.economy.run>[1],after?:()=>void)=>{try{check();w.tradeRoad?.capture();await w.economy.run(()=>w.state,transform,save,s=>w.publishState(s));w.cityPopulation?.invalidateRoom();after?.();w.ui.message('城市记录已保存。');}catch(e){w.ui.message((e as Error).message);}};
 const action=(id:string)=>void commit(s=>{const n=cityActionSnapshot(s,id,point,{...w.sleepSafety(),projectile:w.sleepSafety().projectile||!!w.cityDefense?.arrows.length});return id==='wall-stair'?cityEnterSnapshot(n,'wall'):n;},()=>{if(id==='sleep')w.afterSleep();if(id==='wall-stair')transition(w,false);w.ui.close(true);});
 const shell=(title:string,text:string,buttons:[string,string,()=>void][]=[])=>{w.ui.mode='city-service';w.ui.shell(title,`<p>${text}</p>${buttons.map(([id,label])=>`<button id="${id}">${label}</button>`).join('')}<button id="close">返回</button>`);for(const [id,,fn]of buttons)w.ui.button(id,fn);w.ui.button('close',()=>w.ui.close(true));};
 const quests=()=>{
  w.ui.mode='city-service';
  const cards=CITY_QUESTS.map(d=>{const q=w.state.city.progress.quests.find(q=>q.id===d.id)!;const status=q.status==='unaccepted'?'未接':q.status==='active'?'进行中':q.status==='pending'?'待领':'已完成';const button=q.status==='unaccepted'?`<button id="accept-${d.id}">登记：${d.name}</button>`:q.status==='pending'?`<button id="claim-${d.id}">领取：${d.name} · ${d.reward}金币</button>`:'';
   return `<article class="city-quest-card"><div class="city-quest-heading"><h2>${d.name}</h2><span>${status}</span></div><p>${d.steps.map(step=>(q.steps.includes(step)?'✓ ':'· ')+step).join('<br>')}</p><small>谢礼 ${d.reward} 金币</small>${button}</article>`;}).join('');
  w.ui.shell('商旅行会 · 委托登记',`<p>${mainHints[w.state.city.progress.main]}。</p><p class="city-materials">木材 ${count(w.state,'wood')} · 石材 ${count(w.state,'stone')} · 结晶 ${count(w.state,'crystal')} · 药剂 ${count(w.state,'potion')}</p><div class="city-quest-grid">${cards}</div><button id="close">返回</button>`);
  for(const d of CITY_QUESTS){const q=w.state.city.progress.quests.find(q=>q.id===d.id)!;if(q.status==='unaccepted')w.ui.button(`accept-${d.id}`,()=>action('accept:'+d.id));else if(q.status==='pending')w.ui.button(`claim-${d.id}`,()=>action('claim:'+d.id));}
  w.ui.button('close',()=>w.ui.close(true));
 };
 const service=()=>{const room=w.state.life.playerSpace;if(room==='city:market'&&!cityBusinessOpen(w.state)){shell('市场商馆 · 已收柜','七点至二十点营业；夜间餐食请到驿站或茶馆，急救请到药坊。');return;}const goods=(room==='city:market'?Object.keys(CITY_STOCK):room==='city:clinic'?['potion','herb','berry']:['bread','tea','potion']) as (keyof typeof CITY_STOCK)[];
 shell(`${cityBuilding(room)?.name??'风语城'} · 补给柜台`,`${room==='city:market'?'营业时间七点至二十点':'夜间值班服务继续营业'}。<br>`+goods.map(i=>`${items[i].name}：${CITY_PRICES[i]}金币 · 库存${w.state.city.stock[i]}`).join('<br>'),goods.map(i=>[`buy-${i}`,`购买${items[i].name}`,()=>void commit(s=>{cityAt(s,point);return cityCounterPurchase(s,i);},service)]));};
 if(target.id==='city-exit'){void commit(cityLeaveSnapshot,()=>{transition(w,false);w.ui.close(true);});return true;}
 if(target.id.startsWith('city-door:')){
  const b=CITY_BUILDINGS.find(b=>b.id===target.id.slice(10))!;
  if(w.sleepSafety().action||w.state.city.progress.boss.stage==='battle'&&space==='city:tower'){w.ui.message('请先收招或结束挑战，再切换房间。');return true;}
  if(b.private&&(w.state.city.progress.invitations[b.id]??0)<w.state.time){shell(b.name,'住户回应：欢迎拜访。许可持续半小时，床铺与储物仍归住户。', [['knock','敲门取得拜访许可',()=>void commit(s=>{const n=validate(s);n.city.progress.invitations[b.id]=n.time+30;n.economyRevision++;return n;},()=>w.ui.close(true))]]);}
  else void commit(s=>cityEnterSnapshot(s,b.id),()=>{transition(w,false);w.ui.close(true);});return true;
 }
 if(target.id.startsWith('city-use:')){const id=target.id.slice(9);if(id.startsWith('closed-')){shell(target.label!,'城防封闭的预留城门。外部区域尚未开放，请从西门往返已建成的商路与原野。');return true;}if(id==='board'){shell('城市公示板',`${mainHints[w.state.city.progress.main]}。<br>本城十二项委托在西北商旅行会登记和领取；街灯、货箱及岗哨交接需到实物旁完成。`);return true;}shell(target.label!,id.startsWith('lamp')?'维修需要木材一份；修好后夜间灯光会增强。':id==='escort'?'与行商保持三百四十步以内；掉队后回去集合，同行到西门内才算完成。':'到实物旁执行，任务证据随旅途保存。',[[`use-${id}`,'执行并保存',()=>action(id)]]);return true;}
 if(target.id.startsWith('city-resident:')){const c=CITY_CITIZENS.find(c=>c.id===target.id.slice(14)),r=w.state.city.progress.residents.find(r=>r.id===target.id.slice(14))!;
  w.ui.dialog(c?.name??'来访旅客',`${w.state.city.progress.main===7?'风塔重新平稳了，今晚大家会聚在广场庆祝。':mainHints[w.state.city.progress.main]+'。'} ${c?cityBuilding(c.home)!.name:'我从西门入城，打算去市集和广场看看'}。${r.activity==='shelter'?'警报期间先到驿站避难。':''}`,c?c.id==='captain'?'captain':'city-'+c.id:'city-visitor',undefined,{context:'风语城 · '+(c?cityBuilding(c.home)!.name:'赶集旅客'),choices:c?.id==='apprentice-a'&&space==='city:house-6'?[{id:'hint',label:'询问遗失工具',select:()=>action('tools-hint')}]:[]});return true;
 }
 const f=cityFurniture(space).find(f=>f.id===target.id.slice(10));if(!f)return false;
 const use=f.use;
 if(use==='quests'){quests();return true;}
 if(use==='service'){service();return true;}
 const actions:[string,string][]=[];
 if(use==='register')actions.push(['register','登记入城并受理风塔城案']);
 else if(use==='sleep'){shell('候风驿站','住宿恢复到次日早晨，需要十二金币。另可明确休整商路，重新安排六段遭遇，已有风赐、待领候选及城市库存保留。',[['sleep','住宿到次日早晨 · 十二金币',()=>action('sleep')],['rest-road','确认休整商路',()=>void restCityRoad(w)]]);return true;}
 else if(use==='forge'){if(cityBusinessOpen(w.state))actions.push(['forge','锻造铁剑 · 木材4／石材4／结晶1']);actions.push(['tools-return','交还学徒工具']);}
 else if(use==='medicine')actions.push(['medicine','调制药剂 · 药草2／浆果1'],['deliver-medicine','交付两瓶药剂']);
 else if(use==='market-evidence')actions.push([use,'调查风纹封条'],['deliver-supply','交木材四份、石材三份']);
 else if(use==='archive-evidence')actions.push([use,'阅读维护记录']);
 else if(use==='archive')actions.push(['archived','归档三份证据']);
 else if(use==='tower-evidence')actions.push([use,'调查晶座记录']);
 else if(use==='tower'){const p=w.state.city.progress;actions.push([p.boss.stage==='defeated'?'boss-reward':p.main===5?'start-boss':'tower',p.boss.stage==='defeated'?'领取首胜 · 120金币／结晶3':p.main===5?'启动守护装置挑战':'完成风塔蓄能']);}
 else if(use==='tools')actions.push(['tools-hint','询问阿铎的工具'],['tools','调查并带回工具']);
 else if(use==='letter-a')actions.push([use,'调查旧信'],['letter-return','交回旧信']);
  else if(use==='letter-b'||use==='supply'||use?.startsWith('valve-')||use?.startsWith('wall-'))actions.push([use,'调查／执行并保存']);
 shell(cityBuilding(space)!.name,f.text,actions.map(([id,label])=>[`action-${id}`,label,()=>action(id)]));return true;
}
