import type { Point } from "./obstacles";

export const ENEMY_ATTACK = {
  slime: { windup:450, lock:120, recovery:220, cooldown:1100, damage:10 },
  leaf: { windup:650, lock:150, recovery:280, cooldown:1400, damage:18 },
  range:100,
  halfAngle:80*Math.PI/180,
} as const;
export type EnemyAttack = {
  attackId:string; attackerId:string; startedAt:number; lockAt:number;
  contactAt:number; recoveryUntil:number; direction:Point; locked:boolean;
  shape:"sector"; range:number; halfAngle:number; parryable:boolean;
  damage:number; cancelled:boolean; resolved:boolean; emitted:boolean;
};
export type EnemyContact = {at:number;attack:EnemyAttack;origin:Point;training?:boolean};
export function aim(origin:Point,target:Point):Point {
  const d=Math.hypot(target.x-origin.x,target.y-origin.y);
  return d>0?{x:(target.x-origin.x)/d,y:(target.y-origin.y)/d}:{x:0,y:1};
}
export function createEnemyAttack(attackerId:string,serial:number,type:string,now:number,origin:Point,target:Point,windup?:number):EnemyAttack {
  const m=type==="leaf"?ENEMY_ATTACK.leaf:ENEMY_ATTACK.slime, duration=windup??m.windup;
  return {attackId:`${attackerId}:${serial}`,attackerId,startedAt:now,lockAt:now+duration-m.lock,
    contactAt:now+duration,recoveryUntil:now+duration+m.recovery,direction:aim(origin,target),locked:false,
    shape:"sector",range:ENEMY_ATTACK.range,halfAngle:ENEMY_ATTACK.halfAngle,parryable:true,
    damage:m.damage,cancelled:false,resolved:false,emitted:false};
}
export function advanceEnemyAttack(a:EnemyAttack,origin:Point,target:Point,now:number):EnemyContact|null {
  if(a.cancelled)return null;
  if(!a.locked) {
    a.direction=aim(origin,target);
    if(now+1e-7>=a.lockAt)a.locked=true;
  }
  if(now+1e-7<a.contactAt||a.emitted)return null;
  a.emitted=true;
  return {at:a.contactAt,attack:a,origin:{x:origin.x,y:origin.y}};
}
export function attackTouches(contact:EnemyContact,player:Point) {
  const dx=player.x-contact.origin.x,dy=player.y-contact.origin.y,d=Math.hypot(dx,dy),a=contact.attack;
  return d<a.range&&(d<1e-7||(dx*a.direction.x+dy*a.direction.y)/d>=Math.cos(a.halfAngle));
}
