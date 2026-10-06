import {memoryCoins,memoryStrength,MEMORY_LIMIT} from '../../data/windMemoryDifficulty';
export {memoryStrength,memoryCoins} from '../../data/windMemoryDifficulty';
import {MAX_COINS} from '../../data/economy';
import type {State} from './state';
import {initialEncounters,validateEncounters,type EncounterState} from './encounterState';
import {ADVENTURE_ROUTES,ENCOUNTERS,type WildernessDirection} from '../../data/maps/windbell/encounters';
import {randomSeed} from './windGifts';
export type WindMemoryState={serial:number;counts:Record<WildernessDirection,number>;active:null|{direction:WildernessDirection;seed:number;encounters:EncounterState;receipts:string[];finished:boolean}};
export const initialWindMemory=():WindMemoryState=>({serial:0,counts:{south:0,west:0,north:0,east:0},active:null});
export function startWindMemory(state:State,direction:WildernessDirection,seed=randomSeed()){
 if(state.windGifts.pending.length>190)throw Error('待领风赐较多，请先从手记完成选择，再开启下一次远征。');
 const route=ADVENTURE_ROUTES[direction];if(!route)throw Error('未知远征方向。');const camp=ENCOUNTERS.find(d=>d.id===route[4])!;
 if(!state.encounters.groups[camp.id].cleared)throw Error('先正式清剿此据点，再进入风忆远征。');
 if(state.windMemory.active&&!state.windMemory.active.finished)throw Error('已有风忆正在进行，可以继续或主动结束。');
 if(Math.hypot(state.player.x-camp.x,state.player.y-camp.y)>camp.radius+80)throw Error('请到已清据点附近开启远征。');
 const next=structuredClone(state);next.windGifts.receipts=next.windGifts.receipts.filter(r=>!r.startsWith('memory:')||next.windGifts.pending.some(c=>c.receipt===r));next.xiaobao.affected=[];next.xiaobao.cast=null;next.xiaobao.effects=[];next.xiaobao.command=null;const serial=next.windMemory.serial+1,counts={...next.windMemory.counts},level=(counts[direction]??0)+1;if(serial>MEMORY_LIMIT||level>MEMORY_LIMIT)throw Error('风忆次数已到记录上限。');counts[direction]=level;next.windMemory={serial,counts,active:{direction,seed,encounters:initialEncounters(seed,`memory:${serial}`,{version:1,level}),receipts:[],finished:false}};return next;
}
// 风忆按原路线逐场解锁；指向尚未结算的场地，驻守结算后继续指向首领。
export function windMemoryTracked(state:Pick<State,'windMemory'>){
 const active=state.windMemory.active;if(!active||active.finished)return null;
 const route=ADVENTURE_ROUTES[active.direction],id=route.find(id=>!active.encounters.groups[id].rewarded)??route[4];
 const point=ENCOUNTERS.find(d=>d.id===id)!,power=memoryStrength(active.encounters.memoryDifficulty),strong=memoryStrength(active.encounters.memoryDifficulty,true);
 return {name:`风忆${active.encounters.memoryDifficulty?` · 第${active.encounters.memoryDifficulty.level}档`:''} · ${point.name}`,point,text:`M 地图${active.encounters.memoryDifficulty?` · 生命×${power.health.toFixed(2)} 伤害×${power.damage.toFixed(2)} · 首领生命×${strong.health.toFixed(2)} 伤害×${strong.damage.toFixed(2)}。`:""}`};
}
export function endWindMemory(state:State){const next=structuredClone(state);next.windMemory.active=null;next.xiaobao.affected=[];next.xiaobao.cast=null;next.xiaobao.effects=[];next.xiaobao.command=null;return next;}
export function memoryGold(state:State,receipt:string,amount:number){const a=state.windMemory.active;if(!a||a.receipts.includes(receipt))return false;a.receipts.push(receipt);state.coins=Math.min(MAX_COINS,state.coins+memoryCoins(amount,a.encounters.memoryDifficulty));return true;}
export function validateWindMemory(raw:unknown):WindMemoryState{
 const s=structuredClone(raw) as WindMemoryState;if(!s||!Number.isSafeInteger(s.serial)||s.serial<0||s.serial>1e9)throw Error('风忆实例身份无效。');
 const a=s.active;if(s.counts===undefined){s.counts=initialWindMemory().counts;if(a&&Object.hasOwn(s.counts,a.direction))s.counts[a.direction]=1;}if(!s.counts||Object.keys(s.counts).length!==4||Object.entries(s.counts).some(([key,value])=>!Object.hasOwn(ADVENTURE_ROUTES,key)||!Number.isSafeInteger(value)||value<0||value>s.serial)||Object.values(s.counts).reduce((sum,n)=>sum+n,0)>s.serial)throw Error('风忆方向次数无效。');if(a){if(!Object.hasOwn(ADVENTURE_ROUTES,a.direction)||!Number.isSafeInteger(a.seed)||a.seed<0||a.seed>0xffffffff||typeof a.finished!=='boolean'||!Array.isArray(a.receipts)||a.receipts.length>6||new Set(a.receipts).size!==a.receipts.length||a.receipts.some(r=>!ADVENTURE_ROUTES[a.direction].includes(r)&&r!==`${ADVENTURE_ROUTES[a.direction][4]}:boss`))throw Error('风忆进度无效。');a.encounters=validateEncounters(a.encounters);if(a.encounters.memoryDifficulty&&a.encounters.memoryDifficulty.level!==s.counts[a.direction])throw Error('风忆档位与开启次数不一致。');if(a.encounters.instance!==`memory:${s.serial}`||a.encounters.seed!==a.seed||a.finished!==a.encounters.groups[ADVENTURE_ROUTES[a.direction][4]].cleared)throw Error('风忆结果与战斗记录不一致。');}else if(a!==null)throw Error('风忆记录缺失。');return s;
}
