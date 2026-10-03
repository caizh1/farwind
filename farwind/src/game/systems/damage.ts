export type Faction = "village" | "hostile";
export type UnitRef = { id: string; faction: Faction; hp: number; armor: number;
  reduction?: number; flatReduction?:number; incomingScale?:number; hpFloor?:number; shield?: { amount: number; remaining: number } };
export type DamageEvent = {
  sourceId: string; targetId: string; attackId: string; amount: number;
  sourceType: "player-replay" | "player-rune" | "player-phantom" | "player-melee" | "player-wind" | "guard-melee" | "tower-arrow" | "enemy-melee" | "enemy-shot" | "enemy-blast" | "companion-melee" | "companion-shot" | "companion-element";
  eventId: string | null;
  sourceScale?:number;
  origin?:{x:number;y:number};
  breaksGuard?:boolean;
};
// 调用者负责攻击实例的命中去重；统一入口只负责阵营、存活与伤害后果。
export function resolveDamage(event: DamageEvent, source: UnitRef, target: UnitRef) {
  if(source.hp<=0)return {applied:false,damage:0,hp:target.hp,killed:false};
  return damage(event,source,target);
}
export type ReleasedAttack=Readonly<{sourceId:string;faction:Faction;attackId:string;amount:number;sourceType:'tower-arrow'|'enemy-shot'|'companion-melee'|'companion-shot'|'companion-element';eventId:string|null}>;
// 合法释放的不可变快照没有HP字段；命中时不伪造已经死亡的射手仍存活。
export function resolveReleasedDamage(event:DamageEvent,source:ReleasedAttack,target:UnitRef){
  if(event.sourceType!==source.sourceType||event.attackId!==source.attackId||event.amount!==source.amount||event.eventId!==source.eventId)
    return {applied:false,damage:0,hp:target.hp,killed:false};
  return damage(event,{id:source.sourceId,faction:source.faction},target);
}
// 滚兽爆炸是明确允许波及敌人的环境攻击，仍检查来源、身份与存活。
export function resolveBlastDamage(event:DamageEvent,source:UnitRef,target:UnitRef){
  if(event.sourceType!=='enemy-blast'||source.faction!=='hostile'||source.hp<=0)return {applied:false,damage:0,hp:target.hp,killed:false};
  return damage(event,source,target,true);
}
function damage(event:DamageEvent,source:Pick<UnitRef,'id'|'faction'>,target:UnitRef,friendlyFire=false){
  if (event.sourceId !== source.id || event.targetId !== target.id ||
    source.id === target.id || (!friendlyFire&&source.faction === target.faction) || target.hp <= 0 ||
    !event.attackId || !Number.isFinite(event.amount) || event.amount <= 0)
    return { applied: false, damage: 0, hp: target.hp, killed: false };
  let damage = Math.max(event.sourceType==='player-rune'||event.sourceType==='player-phantom'||event.sourceType==='player-replay'?0:1, event.amount*(Math.max(0,Math.min(1,event.sourceScale??1))) - target.armor) * (1 - Math.max(0, Math.min(.8, target.reduction ?? 0)));
  // 百分比风甲独立乘算，其他护盾和减伤仍沿用既有规则。
  damage *= Math.max(0,Math.min(1,target.incomingScale??1));
  if (target.shield && target.shield.remaining > 0) {
    const absorbed = Math.min(target.shield.amount, damage);
    target.shield.amount -= absorbed; damage -= absorbed;
  }
  if(damage>0&&target.flatReduction)damage=Math.max(1,damage-Math.max(0,target.flatReduction));
  const hp = Math.max(Math.min(target.hp,target.hpFloor??0), target.hp - damage);
  if(target.hpFloor!==undefined)damage=target.hp-hp;
  return { applied: true, damage, hp, killed: hp === 0 };
}
