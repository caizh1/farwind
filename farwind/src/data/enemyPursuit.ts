// 警戒、已交战追击和保存位置共用范围，避免移动放宽后仍被技能或存档旧边界截断。
export const ENEMY_PURSUIT = {
  alertDistance: 380,
  chaseDistance: 1200,
  minimumRadius: 1600,
  lostDelay: 5000,
  returnInset: 80,
} as const;
export const BOSS_PURSUIT = {
  chaseDistance: 1600,
  minimumRadius: 2000,
  lostDelay: 8000,
} as const;
export function enemyLeashRadius(e: {leashRadius?: number; boss?: unknown}) {
  const radius=e.leashRadius??420;
  return e.boss?Math.max(BOSS_PURSUIT.minimumRadius,radius):Math.max(ENEMY_PURSUIT.minimumRadius,radius*2);
}
