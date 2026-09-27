import { expect, type Page } from "@playwright/test";
import { localPath } from "../src/game/systems/enemy";
import { motionBlocked, clearMotionLine } from "../src/game/systems/obstacles";
const read = (p: Page) => p.evaluate(() => (window as any).__farwind());
// 从玩家的真实坐标建网格，避免把贴岸站位四舍五入到水里。所有推进仍是键盘移动。
export async function move(page: Page, x: number, y: number) {
  await page.bringToFront();
  await page.waitForFunction(() => !(window as any).__farwind().defenseSaving);
  const start = (await read(page)).state.player,
    target = { x, y };
  const route = localPath(
    start,
    (q) => Math.hypot(q.x - x, q.y - y) < 28 && clearMotionLine(q, target),
    target,
    (q) => q.x >= 30 && q.x <= 4170 && q.y >= 80 && q.y <= 2170,
    {
      blocked: (x, y) =>
        [-8, 0, 8].some((ox) =>
          [-8, 0, 8].some((oy) => motionBlocked(x + ox, y + oy)),
        ),
      clear: clearMotionLine,
    },
    { radius: 5000, nodes: 30000 },
  );
  expect(route.path, "正式碰撞路径可达 " + x + "," + y).not.toBeNull();
  const path = [{ x: start.x, y: start.y }, ...route.path!, target],
    turns = path.filter(
      (p, i) =>
        i > 0 &&
        (i === path.length - 1 ||
          Math.abs(p.x - path[i - 1].x - (path[i + 1].x - p.x)) > 0.01 ||
          Math.abs(p.y - path[i - 1].y - (path[i + 1].y - p.y)) > 0.01),
    );
  for (const point of turns) {
    for (let attempts = 0; attempts < 4; attempts++) {
      const state = await read(page);
      if (state.mode === "dialog")
        await page
          .getByRole("button", { name: "继续 · E", exact: true })
          .click();
      const p = (await read(page)).state.player,
        dx = point.x - p.x,
        dy = point.y - p.y;
      if (Math.hypot(dx, dy) < 5) break;
      const axes = [
        ...(Math.abs(dx) > 3
          ? [
              {
                key: dx > 0 ? "d" : "a",
                axis: "x",
                sign: Math.sign(dx),
                target: point.x,
              },
            ]
          : []),
        ...(Math.abs(dy) > 3
          ? [
              {
                key: dy > 0 ? "s" : "w",
                axis: "y",
                sign: Math.sign(dy),
                target: point.y,
              },
            ]
          : []),
      ];
      for (const a of axes) await page.keyboard.down(a.key);
      try {
        await page.waitForFunction(
          (axes) => {
            const s = (window as any).__farwind();
            return (
              s.mode === "dialog" ||
              axes.some(
                (a) => a.sign * (s.state.player[a.axis] - a.target) > -3,
              )
            );
          },
          axes,
          { timeout: 12000, polling: 10 },
        );
      } finally {
        for (const a of axes) await page.keyboard.up(a.key);
      }
    }
    const p = (await read(page)).state.player;
    expect(
      Math.hypot(p.x - point.x, p.y - point.y),
      "真实键盘到达转折",
    ).toBeLessThan(10);
  }
}
