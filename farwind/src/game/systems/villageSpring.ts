import { props } from "../../data/world";
import { regionAt } from "../../data/village";
import { clearMotionLine } from "./obstacles";
import { runeLock, type RuneSafety } from "./runeState";
import type { State } from "./state";
import { playerVitals } from './journeyTraining';

export function springSnapshot(state: State, safety: RuneSafety): State {
  const spring = props.find(p => p.id === "plaza-fountain")!;
  const player = state.player;
  if (state.life.playerSpace !== "village" || regionAt(player).id !== "village" ||
      Math.hypot(player.x - spring.x, player.y - spring.y) >= 95 ||
      !clearMotionLine(player, spring, spring.id))
    throw Error("请走到村庄广场的泉水旁饮用。");
  if (player.hp <= 0) throw Error("倒下时无法饮用泉水。");
  const lock = runeLock(safety);
  if (lock) throw Error(`暂时无法饮用泉水：${lock}。`);
  const { maxHp, maxStamina } = playerVitals(state);
  if (player.hp === maxHp && player.stamina === maxStamina)
    throw Error("生命与体力已满，无需饮用泉水。");
  const next = structuredClone(state);
  next.player.hp = maxHp; next.player.stamina = maxStamina;
  return next;
}
