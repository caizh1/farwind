export type Faction = "village" | "hostile";
export type UnitRef = { id: string; faction: Faction; hp: number; armor: number };
export type DamageEvent = {
  sourceId: string; targetId: string; attackId: string; amount: number;
  sourceType: "player-melee" | "player-wind" | "guard-melee" | "tower-arrow" | "enemy-melee";
  eventId: string | null;
};
// 调用者负责攻击实例的命中去重；统一入口只负责阵营、存活与伤害后果。
export function resolveDamage(event: DamageEvent, source: UnitRef, target: UnitRef) {
  if(source.hp<=0)return {applied:false,damage:0,hp:target.hp,killed:false};
  return damage(event,source,target);
}
export type ReleasedAttack=Readonly<{sourceId:string;faction:Faction;attackId:string;amount:number;sourceType:'tower-arrow';eventId:string|null}>;
// 合法释放的不可变快照没有HP字段；命中时不伪造已经死亡的射手仍存活。
export function resolveReleasedDamage(event:DamageEvent,source:ReleasedAttack,target:UnitRef){
  if(event.sourceType!==source.sourceType||event.attackId!==source.attackId||event.amount!==source.amount||event.eventId!==source.eventId)
    return {applied:false,damage:0,hp:target.hp,killed:false};
  return damage(event,{id:source.sourceId,faction:source.faction},target);
}
function damage(event:DamageEvent,source:Pick<UnitRef,'id'|'faction'>,target:UnitRef){
  if (event.sourceId !== source.id || event.targetId !== target.id ||
    source.id === target.id || source.faction === target.faction || target.hp <= 0 ||
    !event.attackId || !Number.isFinite(event.amount) || event.amount <= 0 || event.amount > 10000)
    return { applied: false, damage: 0, hp: target.hp, killed: false };
  const damage = Math.max(1, event.amount - target.armor);
  const hp = Math.max(0, target.hp - damage);
  return { applied: true, damage, hp, killed: hp === 0 };
}
