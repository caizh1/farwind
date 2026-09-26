import { STRIKES, type Attack, type Target } from "./combat";
export const TRAINING = {
  id: "training-dummy",
  x: 850,
  y: 650,
  near: 185,
  linger: 3000,
  fade: 250,
  recoil: 330,
} as const;
export const FIELD_TARGETS = [
  { id: "field-dummy-west", x: 1510, y: 470 },
  { id: "field-dummy-east", x: 1760, y: 470 },
  { id: "field-dummy-south", x: 1540, y: 650 },
] as const;
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
  reset() {
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
  hit(a: Attack, now: number) {
    this.begin(a);
    if (this.instances.has(a.id)) return false;
    this.instances.add(a.id);
    this.stages.add(a.stage);
    this.lastStage = a.stage;
    this.lastDamage = STRIKES[a.stage - 1].damage;
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
      visible: now - this.lastHit < TRAINING.linger,
      age: now - this.lastHit,
    };
  }
}
