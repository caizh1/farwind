import {SOUTH_EVENTS,type SouthEventId} from './southEvents';
import {MAX_COINS} from "../../data/economy";
import {VILLAGE_ANCHORS} from "../../data/maps/windbell/layout";
import {campCleared} from "./encounterState";
import {regionalThreat} from "./wildThreat";
import {validate,add,remove,count,type State} from "./state";
import {save} from "./save";
import type {World} from "../scenes/World";
export function southQuestObjective(s:State){
 if(s.fieldQuests["south-supply"]==="available")return "到公共委托簿或药师处领取南路补给委托";
 if(s.fieldQuests["south-supply"]==="complete")return "南路采集恢复，孢根巢地的来袭已停止";
 const boss=s.encounters.groups["south-spore-camp"].boss;
 if(boss?.stage==="warning")return "驻守杂兵已灭，等待孢心巢母入场";
 if(boss?.stage==="battle")return "击败孢心巢母，完成孢根巢地清除";
 return !campCleared(s.encounters,"south-spore-camp")?"沿南门采集道，清理孢根巢地驻守，再击败孢心巢母":count(s,"herb")<2?"采集药草×2，返回药师或公共委托簿":"带药草×2回村，向药师或公共委托簿交付";
}
export function southQuestSnapshot(state:State,action:"accept"|"complete"){
 const s=validate(state),p=s.player,healer=s.life.people.find(p=>p.id==="healer")?.body;
 const ledger=s.life.playerSpace==="village"&&Math.hypot(p.x-VILLAGE_ANCHORS.ledgerApproach.x,p.y-VILLAGE_ANCHORS.ledgerApproach.y)<130;
 const atHealer=healer&&healer.hp>0&&healer.space===s.life.playerSpace&&Math.hypot(p.x-healer.x,p.y-healer.y)<110;
 if(!ledger&&!atHealer)throw Error("请到公共委托簿或药师身边办理。");
 const phase=s.fieldQuests["south-supply"];
 if(action==="accept"){
  if(phase!=="available")throw Error("委托已领取，不会重复发放启程补给。");
  if(!add(s,"potion",2))throw Error("请为两瓶启程药剂腾出行囊空间。");s.fieldQuests["south-supply"]="active";
 }else{
  if(phase!=="active")throw Error(phase==="complete"?"委托已经结算，不会重复发奖。":"请先领取南路补给委托。");
  if(!campCleared(s.encounters,"south-spore-camp"))throw Error("孢根巢地尚未清理，采集路线仍受威胁。");
  if(!remove(s,"herb",2))throw Error("还需要药草×2，未扣除材料。");
  if(!add(s,"potion",2)||s.coins+24>MAX_COINS)throw Error("请腾出奖励空间；材料未扣除。");
  s.coins+=24;s.fieldQuests["south-supply"]="complete";
 }
 return s;
}
export function openSouthQuest(world:World){
 const phase=world.state.fieldQuests["south-supply"],events=(Object.entries(SOUTH_EVENTS) as [SouthEventId,typeof SOUTH_EVENTS[SouthEventId]][]).map(([id,d])=>`${d.name}：${world.state.southEvents[id]>0?d.hint:world.state.southEvents.claimed.includes(id)?"已领取谢礼":"采集已恢复，谢礼可领取"}`).join("\n"),t=regionalThreat(world.state.encounters,"south");
 world.ui.dialog("南路补给",phase==="complete"?"药草已送回，南侧采集恢复。孢根巢地保持清空，卫队不再收到该据点的集结报告。你仍可在湿地采集与探索。":`小满的药草供应断在了南边。沿南门外的石路过芦苇桥，药草洼地在西南岸，孢根巢地在洼地东南方。\n${southQuestObjective(world.state)}\n${t.cleared?"据点已清理，南向压力下降。":"据点仍活跃，附近巡游会再次聚集。"}\n领取时提供药剂×2；完成后交付药草×2，获得药剂×2与金币×24。药师不便接待时，可在公共委托簿办理。\n\n${events}`);
 for(const id of Object.keys(SOUTH_EVENTS) as SouthEventId[]){if(world.state.southEvents[id]>0||world.state.southEvents.claimed.includes(id))continue;
  const reward=document.createElement('button');reward.textContent=`领取${SOUTH_EVENTS[id].name}谢礼 · 金币×12、药剂×1`;world.ui.modal.append(reward);
  reward.onclick=async()=>{if(world.economy.busy||world.defenseSaving)return;reward.disabled=true;
   try{await world.economy.run(()=>world.state,s=>southEventRewardSnapshot(s,id),save,s=>world.publishState(s));openSouthQuest(world);}catch(e){openSouthQuest(world);world.ui.message((e as Error).message);}};
 }
 if(phase==="complete")return;
 const b=document.createElement("button");b.textContent=phase==="available"?"领取委托与启程补给":"交付药草并领取奖励";world.ui.modal.append(b);
 b.onclick=async()=>{
  if(world.economy.busy||world.defenseSaving)return;
  world.defenseSaving=true;world.ui.economyBusy=true;b.disabled=true;
  try{await world.economy.run(()=>world.state,s=>southQuestSnapshot(s,phase==="available"?"accept":"complete"),save,s=>world.publishState(s));world.ui.economyBusy=false;openSouthQuest(world);}
  catch(e){world.ui.economyBusy=false;openSouthQuest(world);world.ui.message((e as Error).message);}
  finally{world.defenseSaving=false;}
 };
}
export function appendSouthQuest(world:World){
 const b=document.createElement("button");b.textContent=world.state.fieldQuests["south-supply"]==="complete"?"南路补给 · 已完成":"委托 · 南路补给";b.onclick=()=>openSouthQuest(world);world.ui.modal.append(b);
}

export function southEventRewardSnapshot(state:State,id:SouthEventId){
 const s=validate(state),p=s.player,healer=s.life.people.find(p=>p.id==='healer')?.body;
 const ledger=s.life.playerSpace==='village'&&Math.hypot(p.x-VILLAGE_ANCHORS.ledgerApproach.x,p.y-VILLAGE_ANCHORS.ledgerApproach.y)<130;
 const atHealer=healer&&healer.hp>0&&healer.space===s.life.playerSpace&&Math.hypot(p.x-healer.x,p.y-healer.y)<110;
 if(!ledger&&!atHealer)throw Error('请回公共委托簿或药师处领取谢礼。');
 if(s.southEvents[id]!==0||s.southEvents.claimed.includes(id))throw Error('事件尚未完成或谢礼已领取，不会重复发奖。');
 if(s.coins+12>MAX_COINS||!add(s,'potion',1))throw Error('请先腾出谢礼空间，领取记录未改变。');
 s.coins+=12;s.southEvents.claimed.push(id);return s;
}
