import {RUNES,RETURN_RUNE,runeById,resolveDuos,type RuneDefinition} from '../../data/runes';
import type {State} from './state';
export type RuneState={version:2;growth:{r31:{advanced:boolean;branch:'path'|'anchor'|null};r33:{advanced:boolean;branch:'calm'|'chase'|null}};fixed:'return-wind';owned:string[];slots:(string|null)[];presets:{name:string;slots:(string|null)[]}[];cooldowns:Record<string,number>;counts:Record<string,number>;clock:number;peace:number;nodes:string[];settings:{simple:boolean;lowFlash:boolean}};
export function initialRunes():RuneState{return {version:2,growth:{r31:{advanced:false,branch:null},r33:{advanced:false,branch:null}},fixed:'return-wind',owned:[],slots:Array(5).fill(null),presets:[1,2,3].map(i=>({name:`旅途配装 ${i}`,slots:Array(5).fill(null)})),cooldowns:{},counts:{},clock:0,peace:8000,nodes:[],settings:{simple:false,lowFlash:false}};}
const validSlots=(v:unknown,owned:string[])=>Array.isArray(v)&&v.length===5&&v.every(id=>id===null||typeof id==='string'&&owned.includes(id))&&new Set(v.filter(Boolean)).size===v.filter(Boolean).length;
export function validateRunes(raw:unknown):RuneState {
 const r=raw as RuneState;
 if(!r||r.version!==2||r.fixed!=='return-wind'||!Array.isArray(r.owned)||r.owned.length>RUNES.length||new Set(r.owned).size!==r.owned.length||r.owned.some(id=>!runeById(id))||!validSlots(r.slots,r.owned)||!Array.isArray(r.presets)||r.presets.length!==3||r.presets.some(p=>!p||typeof p.name!=='string'||p.name.length>24||!validSlots(p.slots,r.owned))||!Number.isFinite(r.clock)||r.clock<0||r.clock>1e12||!Number.isFinite(r.peace)||r.peace<0||r.peace>8000||!Array.isArray(r.nodes)||new Set(r.nodes).size!==r.nodes.length||r.nodes.some(id=>!['waymark'].includes(id))||!r.settings||typeof r.settings.simple!=='boolean'||typeof r.settings.lowFlash!=='boolean')throw Error('符文收藏或配装存档无效。');
 for(const [key,max] of [['cooldowns',180000],['counts',12]] as const)if(!r[key]||Object.keys(r[key]).length>RUNES.length+1||Object.entries(r[key]).some(([id,n])=>(id!==RETURN_RUNE.id&&!runeById(id))||!Number.isFinite(n)||n<0||n>max))throw Error('符文冷却或蓄积存档无效。');
 for(const id of ['r31','r33'] as const){const g=r.growth?.[id],choices=id==='r31'?['path','anchor']:['calm','chase'];if(!g||typeof g.advanced!=='boolean'||(g.branch!==null&&!choices.includes(g.branch))||!g.advanced&&g.branch!==null)throw Error('符文进阶存档无效。');}
 return structuredClone(r);
}
export type RuneSafety={combat:boolean;boss:boolean;defense:boolean;trial:boolean;story:boolean;action:boolean};
export function runeLock(s:RuneSafety){return s.boss?'首领封锁中':s.defense?'守村事件中':s.trial?'试炼中':s.story?'剧情锁定中':s.combat?'交战中，需脱战八秒':s.action?'动作进行中':'';}
export type RuneRequest={kind:'equip';slot:number;id:string|null}|{kind:'preset-save'|'preset-load';index:number}|{kind:'claim';id:string;shop?:string}|{kind:'branch';id:'r31'|'r33';branch:'path'|'anchor'|'calm'|'chase'};
export function acquisitionReady(s:State,r:RuneDefinition,shop?:string){
 if(r.id==='r12'&&s.skills.buildLessons.includes('finisher'))return true;
 const a=r.acquisition,g=s.encounters.groups;
 switch(a.kind){
 case 'training':return a.key==='sword-wind'?s.skills.swordWindStage>0:s.skills.meleeFinisher;
 case 'shop':return shop===a.key&&s.coins>=(a.price??0);
 case 'explore':{const keys=a.key==='wood-v1'?['wood-v1','wood-yard-1','wood-yard-2']:a.key==='berry-v1'?['berry-v1','orchard-berry-1','orchard-berry-2']:[a.key];return keys.some(id=>s.collected[id]!==undefined||s.chests.includes(id));}
 case 'commission':return a.key==='side'?s.side===2:a.key==='main'?s.quest===7:s.fieldQuests['south-supply']==='complete';
 case 'encounter':return !!g[a.key]?.cleared;
 case 'ruins':return s.stones.includes(Number(a.key));
 case 'boss':return g[a.key]?.boss?.stage==='defeated';
 case 'allBosses':return ['west-wolf-den','east-thorn-camp','south-spore-camp','north-boar-camp'].every(id=>g[id]?.boss?.stage==='defeated');
 }
}
export function runeSnapshot(s:State,request:RuneRequest,safety:RuneSafety):State {
 const next=structuredClone(s),r=next.runes;
 if(request.kind==='claim'){
  const d=runeById(request.id);if(!d||r.owned.includes(d.id))throw Error('符文已拥有或不存在。');
  if(!acquisitionReady(s,d,request.shop))throw Error(d.acquisition.hint);
  if(d.acquisition.kind==='shop')next.coins-=d.acquisition.price??0;
  r.owned.push(d.id);
 }else {
  const lock=runeLock(safety);if(lock)throw Error(lock);
  if(request.kind==='branch'){
   const g=r.growth[request.id],choices=request.id==='r31'?['path','anchor']:['calm','chase'];
   if(!r.owned.includes(request.id)||!g.advanced||!choices.includes(request.branch))throw Error('尚未完成对应进阶训练。');
   (g as {branch:string|null}).branch=request.branch;
  }else if(request.kind==='equip'){
   if(!Number.isInteger(request.slot)||request.slot<0||request.slot>=5)throw Error('归风固定绑定，自由槽共有五个。');
   if(request.id!==null&&(!r.owned.includes(request.id)||r.slots.some((id,i)=>i!==request.slot&&id===request.id)))throw Error('尚未拥有或同名符文已经装备。');
   r.slots[request.slot]=request.id;
  }else {
   if(!Number.isInteger(request.index)||request.index<0||request.index>=3)throw Error('配装预设不存在。');
   if(request.kind==='preset-save')r.presets[request.index].slots=[...r.slots];
   else r.slots=[...r.presets[request.index].slots];
  }
 }
 next.runes=validateRunes(r);return next;
}
export function runeModel(s:State){return {runes:s.runes.slots.map(id=>id?runeById(id)!:null),duos:resolveDuos(s.runes.slots,s.skills.swordWindStage>0)};}
// 正常流程只在里程碑真的发生后授予；迁移和读档不自动补发历史收藏。
export function grantMilestoneRunes(s:State,before:State){const earned=RUNES.filter(r=>r.acquisition.kind!=='shop'&&!s.runes.owned.includes(r.id)&&!acquisitionReady(before,r)&&acquisitionReady(s,r));for(const r of earned)s.runes.owned.push(r.id);return earned;}

