import type { State } from './state';

// 里程存世界坐标单位；镜头缩放、显示舍入均不参与结算。
export const JOURNEY_UNITS_PER_METER = 32;
export const JOURNEY_MAX_DISTANCE = 347_500 * JOURNEY_UNITS_PER_METER;
type JourneyState = Pick<State, 'physique'>;

export function journeyThreshold(gain: number, health = false) {
  const base = health ? 1000 : 500, increment = health ? 50 : 25;
  return (base * gain + increment * gain * (gain - 1) / 2) * JOURNEY_UNITS_PER_METER;
}
function gainAt(distance: number, health = false) {
  // 整数门槛二分，避免平方根舍入在边界提前发奖。
  let low = 0, high = 100;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (journeyThreshold(middle, health) <= distance) low = middle;
    else high = middle - 1;
  }
  return low;
}
export function playerVitals(state: JourneyState) {
  return {
    maxHp: 100 + gainAt(state.physique.runDistance, true),
    maxStamina: 100 + gainAt(state.physique.runDistance),
  };
}
export function journeyProgress(state: JourneyState) {
  const vitals = playerVitals(state), distance = state.physique.runDistance;
  return {
    ...vitals,
    meters: distance / JOURNEY_UNITS_PER_METER,
    staminaRemaining: vitals.maxStamina === 200 ? null :
      (journeyThreshold(vitals.maxStamina - 99) - distance) / JOURNEY_UNITS_PER_METER,
    healthRemaining: vitals.maxHp === 200 ? null :
      (journeyThreshold(vitals.maxHp - 99, true) - distance) / JOURNEY_UNITS_PER_METER,
  };
}
export function recordRunDistance(state: JourneyState, from: {x:number;y:number}, to: {x:number;y:number}, running: boolean) {
  const distance = running ? Math.hypot(to.x - from.x, to.y - from.y) : 0;
  if (!Number.isFinite(distance) || distance <= 0) return { hp: 0, stamina: 0 };
  const before = playerVitals(state);
  state.physique.runDistance = Math.min(JOURNEY_MAX_DISTANCE, state.physique.runDistance + distance);
  const after = playerVitals(state);
  return { hp: after.maxHp - before.maxHp, stamina: after.maxStamina - before.maxStamina };
}
