// 只选择相机附近的地面块；不管理敌人、伤亡、任务或世界时间。
export const GROUND_CHUNK = { width: 600, height: 550, padding: 1 } as const;
export type GroundView = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};
export function groundChunks(
  view: GroundView,
  width: number,
  height: number,
  padding: number = GROUND_CHUNK.padding,
  origin = { x: 0, y: 0 },
) {
  const cols = Math.ceil(width / GROUND_CHUNK.width),
    rows = Math.ceil(height / GROUND_CHUNK.height);
  const left = Math.max(
    0,
    Math.min(
      cols - 1,
      Math.floor((view.left - origin.x) / GROUND_CHUNK.width) - padding,
    ),
  );
  const top = Math.max(
    0,
    Math.min(
      rows - 1,
      Math.floor((view.top - origin.y) / GROUND_CHUNK.height) - padding,
    ),
  );
  const right = Math.min(
    cols - 1,
    Math.max(
      0,
      Math.floor((view.right - origin.x - 0.001) / GROUND_CHUNK.width) +
        padding,
    ),
  );
  const bottom = Math.min(
    rows - 1,
    Math.max(
      0,
      Math.floor((view.bottom - origin.y - 0.001) / GROUND_CHUNK.height) +
        padding,
    ),
  );
  const chunks: { key: string; x: number; y: number; visible: boolean }[] = [];
  for (let y = top; y <= bottom; y++)
    for (let x = left; x <= right; x++) {
      const px = origin.x + x * GROUND_CHUNK.width,
        py = origin.y + y * GROUND_CHUNK.height;
      chunks.push({
        key: `ground-${px}-${py}`,
        x: px,
        y: py,
        visible:
          px < view.right &&
          px + GROUND_CHUNK.width > view.left &&
          py < view.bottom &&
          py + GROUND_CHUNK.height > view.top,
      });
    }
  const cx = (view.left + view.right) / 2,
    cy = (view.top + view.bottom) / 2;
  return chunks.sort(
    (a, b) =>
      Number(b.visible) - Number(a.visible) ||
      Math.hypot(a.x + 300 - cx, a.y + 275 - cy) -
        Math.hypot(b.x + 300 - cx, b.y + 275 - cy),
  );
}
