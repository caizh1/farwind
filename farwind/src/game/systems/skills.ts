import type { State } from "./state";
export { resolveSwordWindConfig } from "../../data/swordWind";
// 可通过 VITE_DEV_GRANT_SWORD_WIND=0 关闭。普通生产构建永远不授予。
export const DEV_GRANT_SWORD_WIND =
  import.meta.env.DEV && import.meta.env.VITE_DEV_GRANT_SWORD_WIND !== "0";
export const hasSwordWind = (
  s: Pick<State, "skills">,
  grant = DEV_GRANT_SWORD_WIND,
) => s.skills.swordWind || grant;
export const swordWindSource = (
  s: Pick<State, "skills">,
  grant = DEV_GRANT_SWORD_WIND,
) => (s.skills.swordWind ? "正式学习" : grant ? "测试授予" : "未学习");
// 尚未配置任何正式获得条件；未来在此接入条件，授予后由现有保存入口提交。
export function learnSwordWind(
  s: State,
  condition?: (s: Readonly<State>) => boolean,
) {
  if (!condition || !condition(s)) return false;
  s.skills.swordWind = true;
  return true;
}
