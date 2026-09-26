// 体力规则集中在移动控制层，动画仍只读取碰撞后的实际位移。
export const SPRINT = {
  exhaustedAt: 1,
  resumeAt: 20,
  maximum: 100,
  walkSpeed: 150,
  runSpeed: 235,
  drain: 21,
  recover: 14,
} as const;
export class Sprint {
  exhausted = false;
  reset(stamina: number) {
    // 新会话没有旧锁存历史；低于恢复线时采用保守一致的恢复状态。
    this.exhausted = stamina < SPRINT.resumeAt;
  }
  update(stamina: number, requested: boolean, dt: number, recover = true) {
    if (stamina <= SPRINT.exhaustedAt) this.exhausted = true;
    if (stamina >= SPRINT.resumeAt) this.exhausted = false;
    const running = requested && !this.exhausted;
    const next = Math.max(
      0,
      Math.min(
        SPRINT.maximum,
        stamina + (running ? -SPRINT.drain : recover ? SPRINT.recover : 0) * dt,
      ),
    );
    if (next <= SPRINT.exhaustedAt) this.exhausted = true;
    return {
      stamina: next,
      speed: running ? SPRINT.runSpeed : SPRINT.walkSpeed,
      running,
    };
  }
}