// 老版本只补字段，不发奖；满足条件的奖励通过既有领取入口幂等领取。
export function migrateBuildRunes(raw:unknown):RuneState {
 if(raw===undefined)return initialRunes();
 const r=structuredClone(raw) as RuneState & {version:number};
 if((r.version as number)===1){r.version=2;r.growth=initialRunes().growth;}
 return validateRunes(r);
}
export function momentumConfig(s:State){
 if(!s.runes.slots.includes('r33'))return {window:0,chase:0};
 const g=s.runes.growth.r33;
 return {window:g.advanced&&g.branch==='calm'?1100:700,chase:g.advanced&&g.branch==='chase'?32:0};
}
export function returnMode(s:State){if(!s.runes.slots.includes('r31'))return undefined;return s.runes.growth.r31.advanced&&s.runes.growth.r31.branch==='anchor'?'anchor' as const:'path' as const;}
export function growthDescription(s:State,id:string){
 if(id!=='r31'&&id!=='r33')return '';
 const g=s.runes.growth[id],names={path:'原路回返',anchor:'引风归身',calm:'从容接势',chase:'追身接势'};
 return `${g.advanced?'已进阶 · '+(g.branch?names[g.branch]:'基础规则 · 尚未选分支'):'基础效果 · 进阶待训练'}${s.runes.slots.includes(id)?'':' · 未装备，分支不生效'}`;
}
