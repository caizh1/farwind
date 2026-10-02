import type {State} from './state';
export const WIND_GIFTS = {
  blade:{name:'砺刃',effect:'原生近战伤害 +12%',value:.12},
  gale:{name:'聚风',effect:'原生剑风伤害 +12%',value:.12},
  riposte:{name:'回锋',effect:'完美弹反后的原生反击伤害 +20%',value:.20},
  shock:{name:'震刃',effect:'终结技命中冲击：基础普通攻击 30%，半径90，最多五目标，冷却1秒',value:.30},
  chain:{name:'闪链',effect:'原生攻击命中跳跃至最多两目标：基础普通攻击20%，冷却1.5秒',value:.20},
  stride:{name:'追风',effect:'移动速度 +8%',value:.08},
  thrift:{name:'节息',effect:'风步体力消耗 −10%',value:.10},
  breath:{name:'回息',effect:'体力恢复速度 +15%',value:.15},
  armor:{name:'风甲',effect:'实际受伤 −1，最低为1',value:1},
  potion:{name:'添药',effect:'恢复药剂治疗量 +15%',value:.15},
  spring:{name:'泉息',effect:'整场遭遇结束恢复6点生命',value:6},
  poise:{name:'稳架',effect:'成功弹反恢复3点体力',value:3},
} as const;
export type WindGiftId=keyof typeof WIND_GIFTS;
export type GiftChoice={receipt:string;candidates:WindGiftId[]};
export type WindGiftState={held:{id:WindGiftId;level:1|2}[];pending:GiftChoice[];receipts:string[];cooldowns:{shock:number;chain:number}};
export const initialWindGifts=():WindGiftState=>({held:[],pending:[],receipts:[],cooldowns:{shock:0,chain:0}});
export function seedHash(text:string,seed=2166136261){let n=seed>>>0;for(const c of text)n=Math.imul(n^c.charCodeAt(0),16777619)>>>0;return n;}
export function randomSeed(){const a=new Uint32Array(1);globalThis.crypto.getRandomValues(a);return a[0];}
export const giftLevel=(s:WindGiftState,id:WindGiftId)=>s.held.find(g=>g.id===id)?.level??0;
export const giftValue=(s:WindGiftState,id:WindGiftId)=>giftLevel(s,id)*WIND_GIFTS[id].value;
export function giftEffect(id:WindGiftId,level:number){
 const value=Math.round(WIND_GIFTS[id].value*level*(id==='armor'||id==='spring'||id==='poise'?1:100));
 return ({blade:`原生近战伤害 +${value}%`,gale:`原生剑风伤害 +${value}%`,riposte:`完美弹反后的原生反击伤害 +${value}%`,shock:`终结技命中冲击：基础普通攻击 ${value}%，半径90，最多五目标，冷却1秒`,chain:`原生攻击跳跃附伤 ${value}%，最多两目标，冷却1.5秒`,stride:`移速 +${value}%`,thrift:`风步体力消耗 −${value}%`,breath:`体力恢复 +${value}%`,armor:`实际受伤 −${value}，最低为1`,potion:`恢复药剂治疗量 +${value}%`,spring:`整场结束恢复${value}生命`,poise:`成功弹反恢复${value}体力`})[id];
}
export function offerWindGift(s:WindGiftState,receipt:string,seed:number,windUnlocked:boolean){
  if(s.receipts.includes(receipt))return false;
  const available=(Object.keys(WIND_GIFTS) as WindGiftId[]).filter(id=>giftLevel(s,id)<2&&(id!=='gale'||windUnlocked));
  const sorted=available.sort((a,b)=>seedHash(`${receipt}:${a}`,seed)-seedHash(`${receipt}:${b}`,seed)||a.localeCompare(b));
  // 候选和领取凭据在同一快照保存；全部满级时也记录事件，防止反复结算回复。
  s.receipts.push(receipt);if(sorted.length>=3)s.pending.push({receipt,candidates:sorted.slice(0,3)});
  return true;
}
export function chooseWindGift(s:WindGiftState,receipt:string,id:WindGiftId,replace?:WindGiftId){
  const choice=s.pending.find(c=>c.receipt===receipt);if(!choice?.candidates.includes(id))throw Error('此风赐候选已失效，请从手记查看待领奖励。');
  const old=s.held.find(g=>g.id===id);
  if(old){if(old.level!==1)throw Error('此风赐已满级。');old.level=2;}
  else if(s.held.length<6)s.held.push({id,level:1});
  else{const index=s.held.findIndex(g=>g.id===replace);if(index<0)throw Error('持有六项风赐，请指定被替换的一项。');s.held[index]={id,level:1};}
  s.pending=s.pending.filter(c=>c.receipt!==receipt);
 // 只有正式确认另一项强化时，才替换因满级而失去升级意义的候选；死亡、读档和关闭不改变候选。
 for(const pending of s.pending){const available=(Object.keys(WIND_GIFTS) as WindGiftId[]).filter(candidate=>giftLevel(s,candidate)<2&&candidate!=='gale'&&!pending.candidates.includes(candidate)).sort((a,b)=>seedHash(`${pending.receipt}:${a}`)-seedHash(`${pending.receipt}:${b}`));pending.candidates=pending.candidates.map(candidate=>giftLevel(s,candidate)>=2?available.shift()??candidate:candidate);}
}
export function giftChoiceSnapshot(state:State,receipt:string,id:WindGiftId,replace?:WindGiftId){const next=structuredClone(state);chooseWindGift(next.windGifts,receipt,id,replace);return next;}
export function advanceGiftCooldowns(s:WindGiftState,delta:number){for(const id of ['shock','chain'] as const)s.cooldowns[id]=Math.max(0,s.cooldowns[id]-delta);}
export function validateWindGifts(raw:unknown):WindGiftState{
  const s=structuredClone(raw) as WindGiftState,valid=(id:unknown)=>typeof id==='string'&&Object.hasOwn(WIND_GIFTS,id);
  const receipt=(r:unknown)=>typeof r==='string'&&r.length>0&&r.length<=160;
  if(!s||!s.cooldowns||!['shock','chain'].every(id=>Number.isFinite(s.cooldowns[id as 'shock'|'chain'])&&s.cooldowns[id as 'shock'|'chain']>=0&&s.cooldowns[id as 'shock'|'chain']<=(id==='shock'?1000:1500))||!Array.isArray(s.held)||s.held.length>6||s.held.some(g=>!valid(g?.id)||![1,2].includes(g.level))||new Set(s.held.map(g=>g.id)).size!==s.held.length||!Array.isArray(s.receipts)||s.receipts.length>10000||s.receipts.some(r=>!receipt(r))||new Set(s.receipts).size!==s.receipts.length||!Array.isArray(s.pending)||s.pending.length>200||new Set(s.pending.map(c=>c.receipt)).size!==s.pending.length||s.pending.some(c=>!receipt(c?.receipt)||!s.receipts.includes(c.receipt)||!Array.isArray(c.candidates)||c.candidates.length!==3||new Set(c.candidates).size!==3||c.candidates.some(id=>!valid(id))))throw Error('风赐记录无效，上一份有效存档仍保留。');
  return s;
}
