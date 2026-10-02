import {runeLock,type RuneSafety} from './runeState';
import {LEGACY_SITES as S} from '../../data/windLegacy';
import {props,type Prop} from '../../data/world';
import {MAX_COINS} from '../../data/economy';
import {type GrowthId} from '../../data/runeGrowth';
import {sweptTargetContact} from './swordWindGeometry';
import {clearMeleeLine} from './obstacles';
import {save} from './save';
import {validate,type State} from './state';
import type {LegacyTrack} from './windLegacyState';
import type {World} from '../scenes/World';
export const legacyNames={wind:'旧风道的回声',blade:'断路人的剑式',ending:'散落的风式 · 传承归途',return:'回流训练',momentum:'借势训练'};
const guide=()=>props.find(p=>p.id==='training-guide')!;
const startWind=()=>props.find(p=>p.id==='lesson-windLessonResolved')!;
const point=(p:{x:number;y:number})=>({x:p.x,y:p.y+65});
export function legacyObjective(s:State,track:Exclude<LegacyTrack,null>){
 const q=s.windLegacy;
 if(track==='return'||track==='momentum')return {name:legacyNames[track],text:s.runes.growth[track==='return'?'r31':'r33'].advanced?'进阶训练已完成，R 可在安全状态改选分支':track==='return'?'到练习场教本，装备回风并完成两次去返命中；未学剑风先到南侧木桥':'到练习场教本，装备续势完成两组风步接回命中；未学四连先做近战入门',point:point(track==='return'&&!s.skills.swordWindStage?startWind():guide()),done:s.runes.growth[track==='return'?'r31':'r33'].advanced};
 if(track==='ending')return {name:legacyNames.ending,text:q.ending?'传承已记录，遗迹回廊已开放':q.wind!==4&&q.blade!==4?'先完成任意一条传承支线':s.encounters.groups['east-thorn-camp'].cleared?'前往棘枝营地传承遗刻，读取并领取归途奖励':'前往棘枝营地，清理驻守与缚枝祭主，再读取传承遗刻',point:point(S.ending),done:q.ending};
 const phase=q[track],wind=track==='wind',cleared=s.encounters.groups[wind?'legacy-wind-device':'legacy-blade-post'].cleared;
 let text:string,target:{x:number;y:number};
 if(phase===0){text=wind?s.skills.swordWindStage?'南侧木桥教本：领取旧风道线索':'先到南侧木桥教本学习临水送风，再领取线索':s.skills.meleeFinisher?'练习场教本：领取旧路封锁线索':'先到练习场教本完成四连入门，再领取旧路线索';target=wind?startWind():guide();}
 else if(phase===1){text=wind?'东门外，沿森林主路在林道苔团处分南，阅读旧风道残记':'东门外，林道苔团处分北，阅读断路人的守路记';target=wind?S.windRecord:S.bladeRecord;}
 else if(phase===2){if(wind&&!q.device){text='到导风设施按 E 扶正风帆，再面向北方按 I／中键，用已学基础剑风吹响近处风铃';target=S.windDevice;}else if(!cleared){text=wind?'清理导风设施守敌（裂枝与苔团），恢复风道':'突破封路前哨：前排苔甲卫、后排祈孢者；可绕侧处理辅助';target=wind?S.windDevice:S.bladePost;}else{text=wind?'设施已恢复，回村练习场教本领取留痕进阶，再选择凝痕／织风':'前哨已突破，回村练习场教本领取破岸进阶，再选择断势／环潮';target=guide();}}
 else if(phase===3){const ready=s.encounters.groups[wind?'legacy-wind-passage':'legacy-blade-road'].cleared;text=ready?wind?'到风道出口移除封锁，记录通路':'到旧路尽头移除封锁，记录通路':wind?'沿导风设施向南穿过双石柱，清理分散守敌；留痕布局或普通攻击均可':'沿前哨向东北，突破旧路夹击；集中目标与侧翼均需留意';target=wind?S.windExit:S.bladeExit;}
 else {text=wind?'旧风道已贯通；可前往棘枝营地读取传承遗刻':'旧路已打通；可前往棘枝营地读取传承遗刻';target=S.ending;}
 return {name:legacyNames[track],text,point:point(target),done:phase===4};
}
export function growthObjective(s:State,id:GrowthId){return legacyObjective(s,id==='r32'?'wind':id==='r12'?'blade':id==='r31'?'return':'momentum');}
export function legacyTracked(s:State){const t=s.windLegacy.track;if(!t)return null;if(t==='ending'&&s.windLegacy.wind!==4&&s.windLegacy.blade!==4)return null;const o=legacyObjective(s,t);return o.done?null:o;}
export function legacyEncounterEnabled(s:State,id:string){switch(id){case 'legacy-wind-device':return s.windLegacy.wind>=2&&s.windLegacy.device;case 'legacy-wind-passage':return s.windLegacy.wind>=3;case 'legacy-blade-post':return s.windLegacy.blade>=2;case 'legacy-blade-road':return s.windLegacy.blade>=3;default:return true;}}
type Action='accept-wind'|'accept-blade'|'read-wind'|'read-blade'|'device'|'reward-wind'|'reward-blade'|'finish-wind'|'finish-blade'|'ending';
const actionSite=(a:Action)=>a==='accept-wind'?startWind():a==='accept-blade'||a.startsWith('reward-')?guide():a==='read-wind'?S.windRecord:a==='read-blade'?S.bladeRecord:a==='device'?S.windDevice:a==='finish-wind'?S.windExit:a==='finish-blade'?S.bladeExit:S.ending;
export function legacySnapshot(state:State,a:Action,safe:boolean){
 const s=validate(state),q=s.windLegacy,at=actionSite(a);
 if(s.life.playerSpace!=='village'||Math.hypot(s.player.x-at.x,s.player.y-at.y)>125)throw Error('请到对应的教本、设施或遗刻前交互。');
 if(a.startsWith('accept-')){const wind=a==='accept-wind',key=wind?'wind':'blade';if(q[key]!==0)throw Error('传承已接取。');if(wind?!s.skills.swordWindStage:!s.skills.meleeFinisher)throw Error(wind?'先在这本教本学习临水送风。':'先完成练习场四连入门。');q[key]=1;q.track=key;}
 else if(a.startsWith('read-')){const key=a==='read-wind'?'wind':'blade';if(q[key]!==1)throw Error('请先领取线索，记录也不会重复更新。');q[key]=2;q.track=key;}
 else if(a==='device'){if(q.wind!==2||q.device)throw Error('设施已经恢复或尚未调查。');if(!s.skills.swordWindStage)throw Error('先回南侧木桥学习基础剑风。');}
 else if(a.startsWith('reward-')){const wind=a==='reward-wind',key=wind?'wind':'blade',id=wind?'r32':'r12';if(q[key]!==2||wind&&!q.device||!s.encounters.groups[wind?'legacy-wind-device':'legacy-blade-post'].cleared)throw Error('中段设施与战斗尚未完成，或进阶已经领取。');if(!safe)throw Error('请在练习场安全脱战后领取进阶。');q[key]=3;q.track=key;s.runes.growth[id].advanced=true;if(!s.runes.owned.includes(id))s.runes.owned.push(id);}
 else if(a.startsWith('finish-')){const key=a==='finish-wind'?'wind':'blade';if(q[key]!==3||!s.encounters.groups[key==='wind'?'legacy-wind-passage':'legacy-blade-road'].cleared)throw Error('先清理此段守敌，通路记录不会重复结算。');q[key]=4;if(!q.ending)q.track='ending';else q.track=null;}
 else {if(q.ending)throw Error('传承与归途奖励已经领取。');if(q.wind!==4&&q.blade!==4)throw Error('先完成任意一条传承支线。');if(!s.encounters.groups['east-thorn-camp'].cleared)throw Error('棘枝营地尚未清理。');q.ending=true;q.track=null;if(!s.mapProgress.shortcuts.includes('east-corridor'))s.mapProgress.shortcuts.push('east-corridor');if(s.coins+36>MAX_COINS)throw Error('金币已满，请先花费部分金币再领取谢礼。');s.coins+=36;}
 return s;
}
// 领奖对话只授予选择权；不换装。排除它自身的对话状态，其余安全门禁全部保留。
export function legacyRewardSafe(safety:RuneSafety|undefined){return !!safety&&!runeLock({...safety,story:false});}
function appendButton(w:World,b:HTMLButtonElement){let group=w.ui.modal.querySelector('.legacy-actions');if(!group){group=document.createElement('div');group.className='legacy-actions lesson-actions';w.ui.modal.querySelector('.dialog-copy')!.append(group);}group.append(b);}
export function appendLegacyEntry(w:World,wind:boolean){const key=wind?'wind':'blade',done=w.state.windLegacy[key]>0,learned=wind?w.state.skills.swordWindStage>0:w.state.skills.meleeFinisher;const b=document.createElement('button');b.textContent=`${legacyNames[key]} · ${done?'查看线索':learned?'领取线索':'先学基础本领'}`;b.disabled=!learned&&!done;b.onclick=()=>openLegacy(w,wind?'accept-wind':'accept-blade');appendButton(w,b);
 if(!wind)for(const k of ['wind','blade'] as const)if(w.state.windLegacy[k]===2&&w.state.encounters.groups[k==='wind'?'legacy-wind-device':'legacy-blade-post'].cleared&&(k!=='wind'||w.state.windLegacy.device)){const reward=document.createElement('button');reward.textContent=`领取${k==='wind'?'留痕':'破岸'}进阶 · 安全状态免费选分支`;reward.onclick=()=>openLegacy(w,k==='wind'?'reward-wind':'reward-blade');appendButton(w,reward);}}
