import type { Facing } from './locomotion';
import type { EnemyAttack } from './enemyAttack';

// 样片只采样表现，不改敌人攻击、位移、伤害或存档。
export const SLIME_ART = { frameSize: 128, rootX: 64, rootY: 110, displaySize: 128 * 44 / 60 } as const;
export const SLIME_TIMES = {
  idle: [250, 250, 250, 250],
  hurt: [45, 70, 105, 100],
  death: [90, 100, 120, 150, 180, 200, 220, 240],
  parry: [20, 25, 30, 35, 55, 90, 90, 60, 50, 50, 45, 50],
  perfect: [20, 25, 30, 35, 55, 190, 190, 60, 50, 50, 45, 50],
} as const;
export type SlimeAction = 'idle' | 'walk' | 'attack' | 'hurt' | 'parry' | 'perfect' | 'death';
export type SlimePose = { action: SlimeAction; frame: number; index: number; facing: Facing; phase: string; elapsed: number; provisional: true };
export function timedPose(times: readonly number[], elapsed: number, loop = false) {
  const total = times.reduce((a, b) => a + b, 0);
  let t = Math.max(0, elapsed);
  if (loop) t %= total;
  for (let i = 0; i < times.length; i++) { if (t < times[i]) return i; t -= times[i]; }
  return times.length - 1;
}
export function slimeFacing(x: number, y: number, previous: Facing = 0): Facing {
  if (Math.abs(x) + Math.abs(y) < 1e-7) return previous;
  if (Math.abs(x) > Math.abs(y) * 1.2) return x < 0 ? 2 : 3;
  if (Math.abs(y) > Math.abs(x) * 1.2) return y < 0 ? 1 : 0;
  return previous >= 2 ? x < 0 ? 2 : 3 : y < 0 ? 1 : 0;
}
export function slimePose(action: SlimeAction, facing: Facing, elapsed: number, distance = 0, attack?: EnemyAttack | null): SlimePose {
  const offset = (facing === 0 ? 0 : facing === 1 ? 1 : 2) * 48;
  let index = 0, frame = 0, phase: string = action;
  if (action === 'walk') { index = Math.floor((Math.max(0, distance) % 32) / 32 * 8); frame = 4 + index; }
  else if (action === 'attack' && attack) {
    const charge = attack.lockAt - attack.startedAt, lock = attack.contactAt - attack.lockAt;
    const active = attack.activeUntil - attack.contactAt, recovery = attack.recoveryUntil - attack.activeUntil;
    // 锁向占前摇末段，不另加一段前摇；全部边界来自真实攻击实例。
    const boundaries = [0, charge * .2, charge * .55, charge * .86, charge, charge + lock * .5,
      charge + lock, charge + lock + active * .5,
      charge + lock + active, charge + lock + active + recovery * .23,
      charge + lock + active + recovery * .5, charge + lock + active + recovery * .79];
    for (let i = 1; i < boundaries.length; i++) if (elapsed >= boundaries[i]) index = i;
    frame = 12 + index;
    phase = index < 4 ? 'charge' : index < 6 ? 'commit' : index < 8 ? 'active' : 'recovery';
  } else {
    const times = action === 'attack' ? SLIME_TIMES.idle : SLIME_TIMES[action];
    index = timedPose(times, elapsed, action === 'idle');
    frame = (action === 'hurt' ? 24 : action === 'death' ? 28 : action === 'parry' || action === 'perfect' ? 36 : 0) + index;
    if (action === 'parry' || action === 'perfect') phase = index < 4 ? 'impact' : index < 7 ? 'stagger' : 'recover';
  }
  return { action, frame: offset + frame, index, facing, phase, elapsed, provisional: true };
}
export type SlimeBody = { x: number; y: number; hp?: number; parried?: { at: number; until: number; direction: { x: number; y: number }; perfect: boolean } };
export class SlimeAnimation {
  facing: Facing = 0;
  distance = 0;
  hurtAt = -Infinity;
  deathAt = -Infinity;
  last?: { x: number; y: number; hp?: number; now: number };
  sample(body: SlimeBody, attack: EnemyAttack | null | undefined, now: number): SlimePose {
    const previous = this.last;
    if (previous && now < previous.now) { this.last = undefined; this.distance = 0; this.hurtAt = this.deathAt = -Infinity; }
    const last = this.last;
    if (last?.hp !== undefined && body.hp !== undefined && body.hp < last.hp) {
      if (body.hp <= 0) this.deathAt = now;
      else this.hurtAt = now;
    }
    const delta = last ? Math.hypot(body.x - last.x, body.y - last.y) : 0;
    const dt = last ? now - last.now : 0;
    const parried = body.parried && now < body.parried.until ? body.parried : null;
    const attacking = attack && !attack.cancelled && now < attack.recoveryUntil ? attack : null;
    const hurt = now - this.hurtAt < 320;
    // 只累计自主移动；攻击冲步、击退、零时差和传送不驱动移动循环。
    const moving = dt > 0 && delta > .001 && delta <= dt / 1000 * 180 + .5 && !attacking && !parried && !hurt && (body.hp ?? 1) > 0;
    if (parried) this.facing = slimeFacing(parried.direction.x, parried.direction.y, this.facing);
    else if (attacking) this.facing = slimeFacing(attacking.direction.x, attacking.direction.y, this.facing);
    else if (moving && last) { this.facing = slimeFacing(body.x - last.x, body.y - last.y, this.facing); this.distance += delta; }
    this.last = { x: body.x, y: body.y, hp: body.hp, now };
    if ((body.hp ?? 1) <= 0) {
      if (!Number.isFinite(this.deathAt)) this.deathAt = now;
      return slimePose('death', this.facing, now - this.deathAt);
    }
    if (parried) return slimePose(parried.perfect ? 'perfect' : 'parry', this.facing, now - parried.at);
    if (hurt) return slimePose('hurt', this.facing, now - this.hurtAt);
    if (attacking) return slimePose('attack', this.facing, now - attacking.startedAt, 0, attacking);
    return slimePose(moving ? 'walk' : 'idle', this.facing, now, this.distance);
  }
}
