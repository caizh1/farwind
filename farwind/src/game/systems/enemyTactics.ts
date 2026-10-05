import {enemyBehavior,enemyProfile} from '../../data/enemies';
import type {EnemyBody} from './enemy';
import {clearMotionLine,motionBlocked,type Point} from './obstacles';
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
const identityHash=(id:string)=>{let h=0;for(const c of id)h=(h*31+c.charCodeAt(0))>>>0;return h;};
// 战术只读取实际位置，候选点每一百五十毫秒更新；不读取玩家未来输入或复制攻击预测。
export function tacticalDestination(e:EnemyBody,threat:Point,peers:readonly EnemyBody[],now:number,allowed:(p:Point)=>boolean):Point {
 if(!e.combatTier||e.boss)return threat;
 const kind=enemyBehavior(e.type),d=Math.max(1,distance(e,threat)),dx=(e.x-threat.x)/d,dy=(e.y-threat.y)/d;
 if(e.tacticalPoint&&now<(e.tacticalNext??0)&&allowed(e.tacticalPoint))return e.tacticalPoint;
 const hash=identityHash(e.id);
 const side=hash%2?1:-1;let point=threat;
 if(['leaf','raven'].includes(kind)&&d>Math.max(145,enemyProfile(e.type).reach+15))point={x:threat.x-dy*(kind==='leaf'?90:130)*side,y:threat.y+dx*(kind==='leaf'?90:130)*side};
 if(['wolf','shade'].includes(kind)&&d>Math.max(145,enemyProfile(e.type).reach+15)){
  const flankers=peers.filter(p=>p.hp>0&&!p.disabled&&!p.boss&&['wolf','shade'].includes(enemyBehavior(p.type))&&distance(p,threat)<700).sort((a,b)=>a.id.localeCompare(b.id));
  const slot=flankers.findIndex(p=>p.id===e.id),angle=(identityHash(flankers[0]?.id??e.id)%4)*Math.PI/4,sign=slot<0?side:slot%2?1:-1;
  point={x:threat.x+Math.cos(angle)*130*sign,y:threat.y+Math.sin(angle)*130*sign};
 }
 if(['archer','spore'].includes(kind)){
  if(d<190)point={x:e.x+dx*85,y:e.y+dy*85};
  else if(d<enemyProfile(e.type).reach)point={x:e.x-dy*80*side,y:e.y+dx*80*side};
 }
 if(kind==='priest'){
  const ally=peers.filter(p=>p!==e&&p.hp>0&&!p.disabled&&!p.boss&&!p.passiveRoot&&!['priest','bell'].includes(p.type)).sort((a,b)=>distance(a,threat)-distance(b,threat)||a.id.localeCompare(b.id))[0];
  if(ally){const n=Math.max(1,distance(ally,threat));point={x:ally.x+(ally.x-threat.x)/n*90,y:ally.y+(ally.y-threat.y)/n*90};}
 }
 if(!allowed(point)||motionBlocked(point.x,point.y)||!clearMotionLine(e,point))point=kind==='priest'?peers.find(p=>p!==e&&p.hp>0&&!p.disabled&&!p.passiveRoot&&p.type!=='priest')??threat:threat;
 e.tacticalPoint={x:point.x,y:point.y};e.tacticalNext=now+150;return point;
}
