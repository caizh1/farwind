// 室外统一边界。村内和室内保留既有坐标，蓝图以左上角为原点。
export const WORLD_BOUNDS = {
  left: -2110,
  top: -1380,
  right: 4290,
  bottom: 3420,
  width: 6400,
  height: 4800,
} as const;
export const WORLD_PLAYABLE = {
  left: WORLD_BOUNDS.left + 30,
  top: WORLD_BOUNDS.top + 80,
  right: WORLD_BOUNDS.right - 30,
  bottom: WORLD_BOUNDS.bottom - 30,
} as const;
export const CURRENT_MAP_VERSION = 8;
export const planToWorld = (x: number, y: number) => ({
  x: x + WORLD_BOUNDS.left,
  y: y + WORLD_BOUNDS.top,
});
export const validOutdoorPoint = (p: { x: number; y: number }) =>
  Number.isFinite(p.x) &&
  Number.isFinite(p.y) &&
  p.x >= WORLD_PLAYABLE.left &&
  p.x <= WORLD_PLAYABLE.right &&
  p.y >= WORLD_PLAYABLE.top &&
  p.y <= WORLD_PLAYABLE.bottom;
