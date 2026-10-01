// 判定、动画和预警共用半开区间；恢复结束不再属于有效攻击。
export function sampleAttackTiming(now: number, start: number, windup: number, active: number, recovery: number) {
  const activeAt = start + windup, recoveryAt = activeAt + active, end = recoveryAt + recovery;
  const phase: 'windup' | 'active' | 'recovery' = now < activeAt ? 'windup' : now < recoveryAt ? 'active' : 'recovery';
  const from = phase === 'windup' ? start : phase === 'active' ? activeAt : recoveryAt;
  const duration = phase === 'windup' ? windup : phase === 'active' ? active : recovery;
  return {phase, progress: Math.max(0, Math.min(1, (now - from) / (duration || 1))), activeAt, recoveryAt, end,
    active: now >= activeAt && now < recoveryAt, ended: now >= end};
}
