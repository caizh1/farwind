import {VILLAGE_ANCHORS, FIELD_TARGET_ANCHORS} from '../../data/maps/windbell/layout';
import { attackConfig, type Attack, type Target } from "./combat";
export const TRAINING = {
  ...VILLAGE_ANCHORS.training,
  near: 185,
  linger: 3000,
  fade: 250,
  recoil: 330,
} as const;
export const FIELD_TARGETS = FIELD_TARGET_ANCHORS;
export class TrainingDummy implements Target {
  readonly kind = "trainingDummy" as const;
  constructor(
    readonly id: string = TRAINING.id,
    readonly x: number = TRAINING.x,
    readonly y: number = TRAINING.y,
  ) {}
  // 仅表示可受击，训练对象不执行扣血/死亡路径。
  readonly hp = 1;
  comboId = -1;
  epoch = -1;
  stages = new Set<number>();
  instances = new Set<number>();
  damage = 0;
  lastStage = 0;
  lastDamage = 0;
  lastHit = -TRAINING.linger;
  facing = 0;
  windHits:{attackId:number;comboId:number;damage:number;at:number;firstTarget:string}[]=[];
  reset() {
    this.windHits=[];
    this.comboId = -1;
    this.stages.clear();
    this.instances.clear();
    this.damage = 0;
    this.lastStage = 0;
    this.lastDamage = 0;
    this.lastHit = -TRAINING.linger;
  }
  sync(epoch: number) {
    if (epoch !== this.epoch) {
      this.reset();
      this.epoch = epoch;
    }
  }
  begin(a: Attack) {
    if (this.comboId !== (a.comboId ?? a.id)) {
      this.reset();
      this.comboId = a.comboId ?? a.id;
    }
  }
  hit(a: Attack, now: number, damage = attackConfig(a).damage) {
    if(a.stage===4){if(this.windHits.some(h=>h.attackId===a.id))return false;this.windHits.push({attackId:a.id,comboId:a.comboId??a.id,damage,at:now,firstTarget:this.id});if(this.windHits.length>32)this.windHits.shift();return true;}
    this.begin(a);
    if (this.instances.has(a.id)) return false;
    this.instances.add(a.id);
    this.stages.add(a.stage);
    this.lastStage = a.stage;
    this.lastDamage = damage;
    this.damage += this.lastDamage;
    this.lastHit = now;
    this.facing = a.facing;
    return true;
  }
  snapshot(now: number) {
    return {
      kind: this.kind,
      id: this.id,
      x: this.x,
      y: this.y,
      hp: this.hp,
      comboId: this.comboId,
      stages: [...this.stages],
      damage: this.damage,
      lastStage: this.lastStage,
      lastDamage: this.lastDamage,
      lastHit: this.lastStage ? this.lastHit : null,
      complete: [1, 2, 3].every((s) => this.stages.has(s)),
      swordWind:this.windHits.at(-1)??null,
      windDamage:this.windHits.reduce((n,h)=>n+h.damage,0),
      visible: now - Math.max(this.lastHit,this.windHits.at(-1)?.at??-Infinity) < TRAINING.linger,
      age: now - Math.max(this.lastHit,this.windHits.at(-1)?.at??-Infinity),
    };
  }
}
