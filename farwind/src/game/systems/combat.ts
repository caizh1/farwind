import type { Facing } from "./locomotion";
import { sampleAttackTiming } from './attackTiming';
import { meleeBody, bodyIntersectsSector, MELEE_HEIGHT, type MeleeBodyTarget } from "./meleeGeometry";
import {SWORD_WIND, resolveSwordWindConfig,type SwordWindConfig} from '../../data/swordWind';

export const STRIKES = [
  {
    windup: 75,
    active: 115,
    recovery: 145,
    range: 92,
    angle: 1.12,
    damage: 18,
    step: 13,
    knock: 5,
    flash: 110,
    stagger: 75,
  },
  {
    windup: 90,
    active: 120,
    recovery: 155,
    range: 98,
    angle: 1.05,
    damage: 20,
    step: 16,
    knock: 7,
    flash: 110,
    stagger: 75,
  },
  {
    windup: 145,
    active: 130,
    recovery: 235,
    range: 108,
    angle: 0.95,
    damage: 30,
    step: 21,
    knock: 27,
    flash: 170,
    stagger: 170,
  },
  {
    windup: 190, active: 155, recovery: 330, range: 122, angle: 1.55,
    damage: 40, step: 12, knock: 36, flash: 190, stagger: 280,
  },
] as const;
export const COMBAT = {
  // 主角与普通敌人的脚底阴影半宽合计约40像素，首领保留更大占地。
  bodySpacing: 40,
  bossBodySpacing: 56,
  buffer: 150,
  dashAttackTail: 140,
  heavyDashTail: 110,
  finisherCancelTail: 120,
  grace: 200,
  chainWindow: 100,
  restartWindow: 150,
  ready: 200,
  settle: 160,
  trailLife: 110,
  hitStop: [36, 36, 58, 68],
  dash: {
    distance: 90,
    duration: 200,
    cost: 20,
    cooldown: 650,
    invulnStart: 40,
    invulnEnd: 140,
  },
} as const;
export const PLAYER_HURT = {duration:220,knock:14,knockDuration:110,sparkLife:120,poses:[0,55,140]} as const;
export type HurtReaction = {start:number;until:number;facing:Facing;direction:{x:number;y:number};root:{x:number;y:number}};
export const PARRY = {
  precise: 90,
  active: 240,
  recovery: 320,
  cooldown: 420,
  buffer: 150,
  speed: 60,
  halfAngle: (90 * Math.PI) / 180,
  cost: 12,
  bonus: 6,
  regenPause: 300,
  resume: 60,
  afterguard: 80,
  normal: { stagger: 600, stop: 55, knock: 6, damage: 24 },
  perfect: { stagger: 800, stop: 75, knock: 8, damage: 30 },
  counter: { windup: 55, step: 18 },
  visual: { flashLife: 160, core: 4.5, rayStart: 12, rayTravel: 16, trailLife: 150 },
} as const;
export type CounterKind = "normal" | "perfect";
export type StrikeConfig = { [K in keyof typeof STRIKES[0]]: number };
// 一个攻击实例解析一次；动画、剑风、命中和木桩读取同一份配置。
export function resolveStrike(stage: number, counter?: CounterKind): StrikeConfig {
  const base = STRIKES[stage - 1];
  return stage === 1 && counter
    ? { ...base, ...PARRY.counter, damage: PARRY[counter].damage }
    : { ...base };
}
export const attackConfig = (a: Pick<Attack, "stage" | "counter" | "config">) =>
  a.config ?? resolveStrike(a.stage, a.counter);
export const strikeDuration = (m: StrikeConfig) => m.windup + m.active + m.recovery;
export type ParryAction = {
  id: number; start: number; facing: Facing; actionUntil: number;
  successAt?: number; quality?: CounterKind; precisionBonus?:number;
};
export type ActionKind = "attack" | "wind" | "parry" | "dash";
export const actionPriority = { attack: 1, wind: 1, parry: 2, dash: 3 } as const;
export type ActionRequest = { windAuto?:boolean; kind: ActionKind; at: number; sequence: number; axis: {x:number;y:number} };
export type Target = MeleeBodyTarget & { id: string; hp: number; disabled?: boolean };
export type Attack = {
  kind?: "melee" | "swordWind" | "counter";
  rootActionId?: number;
  isFinisher?: boolean;
  resumed?: boolean;
  windLeg?: "out" | "back";
  returnMode?: "path" | "anchor";
  delivery?: "blade" | "wind";
  sourceContactId?: string;
  released?:boolean;
  swordWind?:SwordWindConfig;
  windDirection?:{x:number;y:number};
  id: number;
  comboId?: number;
  chainGraceBonus?:number;
  stage: number;
  facing: Facing;
  // 连续瞄准在起手时锁定，四向素材仅负责显示；旧实例回退到原朝向。
  aim?: Readonly<{x:number;y:number}>;
  start: number;
  hit: Set<string>;
  sounded?: boolean;
  enter?: boolean;
  counter?: CounterKind;
  config?: StrikeConfig;
  primaryTarget?: string;
  automatic?: boolean;
};
export const isWindAttack = (a: Pick<Attack, "kind" | "delivery">) => a.kind === 'swordWind' || a.delivery === 'wind';
export const isMeleeFinisher = (a: Attack, maxStage=3) => !isWindAttack(a) && !a.counter && (a.isFinisher ?? a.stage === maxStage);
export const facingVector = (d: Facing): [number, number] =>
  (
    [
      [0, 1],
      [0, -1],
      [-1, 0],
      [1, 0],
    ] as const
  )[d] as [number, number];
