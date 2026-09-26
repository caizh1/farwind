import { CombatController, facingVector, PARRY, type CounterKind } from "./combat";
import { attackTouches, type EnemyContact } from "./enemyAttack";
import type { Point } from "./obstacles";
export type ContactResult = "invalid"|"immune"|"afterguard"|"normal"|"perfect"|"hurt";
export function defends(facing:0|1|2|3,origin:Point,player:Point) {
  const [x,y]=facingVector(facing),dx=origin.x-player.x,dy=origin.y-player.y,d=Math.hypot(dx,dy);
  return d>1e-7&&(dx*x+dy*y)/d>=Math.cos(PARRY.halfAngle);
}
export function adjudicateContact(contact:EnemyContact,c:CombatController,p:Point&{stamina:number},rules:{valid:boolean;immune:boolean;clear:(a:Point,b:Point,id:string)=>boolean}):ContactResult {
  const a=contact.attack,now=contact.at;
  if(a.cancelled||a.resolved)return "invalid";
  // 空间判定先于所有保护与奖励；即使挥空，本次唯一接触也已结算。
  a.resolved=true;
  if(!rules.valid||!attackTouches(contact,p)||!rules.clear(contact.origin,p,a.attackerId))return "invalid";
  if(rules.immune||c.invulnerable(now))return "immune";
  if(a.parryable&&c.afterguard&&now<c.afterguard.until&&defends(c.afterguard.facing,contact.origin,p)) {
    a.cancelled=true;
    return "afterguard";
  }
  const quality=c.parryQuality(now);
  if(a.parryable&&quality&&defends(c.parry!.facing,contact.origin,p)) {
    c.succeedParry(now,quality as CounterKind,p);
    a.cancelled=true;
    return quality;
  }
  return "hurt";
}
export const orderedContacts = (contacts:EnemyContact[]) => [...contacts].sort((a,b)=>a.at-b.at||a.attack.attackerId.localeCompare(b.attack.attackerId)||a.attack.attackId.localeCompare(b.attack.attackId));
