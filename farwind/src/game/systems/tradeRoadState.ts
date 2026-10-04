import {initialCityProgress,validateCityProgress,type CityProgress} from './cityProgress';
import type {XiaobaoState} from './xiaobaoState';
import { CITY_GUARD_POSTS, CITY_STOCK, TRADE_ROAD_NODES } from '../../data/maps/windwhisper';
import { seedHash } from './windGifts';
import {validOutdoorPoint} from '../../data/maps/windbell/bounds';
export const ROAD_KINDS=['canyonHunter','cliffLancer','cragAxeman'] as const;
export type RoadKind=typeof ROAD_KINDS[number];
export type RoadUnit={id:string;type:RoadKind;x:number;y:number;homeX:number;homeY:number;hp:number;maxHP:number;wave:number;elite:boolean;participated:boolean;spawned:boolean;defeated:boolean;cue:number;cooldown:number;drop:boolean;dropRemaining:number;serial:number};
export type RoadNode={wave:number;active:boolean;cleared:boolean;rewarded:boolean;units:RoadUnit[]};
export type TradeRoadState={version:1;serial:number;seed:number|null;nodes:RoadNode[]};
export type CityGuardState={slot:string;serial:number;x:number;y:number;hp:number;mode:'post'|'intercept'|'retreat'|'recover'|'down'|'replacement';replacement:number;cooldown:number;peace:number};
export type CityState={version:2;progress:CityProgress;visited:boolean;stock:Record<keyof typeof CITY_STOCK,number>;guards:CityGuardState[]};
export const initialTradeRoad=():TradeRoadState=>({version:1,serial:0,seed:null,nodes:[]});
export const initialCity=():CityState=>({version:2,progress:initialCityProgress(),visited:false,stock:{...CITY_STOCK},guards:CITY_GUARD_POSTS.map((p,i)=>({slot:p.slot,serial:1,x:p.x,y:p.y,hp:p.maxHP,mode:'post',replacement:0,cooldown:(i%10)*140,peace:0}))});
export function roadMaxHP(type:RoadKind,elite=false){return ({canyonHunter:72,cliffLancer:84,cragAxeman:160}[type])*(elite?1.8:1);}
export function createTradeRoad(serial:number,seed:number):TradeRoadState{
  return {version:1,serial,seed,nodes:TRADE_ROAD_NODES.map((n,node)=>({wave:0,active:false,cleared:false,rewarded:false,units:[0,1,2].flatMap(wave=>Array.from({length:5+wave},(_,slot)=>{
    const hash=seedHash(`${node}:${wave}:${slot}`,seed),elite=(node===3||node===5)&&wave===2&&slot===0;
    // 每波只有两个远程槽，其余在扑击和重甲之间随机；首段先教会处理猎兽。
    const type:RoadKind=elite?'cragAxeman':slot<2&&hash%3===0?'cliffLancer':node===0||hash%3?'canyonHunter':'cragAxeman';
    const angle=(hash%628)/100,r=240+(hash%90),x=n.x+Math.cos(angle)*r,y=n.y+Math.sin(angle)*r,maxHP=roadMaxHP(type,elite);
    return {id:`road:${serial}:${node}:${wave}:${slot}`,type,x,y,homeX:x,homeY:y,hp:maxHP,maxHP,wave,elite,participated:false,spawned:false,defeated:false,cue:800,cooldown:0,drop:false,dropRemaining:0,serial:0};
  }))}))};
}
export function roadUnit(s:TradeRoadState,id:string){return s.nodes.flatMap(n=>n.units).find(u=>u.id===id);}
export function roadParticipation(s:TradeRoadState,id:string,damage:number){const u=roadUnit(s,id);if(u&&damage>0)u.participated=true;}
export function roadDefeat(s:TradeRoadState,id:string,direct=false){const u=roadUnit(s,id);if(!u||u.defeated)return null;u.hp=0;u.defeated=true;u.participated||=direct;return u;}
export function validateTradeRoad(raw:unknown):TradeRoadState{
  const s=structuredClone(raw) as TradeRoadState;
  const integer=(v:number,max:number)=>Number.isSafeInteger(v)&&v>=0&&v<=max;
  const finite=(v:number,min:number,max:number)=>Number.isFinite(v)&&v>=min&&v<=max;
  const fail=()=>{throw Error('商路旅途记录无效，上一份有效存档仍保留。');};
  if(!s||s.version!==1||!integer(s.serial,1e9)||!Array.isArray(s.nodes))fail();
  if(s.seed===null){if(s.serial!==0||s.nodes.length)fail();return s;}
  if(!integer(s.seed,0xffffffff)||s.serial<1||s.nodes.length!==6)fail();
  const expected=createTradeRoad(s.serial,s.seed);
  s.nodes.forEach((n,i)=>{
    if(!n||!integer(n.wave,3)||typeof n.active!=='boolean'||typeof n.cleared!=='boolean'||typeof n.rewarded!=='boolean'||!Array.isArray(n.units)||n.units.length!==18||n.rewarded&&!n.cleared)fail();
    n.units.forEach((u,j)=>{if(u&&u.serial===undefined)u.serial=0;const d=expected.nodes[i].units[j];
      if(!u||u.id!==d.id||!integer(u.serial,1e9)||u.type!==d.type||u.wave!==d.wave||u.elite!==d.elite||u.maxHP!==d.maxHP||!finite(u.hp,0,d.maxHP)||u.defeated!==(u.hp===0)||!validOutdoorPoint(u)||!finite(u.homeX,4260,9680)||!finite(u.homeY,700,2400)||Math.hypot(u.x-u.homeX,u.y-u.homeY)>1300||!finite(u.cue,0,800)||!finite(u.cooldown,0,15000)||!finite(u.dropRemaining,0,60000)||typeof u.drop!=='boolean'||u.drop!==(u.dropRemaining>0)||u.drop&&!u.defeated||typeof u.participated!=='boolean'||typeof u.spawned!=='boolean'||u.defeated&&!u.spawned||!n.active&&(u.spawned||u.defeated||u.participated)||u.wave>n.wave&&(u.spawned||u.defeated)||u.wave<n.wave&&!u.defeated)fail();
    });
    if(n.cleared!==n.units.every(u=>u.defeated)||n.cleared!==(n.wave===3)||n.rewarded!==(n.cleared&&n.units.filter(u=>u.participated).length>=9))fail();
  });return s;
}
export function validateCity(raw:unknown):CityState{
  const s=structuredClone(raw) as CityState;
  // 先完整验证旧十岗与三商品，才追加新内容；损坏旧档不能借迁移被清空。
  const legacy=(s as {version:number})?.version===1;
  const stockKeys=legacy?['potion','bread','tea']:Object.keys(CITY_STOCK),posts=legacy?CITY_GUARD_POSTS.slice(0,10):CITY_GUARD_POSTS;
  if(!s||(!legacy&&s.version!==2)||typeof s.visited!=='boolean'||!s.stock||Object.keys(s.stock).length!==stockKeys.length||stockKeys.some(k=>!Number.isSafeInteger(s.stock[k as keyof typeof CITY_STOCK])||s.stock[k as keyof typeof CITY_STOCK]<0||s.stock[k as keyof typeof CITY_STOCK]>CITY_STOCK[k as keyof typeof CITY_STOCK])||!Array.isArray(s.guards)||s.guards.length!==posts.length||new Set(s.guards.map(g=>g.slot)).size!==posts.length)throw Error('风语城记录无效。');
  for(const g of s.guards){const p=posts.find(p=>p.slot===g.slot);
    if(!p||!Number.isSafeInteger(g.serial)||g.serial<1||g.serial>1e9||!Number.isFinite(g.x)||g.x<9220||g.x>13780||!Number.isFinite(g.y)||g.y< -180||g.y>2650||!Number.isFinite(g.hp)||g.hp<0||g.hp>p.maxHP||!['post','intercept','retreat','recover','down','replacement'].includes(g.mode)||g.mode==='down'!==(g.hp===0)||!Number.isFinite(g.replacement)||g.replacement<0||g.replacement>20000||!Number.isFinite(g.cooldown)||g.cooldown<0||g.cooldown>2000||!Number.isFinite(g.peace)||g.peace<0||g.peace>8000)throw Error('风语城守备记录无效。');
  }
  if(legacy){const fresh=initialCity();s.version=2;s.progress=fresh.progress;s.guards.push(...fresh.guards.slice(10));s.stock={...fresh.stock,...s.stock};}
  s.progress=validateCityProgress(s.progress);return s;
}

// 重排实例之前清理同行者对上一趟敌群的瞬时引用，成长与永久奖励不变。
export function renewTradeRoad(s:{tradeRoad:TradeRoadState;xiaobao:XiaobaoState},seed:number){
 s.xiaobao.affected=s.xiaobao.affected.filter(e=>!e.id.startsWith('road:'));
 if(s.xiaobao.cast?.target?.startsWith('road:'))s.xiaobao.cast=null;
 if(s.xiaobao.command?.target?.startsWith('road:'))s.xiaobao.command=null;
 s.xiaobao.effects=s.xiaobao.effects.filter(e=>!e.target?.startsWith('road:'));
 s.tradeRoad=createTradeRoad(s.tradeRoad.serial+1,seed);
}