function openLegacy(w:World,a:Action){const track=a.includes('wind')||a==='device'?'wind':a==='ending'?'ending':'blade',o=legacyObjective(w.state,track);let body=o.text;
 if(a==='read-wind')body='残记：去程留下风痕，回返或下一阵风才能利用。旧导风设施在此处东南方，风铃在设施正北80像素。扶正后用任何已学基础剑风吹铃，再清理守敌；无需回风或留痕。';
 if(a==='read-blade')body='守路记：苔甲卫站在前排，祈孢者在后方支援。向东偏北可绕到辅助背后；正面也可用四连突破。后续旧路还有侧面裂枝者。配置固定，不会随你的符文变化。';
 if(a==='device')body=w.state.windLegacy.device?'设施已经恢复。清理周围守敌后回村练习场领取进阶。':'按下“扶正风帆”，然后站在设施南侧面向北方，用 I／中键吹响近处风铃。基础第一阶即可，无需装备符文。';
 if(a==='ending')body=w.state.windLegacy.ending?'遗刻已录入手记，遗迹回廊桥面已经修好，金币谢礼已领取。另一条传承仍可独立取得进阶。':'遗刻：同一把剑，收束能断势，舒展能环潮；一枚风痕可凝，两个落点可织。完成任意传承并清理棘枝营地后，读取此刻可恢复遗迹回廊，获得金币×36。已清理的营地不需再次作战。';
 w.ui.dialog(o.name,body);
 const q=w.state.windLegacy,ready=a==='accept-wind'?q.wind===0:a==='accept-blade'?q.blade===0:a==='read-wind'?q.wind===1:a==='read-blade'?q.blade===1:a==='device'?q.wind===2&&!q.device:a==='reward-wind'?q.wind===2:a==='reward-blade'?q.blade===2:a==='finish-wind'?q.wind===3:a==='finish-blade'?q.blade===3:!q.ending;
 if(!ready)return;
 const b=document.createElement('button');b.textContent=a.startsWith('accept-')?'记录线索并追踪':a.startsWith('read-')?'阅读记录并追踪下一步':a==='device'?'扶正风帆，准备送风':a.startsWith('reward-')?'领取进阶，随后按 R 选择分支':a==='ending'?'读取遗刻，恢复回廊并领取谢礼':'移除封锁，记录道路';appendButton(w,b);
 b.onclick=async()=>{if(w.economy.busy||w.defenseSaving)return;b.disabled=true;try{if(a==='device'){legacySnapshot(w.state,a,legacyRewardSafe(w.runes?.safety()));w.legacyDeviceArmed=true;w.ui.close(true);w.ui.message('风帆已扶正，站在设施南侧向北送风；不要求任何符文。');return;}await w.economy.run(()=>w.state,s=>legacySnapshot(s,a,legacyRewardSafe(w.runes?.safety())),save,s=>w.publishState(s));w.ui.close(true);w.ui.message(a.startsWith('reward-')?'进阶已保存，按 R 在安全状态选择分支；继续追踪后半段。':a==='ending'?'传承已记录，遗迹回廊已开放，金币谢礼已保存。':'传承进度已保存，地图已标记下一目标。');}catch(e){b.disabled=false;w.ui.message((e as Error).message);}};
}
export function legacyInteract(w:World,p:Prop){const actions:Record<string,Action>={'legacy-windRecord':'read-wind','legacy-windDevice':'device','legacy-windExit':'finish-wind','legacy-bladeRecord':'read-blade','legacy-bladePost':'read-blade','legacy-bladeExit':'finish-blade','legacy-ending':'ending'};const a=actions[p.id];if(!a)return false;openLegacy(w,a);return true;}
// 机关只观察正式剑风的连续轨迹，不授予本领、不产生攻击或额外伤害。
export function updateLegacyDevice(w:World){if(!w.legacyDeviceArmed||w.legacyDeviceSaving||w.state.windLegacy.wind!==2||w.state.windLegacy.device||w.state.life.playerSpace!=='village')return;const bell={x:S.windDevice.x,y:S.windDevice.y-80};if(!w.swordWind.winds.some(wind=>wind.attack.kind==='swordWind'&&!wind.config.trialLesson&&sweptTargetContact(wind.previous,wind.position,bell,bell,wind.config.width/2+12)!==null&&clearMeleeLine(wind.position,bell)))return;
 w.legacyDeviceSaving=true;void w.economy.run(()=>w.state,s=>{const next=validate(s);if(next.windLegacy.wind!==2||next.windLegacy.device||!next.skills.swordWindStage)throw Error('导风状态已变化。');next.windLegacy.device=true;return next;},save,s=>{w.publishState(s);w.legacyDeviceArmed=false;w.ui.message('风铃回应，导风设施已恢复并保存。守敌即将出现，清理后回村领取留痕进阶。');}).catch(e=>w.ui.message((e as Error).message)).finally(()=>w.legacyDeviceSaving=false);
}
export function legacyJournal(s:State){return `<h2>散落的风式</h2>${(['wind','blade','ending'] as const).map(t=>{const o=legacyObjective(s,t);return `<h3>${o.name}${o.done?' · 已完成':''}</h3><p>${o.text}</p>${!o.done&&(t!=='ending'||s.windLegacy.wind===4||s.windLegacy.blade===4)?`<button data-legacy-track="${t}">${s.windLegacy.track===t?'正在追踪':'追踪目标'}</button>`:''}`;}).join('')}${s.windLegacy.ending?'<p>传承记录：风痕落点连成归途；剑式收放创造前路。遗迹回廊已恢复，可步行往返遗迹南哨道与东门环线。另一条传承保留为可选探索。</p>':''}<button data-legacy-track="">追踪原有旅途</button>`;}
