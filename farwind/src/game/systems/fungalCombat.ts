import type {EnemyBody} from './enemy';
import {FUNGAL_BLAST_RADIUS,createEnemyAttack,delayEnemyAttack,geometryTouches,type EnemyContact,type AttackGeometry} from './enemyAttack';
import {clearMeleeLine,type Point} from './obstacles';

export const FUNGAL={channel:900,shieldTime:2400,cooldown:4800,range:340,reduction:.65,blastRadius:FUNGAL_BLAST_RADIUS,blastDamage:26,friendlyDamage:80,rootRadius:160} as const;
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
const validAlly=(e:EnemyBody,p:EnemyBody)=>p!==e&&p.hp>0&&!p.disabled&&!p.boss&&!p.passiveRoot&&p.type!=='priest'&&distance(e,p)<=FUNGAL.range&&clearMeleeLine(e,p);

// 护盾从唯一战斗实例推导，不保存第二套生命或跨读档的悬空引用。
export function refreshFungalShields(peers:readonly EnemyBody[],now:number){
  for(const e of peers)e.fungalShield=undefined;
  for(const e of peers){const a=e.attack;
    if(e.type!=='priest'||e.passiveRoot||e.hp<=0||e.disabled||!a||a.cancelled||now<a.contactAt||now>=a.activeUntil||now<e.staggerUntil)continue;
    const ally=peers.find(p=>p.id===a.supportTarget&&validAlly(e,p));
    if(ally&&!ally.fungalShield)ally.fungalShield=e;
  }
}
export function updateFungalPriest(e:EnemyBody,peers:readonly EnemyBody[],threat:Point,now:number,dt:number,targetId:string,permit:(enemy:EnemyBody,target:string)=>boolean):null{
  if(e.hp<=0||e.disabled||e.passiveRoot)return null;
  if(e.attack){const a=e.attack,ally=peers.find(p=>p.id===a.supportTarget);
    if(!ally||!validAlly(e,ally)||a.cancelled){e.attack=null;e.windup=0;e.cool=Math.max(e.cool,now+1200);e.ai='施法中断';return null;}
    const frozen=Math.max(0,Math.min(now,e.staggerUntil)-Math.max(now-dt,e.staggerSince??now-dt));if(frozen)delayEnemyAttack(a,frozen);
    if(now>=a.recoveryUntil){e.attack=null;e.windup=0;e.ai='摇铃收招';return null;}
    a.direction={x:(ally.x-e.x)/(distance(e,ally)||1),y:(ally.y-e.y)/(distance(e,ally)||1)};
    e.face={...a.direction};e.windup=Math.max(0,a.contactAt-now);e.ai=now<a.contactAt?'举铃施法':now<a.activeUntil?'菌铃护盾':'摇铃收招';return null;
  }
  e.ai='寻找护盾同伴';
  if(now<e.staggerUntil||now<e.cool||distance(e,threat)>600||!permit(e,targetId))return null;
  const ally=peers.filter(p=>validAlly(e,p)&&!p.fungalShield).sort((a,b)=>distance(a,threat)-distance(b,threat)||a.id.localeCompare(b.id))[0];if(!ally)return null;
  const a=createEnemyAttack(e.id,e.attackSerial=(e.attackSerial??0)+1,e.type,now,e,ally);
  a.supportTarget=ally.id;e.attack=a;e.targetId=targetId;e.cool=now+FUNGAL.cooldown;e.windup=FUNGAL.channel;e.nav.path=[];return null;
}
export function fungalShieldActive(e:Pick<EnemyBody,'fungalShield'|'x'|'y'>,now:number){
  const source=e.fungalShield,a=source?.attack;
  return !!source&&source.hp>0&&!source.disabled&&!!a&&!a.cancelled&&now>=a.contactAt&&now<a.activeUntil&&now>=source.staggerUntil&&distance(e,source)<=FUNGAL.range&&clearMeleeLine(source,e);
}
export function takeFungalBlast(e:EnemyBody,now:number){
  const a=e.attack;if(e.hp<=0||e.disabled||e.type!=='bomber'||!a||a.cancelled||a.bombAt===undefined||a.detonated||now<a.bombAt)return null;
  a.detonated=true;a.blastPoint=Object.freeze({x:e.x,y:e.y});
  const geometry:AttackGeometry={kind:'circle',a:{x:e.x,y:e.y},b:{x:e.x,y:e.y},radius:FUNGAL.blastRadius};
  return {source:e,attack:a,at:a.bombAt,geometry,point:{x:e.x,y:e.y}};
}
export function fungalBlastContact(blast:NonNullable<ReturnType<typeof takeFungalBlast>>,target:Point&{id:string}):EnemyContact|null{
  if(!geometryTouches(blast.geometry,target)||!clearMeleeLine(blast.point,target))return null;
  const a={...blast.attack,attackId:`${blast.attack.attackId}:blast:${target.id}`,damage:FUNGAL.blastDamage,parryable:false,emitted:true,resolved:false,geometry:blast.geometry};
  return {at:blast.at,attack:a,origin:blast.point,geometry:blast.geometry,blastId:blast.attack.attackId,targetId:target.id,sampledPoint:{x:target.x,y:target.y}};
}
// 范围攻击使用独立接触实例，但仍必须能追溯到本次实际引爆的唯一攻击。
export function validFungalBlastContact(c:EnemyContact,source:EnemyBody,targetId:string){
  const a=source.attack,g=c.geometry;
  return source.type==='bomber'&&source.hp>0&&!source.disabled&&!!a&&!a.cancelled&&a.detonated===true&&a.blastPoint?.x===c.origin.x&&a.blastPoint?.y===c.origin.y&&a.type==='bomber'&&c.attack.type==='bomber'&&a.bombAt===c.at&&c.blastId===a.attackId&&c.targetId===targetId&&c.attack.attackerId===source.id&&c.attack.attackId===`${a.attackId}:blast:${targetId}`&&c.attack.damage===FUNGAL.blastDamage&&!c.attack.parryable&&g?.kind==='circle'&&g.radius===FUNGAL.blastRadius&&g.a.x===c.origin.x&&g.a.y===c.origin.y&&g.b.x===c.origin.x&&g.b.y===c.origin.y;
}