export function attackVector(a: Pick<Attack, 'facing' | 'aim' | 'windDirection'>): [number, number] {
  const d = a.windDirection ?? a.aim;
  return d ? [d.x, d.y] : facingVector(a.facing);
}
// 截到第一次身体接触，保证不同帧率停在同一边界；已有重叠允许向外退开。
function bodyMotionFraction(
  a: { x: number; y: number },
  b: { x: number; y: number },
  targets: readonly Target[],
) {
  const dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
  if (length === 0) return 1;
  let fraction = 1;
  for (const e of targets) {
    if (e.hp <= 0 || e.disabled) continue;
    const x = a.x - e.x, y = a.y - e.y, start = x * x + y * y;
    const spacing = e.boss ? COMBAT.bossBodySpacing : COMBAT.bodySpacing;
    const dot = x * dx + y * dy;
    if (start < spacing * spacing - 1e-7) {
      if (dot < 0) return 0;
      continue;
    }
    if (dot >= 0) continue;
    const discriminant = dot * dot - length * (start - spacing * spacing);
    if (discriminant <= 0) continue;
    const contact = (-dot - Math.sqrt(discriminant)) / length;
    fraction = Math.min(fraction, Math.max(0, contact));
  }
  return fraction;
}
export function clearBodyMotion(a: {x: number; y: number}, b: {x: number; y: number}, targets: readonly Target[]) {
  return bodyMotionFraction(a, b, targets) >= 1 - 1e-7;
}
export function sweepMove(
  p: { x: number; y: number },
  dx: number,
  dy: number,
  blocked: (x: number, y: number) => boolean,
  clear: (
    a: { x: number; y: number },
    b: { x: number; y: number },
  ) => boolean = () => true,
  bodies: readonly Target[] = [],
) {
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 6));
  for (let i = 0; i < n; i++) {
    const horizontal = { x: p.x + dx / n, y: p.y };
    horizontal.x = p.x + (horizontal.x - p.x) * bodyMotionFraction(p, horizontal, bodies);
    if (!blocked(horizontal.x, horizontal.y) && clear(p, horizontal))
      p.x = horizontal.x;
    const vertical = { x: p.x, y: p.y + dy / n };
    vertical.y = p.y + (vertical.y - p.y) * bodyMotionFraction(p, vertical, bodies);
    if (!blocked(vertical.x, vertical.y) && clear(p, vertical))
      p.y = vertical.y;
  }
}
export function inStrike(
  p: { x: number; y: number },
  e: Target,
  a: Attack,
  clearLine: (
    x: number,
    y: number,
    tx: number,
    ty: number,
    targetId: string,
  ) => boolean,
) {
  const m = attackConfig(a),
    [vx, vy] = attackVector(a);
  const dx = e.x - p.x,
    dy = e.y - p.y,
    d = Math.hypot(dx, dy);
  const body = meleeBody(e);
  return (
    !isWindAttack(a) &&
    e.hp > 0 &&
    !e.disabled &&
    (body
      ? bodyIntersectsSector(body, { x: p.x, y: p.y - MELEE_HEIGHT }, { x: vx, y: vy }, m.range, m.angle)
      : d <= m.range && d > 0 && (dx * vx + dy * vy) / d >= Math.cos(m.angle)) &&
    clearLine(p.x, p.y, e.x, e.y, e.id)
  );
}
export function enemyTint(now: number, flashUntil: number, windup: number) {
  return now < flashUntil ? 0xff8585 : windup > 0 ? 0xffce84 : null;
}
export class CombatController {
  resolvePhaseDash?: (origin:{x:number;y:number},end:{x:number;y:number})=>{x:number;y:number}|null;
  private dashPhaseChecked=false;
  private dashPhaseResolved=false;
  dashCostMultiplier=1;
  recoveryCancelEnabled=false;
  swordWindEnabled=false;
  swordWindConfig:SwordWindConfig|null=null;
  chainOwner:number|null=null;
  meleeFinisherEnabled=false;
  windHeld=false;
  windAuto=false;
  pendingWindAuto=false;
  resolveWindAim?: (p:{x:number;y:number},config:SwordWindConfig)=>{direction:{x:number;y:number};facing:Facing;target:string}|null;
  pendingKind: "attack" | "wind" = "attack";
  momentumWindow=0;
  momentumChase=0;
  momentum: {stage:number;comboId:number;until:number;chase:number}|null=null;
  momentumUsedCombo=-1;
  get maxStage(){return this.meleeFinisherEnabled?4:3;}
  parry: ParryAction | null = null;
  lastParry: ParryAction | null = null;
  parrySerial = 0;
  parryCooldown = 0;
  lastParryRequestAt: number | null = null;
  regenUntil = 0;
  actionLockUntil = 0;
  hurtReaction: HurtReaction | null = null;
  parryPending: {at:number;until:number;facing:Facing} | null = null;
  dashPending: {at:number;until:number;axis:{x:number;y:number};facing:Facing} | null = null;
  afterguard: {until:number;facing:Facing} | null = null;
  autoCounter: {at:number;successAt:number;kind:CounterKind;target:string;facing:Facing;delivery?:Attack["delivery"];sourceContactId?:string;direction?:{x:number;y:number}} | null = null;
  intentFacing: Facing = 0;
  intentAim: Readonly<{x:number;y:number}> | null = null;
  setIntent(axis:{x:number;y:number}) {
    if(!Math.hypot(axis.x,axis.y))return;
    const length=Math.hypot(axis.x,axis.y);
    this.intentAim=Object.freeze({x:axis.x/length,y:axis.y/length});
    this.intentFacing=Math.abs(axis.x)>Math.abs(axis.y)?axis.x<0?2:3:axis.y<0?1:0;
    if(this.parryPending)this.parryPending.facing=this.intentFacing;
  }
  lastRejection = "";
  attack: Attack | null = null;
  serial = 0;
  comboSerial = 0;
  bufferUntil = 0;
  requestedAt = 0;
  reservationOwner: number | null = null;
  hitStopRemaining = 0;
  lastHitStopRequested = 0;
  stoppedAttacks=new Set<number>();
  readyUntil = 0;
  settleUntil = 0;
  carryUntil = 0;
  epoch = 0;
  lastStage = 1;
  lastFacing: Facing = 0;
  pending = false;
  nextStage = 1;
  chainGraceBonus = 0;
  parryPrecisionBonus = 0;
  chainUntil = 0;
  dashStart = -1;
  dashArmed = false;
  dashUntil = 0;
  dashCooldown = 0;
  dashX = 0;
  dashY = 0;
  // 诊断使用同一模拟时钟；跨动作请求有独立的有限寿命，不改变连段预约。
  actionHistory: {kind:ActionKind;at:number;legal:number;executed?:number;cleared?:number;expires:number;reason:string}[]=[];
  private recordAction(kind:ActionKind,at:number,legal:number,expires:number,reason:string,executed?:number,cleared?:number) {
    if(executed!==undefined||cleared!==undefined)for(let i=this.actionHistory.length-1;i>=0;i--){const r=this.actionHistory[i];if(r.kind===kind&&r.at===at&&r.reason==='已接收'){legal=r.legal;break;}}
    this.actionHistory.push({kind,at,legal,expires,reason,executed,cleared});
    if(this.actionHistory.length>96)this.actionHistory.shift();
  }
  clearInputs(reason?:string,now=0) {
    this.windHeld=false;this.windAuto=false;
    if(reason){
      if(this.pending)this.recordAction('attack',this.requestedAt,now,this.bufferUntil,`已清理：${reason}`,undefined,now);
      if(this.parryPending)this.recordAction('parry',this.parryPending.at,now,this.parryPending.until,`已清理：${reason}`,undefined,now);
      if(this.dashPending)this.recordAction('dash',this.dashPending.at,now,this.dashPending.until,`已清理：${reason}`,undefined,now);
    }
    this.pending = false;
    this.bufferUntil = 0;
    this.reservationOwner = null;
    this.parryPending = null;
    this.dashPending = null;
  }
  cancelAttack() {
    this.momentum=null;
    this.attack = null;
    this.autoCounter = null;
    this.clearInputs();
    this.nextStage = 1;
    this.chainUntil = 0;
    this.chainOwner=null;
    this.readyUntil = 0;
    this.settleUntil = 0;
    this.carryUntil = 0;
    this.epoch++;
  }
  hurt() {
    this.cancelAttack();
    this.parry = null;
    this.actionLockUntil=0;
    this.autoCounter = null;
    this.afterguard = null;
    this.dashUntil = 0;
    this.dashStart = -1;
    this.dashArmed = false;
    this.hurtReaction = null;
    // 受伤不重置风步冷却、恢复暂停或模拟时钟。
  }
  // 仅在真实伤害应用后调用；练习切换等动作清理仍使用 hurt()。
  takeHit(now:number,facing:Facing,direction:{x:number;y:number},root:{x:number;y:number}) {
    this.clearInputs('受击',now);
    this.hurt();
    const length=Math.hypot(direction.x,direction.y),[x,y]=facingVector(facing);
    this.hurtReaction={start:now,until:now+PLAYER_HURT.duration,facing,
      direction:length>1e-7?{x:direction.x/length,y:direction.y/length}:{x,y},root:{x:root.x,y:root.y}};
    this.actionLockUntil=this.hurtReaction.until;
  }
  hurting(now:number) {return !!this.hurtReaction&&now>=this.hurtReaction.start&&now<this.hurtReaction.until;}
  parryLegalAt(now: number) {
    const a = this.attack;
    let legal = Math.max(now, this.dashUntil, this.parryCooldown, this.actionLockUntil);
    if (a) {
      const m = attackConfig(a), elapsed = now-a.start;
      if(a.kind==='swordWind'||a.stage===4) {
        if(elapsed>=m.windup)legal=Math.max(legal,a.start+(this.recoveryCancelEnabled?m.windup+m.active:strikeDuration(m)-(a.kind==='swordWind'?SWORD_WIND.cancelTail:COMBAT.finisherCancelTail)));
      }
      else if (a.stage === 3) legal = Math.max(legal,a.start+(this.recoveryCancelEnabled?m.windup+m.active:strikeDuration(m)-120));
      else if (elapsed >= m.windup && elapsed < m.windup+m.active)
        legal = Math.max(legal,a.start+m.windup+m.active);
    }
    return legal;
  }
  dashLegalAt(now:number) {
    const a=this.attack;
    let legal=Math.max(now,this.dashCooldown,this.dashUntil,this.actionLockUntil);
    if(a){const m=attackConfig(a);legal=Math.max(legal,a.start+(this.recoveryCancelEnabled?m.windup+m.active:strikeDuration(m)-(a.kind==='swordWind'?SWORD_WIND.cancelTail:a.stage===4?COMBAT.finisherCancelTail:a.stage===3?COMBAT.heavyDashTail:COMBAT.chainWindow)));}
    return legal;
  }
  requestParry(now: number, facing: Facing) {
    this.windHeld=false;this.windAuto=false;
    if(this.hurting(now)){this.lastRejection="受击恢复中";this.recordAction('parry',now,this.actionLockUntil,now+PARRY.buffer,this.lastRejection);return false;}
    if (this.parryPending && now > this.parryPending.until) this.parryPending = null;
    if (this.parryPending || (this.parry && this.parry.successAt === undefined && now < this.parry.actionUntil)) {this.lastRejection=this.parryPending?'已有弹反预约':'架剑动作进行中';this.recordAction('parry',now,this.parryLegalAt(now),now+PARRY.buffer,this.lastRejection);return false;}
    this.lastParryRequestAt=now;
    this.dashPending=null;
    this.parryPending = {at:now,until:now+PARRY.buffer,facing};
    this.lastRejection = "";
    this.recordAction('parry',now,this.parryLegalAt(now),now+PARRY.buffer,'已接收');
    return true;
  }
  // 同时输入在共同入口只取最高优先级；拒绝不会转为下一种动作。
  requestActions(requests: ActionRequest[], now: number, p: {stamina:number}, fallback: Facing) {
    if(this.hurting(now)){if(requests.length)this.lastRejection="受击恢复中";for(const r of requests)this.recordAction(r.kind,now,this.actionLockUntil,now+COMBAT.buffer,this.lastRejection);return;}
    const top = [...requests].sort((a,b)=>actionPriority[b.kind]-actionPriority[a.kind] || a.sequence-b.sequence)[0];
    if (!top) return;
    this.lastRejection='';
    for(const lower of requests)if(lower!==top)this.recordAction(lower.kind,now,now,now,'同帧优先级拒绝');
    const {axis} = top, facing: Facing = Math.hypot(axis.x,axis.y)
      ? Math.abs(axis.x)>Math.abs(axis.y) ? axis.x<0?2:3 : axis.y<0?1:0
      : this.intentFacing;
    if (top.kind === "parry") this.requestParry(now,facing);
    else if (top.kind === "wind") {this.setIntent(axis);this.requestSwordWind(now,top.windAuto??this.windAuto);}
    else if (top.kind === "attack") {this.setIntent(axis);this.requestAttack(now);}
    else {
      this.windHeld=false;this.windAuto=false;
      if (this.dashPending && now <= this.dashPending.until) return;
      this.parryPending = null;
      this.pending = false;
      this.dashPending = {at:now,until:now+COMBAT.buffer,axis:{...axis},facing};
      this.recordAction('dash',now,this.dashLegalAt(now),now+COMBAT.buffer,'已接收');
    }
  }
  flushActions(now: number, p: {stamina:number}) {
    const started: ActionKind[] = [];
    if(this.hurting(now)){this.clearInputs();return started;}
    if(this.autoCounter && now>=this.autoCounter.at && (this.dashPending||this.parryPending)) {this.autoCounter=null;this.pending=false;}
    if (this.afterguard && now >= this.afterguard.until) this.afterguard = null;
    if (this.parry && now >= this.parry.actionUntil) this.parry = null;
    const dash = this.dashPending;
    if (dash) {
      if (now > dash.until) {this.recordAction('dash',dash.at,this.dashLegalAt(now),dash.until,'缓冲到期');this.dashPending = null;}
      else if (this.requestDash(now,p.stamina,dash.axis,dash.facing)) {
        p.stamina -= (COMBAT.dash.cost*this.dashCostMultiplier);
        this.dashPending = null;
        this.recordAction('dash',dash.at,now,dash.until,'已执行',now);
        started.push("dash");
      } else this.lastRejection = p.stamina < (COMBAT.dash.cost*this.dashCostMultiplier) ? "体力不足" : "等待风步取消点";
    }
    const request = this.parryPending;
    if (request && !this.dashPending) {
      if (now > request.until) {this.recordAction('parry',request.at,this.parryLegalAt(now),request.until,'缓冲到期');this.parryPending = null;}
      else if (now >= this.parryLegalAt(now) && p.stamina >= PARRY.cost) {
        this.cancelAttack();
        this.parry = {id:++this.parrySerial,start:now,facing:request.facing,actionUntil:now+PARRY.recovery,precisionBonus:this.parryPrecisionBonus};
        this.actionLockUntil=now+PARRY.recovery;
        this.lastParry = this.parry;
        this.parryCooldown = now+PARRY.cooldown;
        this.regenUntil = now+PARRY.regenPause;
        this.afterguard = null;
        this.lastFacing = request.facing;
        p.stamina -= PARRY.cost;
        this.recordAction('parry',request.at,now,request.until,'已执行',now);
        started.push("parry");
      } else this.lastRejection = p.stamina < PARRY.cost ? "体力不足" : "动作不可取消";
    }
    return started;
  }
  parryQuality(now: number): CounterKind | null {
    const a = this.parry;
    if (!a || a.successAt !== undefined || now < a.start || now >= a.start+PARRY.active) return null;
    return now < a.start+PARRY.precise+(a.precisionBonus??this.parryPrecisionBonus) ? "perfect" : "normal";
  }
  succeedParry(now: number, kind: CounterKind, p: {stamina:number;x?:number;y?:number},target="",origin?:{x:number;y:number},counter?:{delivery:Attack["delivery"];sourceContactId:string;direction?:{x:number;y:number}},maximum=100) {
    const a = this.parry;
    if (!a || a.successAt !== undefined) return false;
    a.successAt = now;
    a.quality = kind;
    a.actionUntil = now+PARRY.resume;
    this.actionLockUntil=a.actionUntil;
    this.parryCooldown = a.actionUntil;
    this.afterguard = {until:now+PARRY.afterguard,facing:a.facing};
    const dx=counter?.direction?.x??(origin?(origin.x-(p.x??0)):0),dy=counter?.direction?.y??(origin?(origin.y-(p.y??0)):0);
    const facing:Facing=Math.hypot(dx,dy)>1e-7?Math.abs(dx)>Math.abs(dy)?dx<0?2:3:dy<0?1:0:a.facing;
    this.autoCounter={at:a.actionUntil,successAt:now,kind,target,facing,delivery:counter?.delivery,sourceContactId:counter?.sourceContactId,direction:Math.hypot(dx,dy)>1e-7?{x:dx/Math.hypot(dx,dy),y:dy/Math.hypot(dx,dy)}:undefined};
    if(this.pending&&this.requestedAt<now){this.pending=false;this.reservationOwner=null;}
    if(this.pending)this.bufferUntil=a.actionUntil+strikeDuration(resolveStrike(1,kind))-COMBAT.chainWindow+COMBAT.buffer;
    p.stamina = Math.min(maximum,p.stamina+PARRY.cost+(kind==="perfect"?PARRY.bonus:0));
    this.hitStopRemaining = Math.max(this.hitStopRemaining,PARRY[kind].stop);
    this.lastHitStopRequested=PARRY[kind].stop;
    this.readyUntil = a.actionUntil+COMBAT.ready;
    this.settleUntil = this.readyUntil+COMBAT.settle;
    this.lastStage = 1;
    this.lastFacing = a.facing;
    return true;
  }
  nextBoundary(now: number) {
    const boundaries: number[] = [];
    const a = this.attack;
    if(a) {
      const m=attackConfig(a),end=a.start+strikeDuration(m);
      boundaries.push(a.start+m.windup,a.start+m.windup+m.active,end,end-(a.stage<this.maxStage?COMBAT.chainWindow:0),end-120);
    }
    if(this.autoCounter)boundaries.push(this.autoCounter.at);
    if(this.parryPending) boundaries.push(this.parryLegalAt(now),this.parryPending.until);
    if(this.pending) boundaries.push(this.requestedAt,this.bufferUntil);
    if(this.dashPending) boundaries.push(this.dashLegalAt(now),this.dashPending.until);
    if(this.parry)boundaries.push(this.parry.actionUntil,this.parry.start+PARRY.precise+(this.parry.precisionBonus??this.parryPrecisionBonus),this.parry.start+PARRY.active);
    boundaries.push(this.dashUntil,this.dashStart+COMBAT.dash.invulnStart,this.dashStart+COMBAT.dash.invulnEnd,this.regenUntil,
      this.hurtReaction?.until??0,this.hurtReaction?this.hurtReaction.start+PLAYER_HURT.knockDuration:0);
    return Math.min(...boundaries.filter(t=>t>now+1e-7));
  }
  reset(cooldown = 0) {
    this.chainOwner=null;
    this.windHeld=false;this.windAuto=false;this.momentum=null;this.momentumUsedCombo=-1;
    this.parry = null;
    this.lastParry = null;
    this.intentFacing=0;
    this.intentAim=null;
    this.parryCooldown = 0;
    this.lastParryRequestAt=null;
    this.regenUntil = 0;
    this.actionLockUntil=0;
    this.hurtReaction=null;
    this.parryPending = null;
    this.dashPending = null;
    this.afterguard = null;
    this.autoCounter = null;
    this.attack = null;
    this.pending = false;
    this.bufferUntil = 0;
    this.requestedAt = 0;
    this.reservationOwner = null;
    this.hitStopRemaining = 0;
    this.lastHitStopRequested = 0;
    this.stoppedAttacks.clear();
    this.readyUntil = 0;
    this.settleUntil = 0;
    this.carryUntil = 0;
    this.epoch++;
    this.nextStage = 1;
    this.chainUntil = 0;
    this.dashStart = -1;
    this.dashArmed = false;
    this.dashUntil = 0;
    this.dashCooldown = cooldown;
    this.actionHistory=[];
  }
  requestSwordWind(now:number,automatic=this.windAuto) {
    if(!this.swordWindEnabled||this.hurting(now)||this.pending)return false;
    if(this.dashUntil-now>COMBAT.dashAttackTail)return false;
    const legal=this.attack?this.attack.start+strikeDuration(attackConfig(this.attack)):now;
    // 单个预约在当前动作结束时消费，按住只生成下一次，不累计补发。
    this.pending=true;this.pendingKind='wind';this.pendingWindAuto=automatic;this.requestedAt=now;
    this.reservationOwner=null;this.bufferUntil=Math.max(now,legal,this.actionLockUntil,this.dashUntil)+COMBAT.buffer;
    return true;
  }
  requestAttack(now: number) {
    if(this.hurting(now)){this.lastRejection="受击恢复中";this.recordAction('attack',now,this.actionLockUntil,now+COMBAT.buffer,this.lastRejection);return;}
    if (this.pending && now > this.bufferUntil) this.clearAttackReservation('缓冲到期',now);
    if(this.pending){this.lastRejection='已有同实例预约';this.recordAction('attack',now,now,now,this.lastRejection);return;}
    if(this.dashUntil>now&&this.dashUntil-now>COMBAT.dashAttackTail){
      this.lastRejection='风步输入过早';this.recordAction('attack',now,this.dashUntil,now+COMBAT.dashAttackTail,this.lastRejection);return;
    }
    if (
      this.attack && (this.attack.stage>=3||this.attack.kind==='swordWind') &&
      now < this.attack.start + this.total(this.attack.stage) - COMBAT.restartWindow
    ) {this.lastRejection='重击承诺阶段';this.recordAction('attack',now,this.attack.start+this.total(this.attack.stage),now+COMBAT.buffer,this.lastRejection);return;}
    this.pending = true;
    this.pendingKind="attack";
    this.lastRejection='';
    this.requestedAt = now;
    const a = this.attack;
    this.reservationOwner = a?.id ?? (now<=this.chainUntil ? this.chainOwner : null);
    this.bufferUntil = this.autoCounter
      ? this.autoCounter.at+strikeDuration(resolveStrike(1,this.autoCounter.kind))-COMBAT.chainWindow+COMBAT.buffer
      : this.parry && now < this.parry.actionUntil
        ? Math.max(now, this.parry.actionUntil) + COMBAT.buffer
        : a && a.kind!=='swordWind' && a.stage < this.maxStage
        ? Math.max(now, a.start + this.total(a.stage) - COMBAT.chainWindow) +
          COMBAT.buffer
        : now + (this.dashUntil>now?COMBAT.dashAttackTail:COMBAT.buffer);
    this.recordAction('attack',now,this.dashUntil>now?this.dashUntil:a?a.start+this.total(a.stage)-(a.stage<this.maxStage?COMBAT.chainWindow:0):now,this.bufferUntil,'已接收');
  }
  // 表现停顿冻结整个世界模拟；使用未冻结的帧delta扣减，不累计多目标时长。
  stopOnHit(stage: number,attackId?:number,duration:number=COMBAT.hitStop[stage-1]) {
    if(attackId!==undefined){if(this.stoppedAttacks.has(attackId))return false;this.stoppedAttacks.add(attackId);if(this.stoppedAttacks.size>32)this.stoppedAttacks.delete(this.stoppedAttacks.values().next().value!);}
    this.lastHitStopRequested=duration;
    this.hitStopRemaining = Math.max(
      this.hitStopRemaining,
      duration,
    );
    return true;
  }
  advanceFrame(delta: number) {
    const spent = Math.min(Math.max(0, delta), this.hitStopRemaining);
    this.hitStopRemaining -= spent;
    return Math.max(0, delta - spent);
  }
  requestDash(
    now: number,
    stamina: number,
    axis: { x: number; y: number },
    facing: Facing,
  ) {
    const a = this.attack;
    facing = this.effectiveFacing(now, facing);
    if (
      now < this.dashLegalAt(now) ||
      stamina < (COMBAT.dash.cost*this.dashCostMultiplier)
      || now < this.actionLockUntil
    )
      return false;
    const stage=a&&a.kind!=='swordWind'&&now>=a.start+attackConfig(a).windup+attackConfig(a).active&&a.stage<this.maxStage?a.stage+1:
      !a&&now<=this.chainUntil?this.nextStage:1;
    const combo=a?.comboId??this.comboSerial;
    const retained=this.momentum;
    this.momentum=null;
    if(this.momentumWindow>0&&stage>1&&this.momentumUsedCombo!==combo){
      this.momentum={stage,comboId:combo,until:now+COMBAT.dash.duration+this.momentumWindow,chase:this.momentumChase};
      this.momentumUsedCombo=combo;
    }
    // 第二次风步直接清掉保留，不能刷新窗口。
    if(retained)this.momentum=null;
    this.windHeld=false;this.windAuto=false;
    this.dashArmed = !!a || now < this.settleUntil || now < this.carryUntil;
    this.afterguard = null;
    this.autoCounter = null;
    this.parry = null;
    this.parryPending = null;
    this.attack = null;
    this.pending = false;
    this.nextStage = 1;
    this.chainUntil = 0;
    this.chainOwner=null;
    this.readyUntil = 0;
    this.settleUntil = 0;
    this.carryUntil = 0;
    this.epoch++;
    const len = Math.hypot(axis.x, axis.y),
      [fx, fy] = facingVector(facing);
    this.dashX = len ? axis.x / len : fx;
    this.dashY = len ? axis.y / len : fy;
    this.dashStart = now;
    this.dashPhaseChecked=false;this.dashPhaseResolved=false;
    this.dashUntil = now + COMBAT.dash.duration;
    this.dashCooldown = now + COMBAT.dash.cooldown;
    if (this.dashArmed) {
      this.lastFacing =
        Math.abs(this.dashX) > Math.abs(this.dashY)
          ? this.dashX < 0
            ? 2
            : 3
          : this.dashY < 0
            ? 1
            : 0;
      this.lastStage = 1;
      this.readyUntil = this.dashUntil + COMBAT.ready;
      this.settleUntil = this.readyUntil + COMBAT.settle;
    }
    return true;
  }
  effectiveFacing(now: number, fallback: Facing): Facing {
    return (
      (this.hurting(now)?this.hurtReaction!.facing:undefined) ??
      (this.parry && now < this.parry.actionUntil ? this.parry.facing : undefined) ??
      this.attack?.facing ??
      (now < this.settleUntil ? this.lastFacing : fallback)
    );
  }
  leaveReady(now = 0) {
    if (this.settleUntil > now) this.carryUntil = now + COMBAT.settle;
    this.readyUntil = 0;
    this.settleUntil = 0;
  }
  total(stage: number) {
    return strikeDuration(this.attack?.stage === stage ? attackConfig(this.attack) : resolveStrike(stage));
  }
  phase(now: number) {
    if(this.hurting(now))return "hurt";
    const a = this.attack;
    if (!a) return "idle";
    const m = attackConfig(a);
    return sampleAttackTiming(now,a.start,m.windup,m.active,m.recovery).phase;
  }
  invulnerable(now: number) {
    return (
      this.dashStart >= 0 &&
      now >= this.dashStart + COMBAT.dash.invulnStart &&
      now < this.dashStart + COMBAT.dash.invulnEnd
    );
  }
  update<T extends Target>(
    prev: number,
    now: number,
    facing: Facing,
    p: { x: number; y: number },
    targets: T[],
    blocked: (x: number, y: number) => boolean,
    clearLine: (
      x: number,
      y: number,
      tx: number,
      ty: number,
      targetId: string,
    ) => boolean,
    hit: (target: T, stage: number, attack: Attack) => void,
    started: (stage: number, attack: Attack) => void,
    swung: (stage: number) => void = () => {},
    motionClear: (
      a: { x: number; y: number },
      b: { x: number; y: number },
    ) => boolean = () => true,
    released: (attack:Attack,root:{x:number;y:number},at:number)=>void = ()=>{},
  ) {
    // 按事件时刻推进：请求到达、可衔接、结束、到期，等于到期仍合法。
    let cursor = prev;
    for (let guard = 0; guard < 8; guard++) {
      if(this.momentum&&cursor>this.momentum.until)this.momentum=null;
      if(this.windHeld&&!this.attack&&!this.pending&&!this.parryPending&&!this.dashPending&&!this.autoCounter&&cursor>=this.dashUntil&&cursor>=this.actionLockUntil)this.requestSwordWind(cursor);
      const a = this.attack;
      if(this.pending && this.reservationOwner!==null && this.reservationOwner!==(a?.id??this.chainOwner))this.clearAttackReservation('所属攻击已失效',cursor);
      if(this.pending && !a && this.reservationOwner!==null && cursor>this.chainUntil)this.clearAttackReservation('连段窗口到期',cursor);
      const end = a ? a.start + this.total(a.stage) : Infinity;
      const legal = a ? end - (this.pendingKind==='attack'&&a.kind!=='swordWind'&&a.stage < this.maxStage ? COMBAT.chainWindow : 0) : cursor;
      const auto = this.autoCounter;
      const startAt = auto && !this.parryPending && !this.dashPending
        ? Math.max(cursor,auto.at,this.actionLockUntil,this.dashUntil)
        : this.pending && !this.parryPending && !this.dashPending
        ? Math.max(cursor, this.requestedAt, legal, this.actionLockUntil, this.dashUntil)
        : Infinity;
      const consumeAt = auto || startAt <= this.bufferUntil ? startAt : Infinity;
      const stop = Math.min(now, end, consumeAt);
      if (a) {
        const m = attackConfig(a);
        const timing=sampleAttackTiming(cursor,a.start,m.windup,m.active,m.recovery);
        const from = timing.activeAt, until = timing.recoveryAt;
        const overlap = Math.max(
          0,
          Math.min(stop, until) - Math.max(cursor, from),
        );
        const [vx, vy] = attackVector(a);
        // 移动前后都检测，避免长步长先越过目标才检测扇形。
        const resolve = () => {
          if(isWindAttack(a))return;
          for (const e of targets)
            if ((!a.primaryTarget||a.primaryTarget===e.id) && !a.hit.has(e.id) && inStrike(p, e, a, clearLine)) {
              a.hit.add(e.id);
              hit(e, a.stage, a);
            }
        };
        if (stop >= from && cursor < until) {
          if(isWindAttack(a) && !a.released) {a.released=true;released(a,{...p},from);}
          if (!a.sounded) {
            a.sounded = true;
            swung(a.stage);
          }
          resolve();
          const steps = Math.max(1, Math.ceil((m.step * overlap) / m.active));
          for (let i = 0; i < steps; i++) {
            sweepMove(
              p,
              (vx * m.step * overlap) / m.active / steps,
              (vy * m.step * overlap) / m.active / steps,
              blocked,
              motionClear,
              targets,
            );
            resolve();
          }
        }
        if (stop >= end) {
          this.attack = null;
          this.nextStage = a.kind!=='swordWind'&&a.stage < this.maxStage ? a.stage + 1 : 1;
          this.chainUntil = a.kind!=='swordWind'&&a.stage < this.maxStage ? end + COMBAT.grace + (a.chainGraceBonus??this.chainGraceBonus) : 0;
          this.chainOwner=a.kind!=='swordWind'&&a.stage<this.maxStage?a.id:null;
          this.lastStage = a.stage;
          this.lastFacing = a.facing;
          this.readyUntil = end + COMBAT.ready;
          this.settleUntil = this.readyUntil + COMBAT.settle;
        }
      }
      if (consumeAt <= now && consumeAt <= end) {
        const counter = auto?.kind;
        const wind=!counter&&this.pendingKind==='wind';
        const retained=!counter&&!wind&&this.momentum&&consumeAt<=this.momentum.until?this.momentum:null;
        const stage = counter||wind ? 1 : retained?retained.stage : a
          ? a.kind!=='swordWind'&&a.stage < this.maxStage
            ? a.stage + 1
            : 1
          : consumeAt <= this.chainUntil && this.nextStage <= this.maxStage
            ? this.nextStage
            : 1;
        if(!auto)this.pending = false;
        if(!auto)this.recordAction('attack',this.requestedAt,consumeAt,this.bufferUntil,'已执行',consumeAt);
        const windAim=wind&&this.pendingWindAuto?this.resolveWindAim?.(p,this.swordWindConfig??resolveSwordWindConfig()):null;
        const attackFacing=windAim?.facing??auto?.facing??(this.intentAim?this.intentFacing:facing);
        const [ax,ay]=facingVector(attackFacing);
        const aim=windAim?.direction??auto?.direction??(auto?{x:ax,y:ay}:this.intentAim??{x:ax,y:ay});
        this.attack = {
          id: ++this.serial,
          chainGraceBonus:this.chainGraceBonus,
          kind: counter?'counter':wind?'swordWind':'melee',
          rootActionId:this.serial,
          isFinisher:!counter&&!wind&&stage===this.maxStage,
          resumed:!!retained,
          comboId: retained?retained.comboId:stage === 1 ? ++this.comboSerial : this.comboSerial,
          stage,
          facing: attackFacing,
          aim: Object.freeze({...aim}),
          primaryTarget: windAim?.target??(auto?.target || undefined),
          automatic: !!auto,
          delivery: auto?.delivery??(wind?"wind":"blade"),
          sourceContactId: auto?.sourceContactId,
          windDirection: windAim?{...windAim.direction}:auto?.direction ? {...auto.direction} : undefined,
          start: consumeAt,
          enter: !a && consumeAt >= this.settleUntil,
          hit: new Set(),
          counter,
          config: wind?{...SWORD_WIND.strike}:resolveStrike(stage, counter),
          swordWind:wind?structuredClone(this.swordWindConfig??resolveSwordWindConfig()):undefined,
        };
        if(retained?.chase){
          const [x,y]=attackVector(this.attack);
          sweepMove(p,x*retained.chase,y*retained.chase,blocked,motionClear,targets);
        }
        this.momentum=null;
        if(auto&&this.pending){this.reservationOwner=this.attack.id;this.bufferUntil=consumeAt+this.total(1)-COMBAT.chainWindow+COMBAT.buffer;}
        this.autoCounter = null;
        this.afterguard = null;
        this.parry = null;
        this.lastFacing = this.attack.facing;
        this.lastStage = stage;
        this.readyUntil = 0;
        this.settleUntil = 0;
        this.carryUntil = 0;
        this.nextStage = 1;
        this.chainUntil = 0;
        started(stage, this.attack);
      }
      cursor = stop;
      if (stop >= now) break;
    }
    if (this.pending && now > this.bufferUntil) this.clearAttackReservation('缓冲到期',now);
    if (this.dashUntil > prev) {
      const fraction =
        (Math.min(now, this.dashUntil) - Math.max(prev, this.dashStart)) /
        COMBAT.dash.duration;
      if(fraction>0&&!this.dashPhaseChecked){
        this.dashPhaseChecked=true;
        const end=this.resolvePhaseDash?.({...p},{x:p.x+this.dashX*COMBAT.dash.distance,y:p.y+this.dashY*COMBAT.dash.distance});
        if(end){p.x=end.x;p.y=end.y;this.dashPhaseResolved=true;}
      }
      if (fraction > 0&&!this.dashPhaseResolved)
        sweepMove(
          p,
          this.dashX * COMBAT.dash.distance * fraction,
          this.dashY * COMBAT.dash.distance * fraction,
          blocked,
          motionClear,
        );
    }
    if (this.dashUntil <= now) this.dashStart = -1;
    const hurt=this.hurtReaction;
    if(hurt&&now>prev) {
      const progress=(time:number)=>{const u=Math.max(0,Math.min(1,(time-hurt.start)/PLAYER_HURT.knockDuration));return 1-(1-u)**2;};
      const distance=(progress(now)-progress(prev))*PLAYER_HURT.knock;
      if(distance>0)sweepMove(p,hurt.direction.x*distance,hurt.direction.y*distance,blocked,motionClear);
    }
  }
  clearAttackReservation(reason?:string,now=0){if(this.pending&&reason)this.recordAction('attack',this.requestedAt,now,this.bufferUntil,reason,undefined,now);this.pending=false;this.bufferUntil=0;this.reservationOwner=null;}
  diagnostic(now: number) {
    const m = this.attack ? attackConfig(this.attack) : null;
    return {
      windHeld:this.windHeld,meleeFinisherEnabled:this.meleeFinisherEnabled,
      momentum:this.momentum&&now<=this.momentum.until?{...this.momentum,remaining:this.momentum.until-now}:null,
      actionKind:this.attack?.kind??null,isFinisher:!!this.attack?.isFinisher,
      hurt:this.hurtReaction?{...this.hurtReaction,remaining:Math.max(0,this.hurtReaction.until-now),active:this.hurting(now)}:null,
      parry: this.parry ? {...this.parry, elapsed:now-this.parry.start, remaining:Math.max(0,this.parry.actionUntil-now)} : null,
      parrySerial: this.parrySerial,
      parryBuffered: this.parryPending,
      parryCooldownRemaining: Math.max(0,this.parryCooldown-now),
      regenPaused: now < this.regenUntil,
      afterguard: this.afterguard && now < this.afterguard.until ? this.afterguard : null,
      autoCounter: this.autoCounter,
      intentFacing: this.intentFacing,
      intentAim: this.intentAim,
      attackAim: this.attack?.aim ?? null,
      automatic: !!this.attack?.automatic,
      primaryTarget: this.attack?.primaryTarget ?? null,
      delivery: this.attack?.delivery ?? this.autoCounter?.delivery ?? (this.attack&&isWindAttack(this.attack)?'wind':'blade'),
      sourceContactId: this.attack?.sourceContactId ?? this.autoCounter?.sourceContactId ?? null,
      windDirection: this.attack?.windDirection ?? this.autoCounter?.direction ?? null,
      status: this.hurting(now)?"受击恢复中":this.parryPending ? this.lastRejection==="体力不足"?"体力不足":"已缓冲" : this.parry ? this.parry.successAt!==undefined?"成功 · 自动反斩":now<this.parry.start+PARRY.active?"架剑已发动":"空弹恢复" : pStatus(this,now),
      attackConfig: m,
      counterAttack: this.attack?.counter ?? null,
      lastRejection: this.lastRejection,
      actions: this.actionHistory,
      recoveryCancelEnabled:this.recoveryCancelEnabled,
      parryLegalAt:this.parryLegalAt(now),
      dashLegalAt: this.dashLegalAt(now),
      phase: this.phase(now),
      effectiveFacing: this.effectiveFacing(now, this.lastFacing),
      ready: !this.attack && now >= this.dashUntil && now < this.readyUntil,
      reservationOwner: this.pending ? this.reservationOwner : null,
      hitStopRemaining: this.hitStopRemaining,
      lastHitStopRequested: this.lastHitStopRequested,
      bufferArrivedAt: this.pending ? this.requestedAt : null,
      bufferExpiresAt: this.pending ? this.bufferUntil : null,
      stage: this.attack?.stage ?? 0,
      attackInstanceId: this.attack?.id ?? null,
      comboId: this.attack?.comboId ?? null,
      facing: this.attack?.facing ?? null,
      hitRegion: m ? { range: m.range, halfAngle: m.angle } : null,
      hitTargets: [...(this.attack?.hit ?? [])],
      buffered: this.pending,
      bufferRemaining: this.pending ? Math.max(0, this.bufferUntil - now) : 0,
      dashRemaining: Math.max(0, this.dashUntil - now),
      dashCooldownRemaining: Math.max(0, this.dashCooldown - now),
      dashInvulnerable: this.invulnerable(now),
    };
  }
}

function pStatus(c:CombatController,now:number) {return c.parryLegalAt(now)>now?"当前动作不可取消":"K 架剑就绪";}
