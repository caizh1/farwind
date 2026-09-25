// 仅重置依赖本段 sim 的临时战斗计时，不触碰存档或用户设置。
export function resetSessionTimers(timers: {
  sim: number;
  attackUntil: number;
  cooldown: number;
  invulnerable: number;
}) {
  timers.sim = 0;
  timers.attackUntil = 0;
  timers.cooldown = 0;
  timers.invulnerable = 0;
}
