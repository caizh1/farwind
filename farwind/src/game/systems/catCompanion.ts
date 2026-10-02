import {playerVitals} from './journeyTraining';
import { props, type Prop } from '../../data/world';
import { southResourceBlock } from './southEvents';
import { catBenefits, catRemember, catStage, catTrailKey, catDay, catCareGain, type CatCare } from './catBond';
import {validate,remove,type State} from './state';
export function catCareSnapshot(s:State,kind:CatCare){
  if(kind!=='pet'&&kind!=='feed')throw Error('未知的相处方式。');
  const next=validate(s);catDay(next.catBond,next.time);
  if(next.catBond[kind])throw Error('今天已经相处过了，明天再来。');
  if(kind==='feed'&&(next.catBond.score===100||!remove(next,'berry',1)))throw Error(next.catBond.score===100?'你们已心有灵犀，不必再为默契消耗浆果。':'行囊里没有浆果。');
  catCareGain(next.catBond,kind,next.time);return next;
}
type Point = { x: number; y: number };
export type CatTarget = Point & { id: string; hp: number; disabled?: boolean; passiveRoot?: unknown };
export type CatHint = Point & { id: string; label: string };
export type CatEvent = { kind: 'bond' | 'unlock' | 'claw' | 'mark' | 'boost' | 'guard' | 'absorb' | 'hint' | 'care'; point: Point; text: string };
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export class CatCompanion {
  aura = false;
  grace = 0;
  mark: { id: string; remaining: number; bonus: number } | null = null;
  pounce: { id: string; remaining: number } | null = null;
  hint: CatHint | null = null;
  hintWait = 0;
  private hintVoice = 0;
  private travelCell = '';
  private travelDistance = 0;
  private lastClaw = '';
  private events: CatEvent[] = [];
  metrics = { marks: 0, boosts: 0, guard: 0, absorbed: 0, gained: 0 };
  reset() {
    this.aura = false; this.grace = 0; this.mark = this.pounce = this.hint = null;
    this.hintWait = this.hintVoice = this.travelDistance = 0; this.travelCell = this.lastClaw = '';
    this.events = []; this.metrics = { marks: 0, boosts: 0, guard: 0, absorbed: 0, gained: 0 };
  }
  transition() { this.aura = false; this.grace = 0; this.mark = this.pounce = this.hint = null; this.travelDistance = 0; this.travelCell = ''; this.events=[]; }
  advance(s: State, ms: number, cat: Point, clear: (a: Point, b: Point) => boolean) {
    const c = s.catBond;
    for (const key of ['clawCooldown', 'guardCooldown', 'shieldTime'] as const) c[key] = Math.max(0, c[key] - ms);
    if (c.shieldTime === 0) c.shield = 0;
    if (distance(cat, s.player) <= 280 && clear(cat, s.player)) this.grace = 1600;
    else this.grace = Math.max(0, this.grace - ms);
    this.aura = this.grace > 0 && s.player.hp > 0;
    if (this.mark) { this.mark.remaining -= ms; if (this.mark.remaining <= 0) this.mark = null; }
    if (this.pounce) { this.pounce.remaining -= ms; if (this.pounce.remaining <= 0) this.pounce = null; }
    this.hintWait -= ms; this.hintVoice = Math.max(0, this.hintVoice - ms);
  }
  remember(s: State, key: string, point: Point) {
    if (!this.aura || s.life.playerSpace !== 'village' || s.player.hp <= 0) return 0;
    const stage = catStage(s.catBond.score), gained = catRemember(s.catBond, key);
    this.metrics.gained += gained;
    if (gained) this.events.push({ kind: 'bond', point: { x:point.x,y:point.y }, text: `默契 +${gained}` });
    const next = catStage(s.catBond.score);
    if (next > stage) this.events.push({ kind: 'unlock', point: { ...s.player }, text: next === 4 ? '心有灵犀 · 小黑的四项能力已强化' : ['灵猫同行', '寻风嗅迹', '影爪共鸣', '护主灵息'][next] + '已解锁' });
    return gained;
  }
  travel(s: State, from: Point, ms: number, allowed: boolean) {
    const length = distance(from, s.player), key = catTrailKey(s.player);
    if (!allowed || !this.aura || s.life.playerSpace !== 'village' || length > 400 * ms / 1000 + 2) {
      this.travelCell = ''; this.travelDistance = 0; return;
    }
    if (this.travelCell !== key) { this.travelCell = key; this.travelDistance = 0; }
    if (!key || s.catBond.memories.includes(key)) return;
    this.travelDistance += length;
    if (this.travelDistance >= 160) { this.remember(s, key, s.player); this.travelDistance = 0; }
  }
  requestClaw(s: State, cat: Point, target: CatTarget, action: string, clear: (a: Point, b: Point) => boolean) {
    if (!this.aura || !catBenefits(s.catBond.score).claw || s.catBond.clawCooldown > 0 || action === this.lastClaw ||
      s.life.playerSpace !== 'village' || target.hp <= 0 || target.disabled || target.passiveRoot ||
      distance(s.player, target) > 300 || distance(cat, target) > 300 || !clear(cat, target)) return false;
    this.lastClaw = action; s.catBond.clawCooldown = 12000;
    this.pounce = { id: target.id, remaining: 1400 };
    this.hint = null;
    this.events.push({ kind: 'claw', point: { x:cat.x,y:cat.y }, text: '影爪协同' });
    return true;
  }
  pounceGoal(s: State, cat: Point, targets: readonly CatTarget[], clear: (a: Point, b: Point) => boolean): Point | null {
    if (!this.pounce) return null;
    const target = targets.find(t => t.id === this.pounce!.id && t.hp > 0 && !t.disabled);
    if (!this.aura || !target || distance(s.player, target) > 360 || !clear(cat, target)) { this.pounce = null; return null; }
    if (distance(cat, target) <= 65) {
      this.mark = { id: target.id, remaining: 5000, bonus: catBenefits(s.catBond.score).markBonus };
      this.pounce = null; this.metrics.marks++;
      this.events.push({ kind: 'mark', point: { x:target.x,y:target.y }, text: '影爪印记' });
      return null;
    }
    const gap = distance(cat, target), direction = { x: (cat.x - target.x) / gap, y: (cat.y - target.y) / gap };
    return { x: target.x + direction.x * 48, y: target.y + direction.y * 48 };
  }
  multiplier(s: State, target: CatTarget) {
    return this.aura && catBenefits(s.catBond.score).claw && target.hp > 0 && this.mark?.id === target.id && this.mark.remaining > 0 ? 1 + this.mark.bonus : 1;
  }
  landed(target: CatTarget, amount: number, boosted: boolean) {
    if (!boosted || amount <= 0 || this.mark?.id !== target.id) return;
    this.mark = null; this.metrics.boosts++;
    this.events.push({ kind: 'boost', point: { x:target.x,y:target.y }, text: '影爪共鸣' });
  }
  absorb(s: State, damage: number) {
    const c = s.catBond, absorbed = c.shieldTime > 0 ? Math.min(c.shield, damage) : 0;
    c.shield -= absorbed; this.metrics.absorbed += absorbed;
    if (absorbed > 0) this.events.push({ kind: 'absorb', point: { ...s.player }, text: `灵息抵挡 ${Math.round(absorbed)}` });
    return absorbed;
  }
  protect(s:State,hit:{damage:number;hp:number}) {
    const absorbed=this.absorb(s,hit.damage),damage=hit.damage-absorbed;
    // 保留小宝的生命下限，致命伤害仍从受击前生命计算。
    return {damage,hp:Math.max(hit.hp,s.player.hp-damage)};
  }
  hurt(s: State) {
    const c = s.catBond;
    if (!this.aura || !catBenefits(c.score).guard || c.guardCooldown > 0 || s.player.hp <= 0 || s.player.hp > playerVitals(s).maxHp * .3 || s.life.playerSpace !== 'village') return false;
    c.guardCooldown = 60000; c.shieldTime = 5000; c.shield = Math.ceil(catBenefits(c.score).shield * playerVitals(s).maxHp / 100); this.metrics.guard++;
    this.events.push({ kind: 'guard', point: { ...s.player }, text: `护主灵息 · 护盾 ${c.shield}` });
    return true;
  }
  sniff(s: State, cat: Point, clear: (a: Point, b: Point, ignore?: string) => boolean, threatened: boolean) {
    if (!this.aura || !catBenefits(s.catBond.score).sniff || s.life.playerSpace !== 'village' || threatened || this.pounce) { this.hint = null; return; }
    if (this.hintWait > 0) return;
    this.hintWait = 500;
    const available = (p: Prop) => p.kind === 'chest' ? !s.chests.includes(p.id) :
      p.kind === 'stone' ? s.quest >= 4 && !s.stones.includes(p.index!) :
      p.id === 'clue' ? !s.catBond.memories.includes('find:clue') :
      p.kind === 'resource' && s.collected[p.id] === undefined && !southResourceBlock(s.southEvents, p.id);
    const target = props.filter(p => available(p) && distance(s.player, p) <= catBenefits(s.catBond.score).radius && clear(s.player, p, p.id))
      .sort((a, b) => Number(b.kind === 'chest') - Number(a.kind === 'chest') || distance(s.player, a) - distance(s.player, b))[0];
    const old = this.hint?.id;
    this.hint = target ? { id: target.id, x: target.x, y: target.y, label: target.label ?? '附近的线索' } : null;
    if (this.hint && old !== this.hint.id && this.hintVoice <= 0) {
      this.hintVoice = 8000;
      this.events.push({ kind: 'hint', point: { x:cat.x,y:cat.y }, text: `小黑发现了${this.hint.label}` });
    }
  }
  drain() { return this.events.splice(0); }
  snapshot(s: State) { return { aura: this.aura, recovery: this.aura ? catBenefits(s.catBond.score).recovery : 0, mark: this.mark, pounce: this.pounce, hint: this.hint, metrics: { ...this.metrics } }; }
}
