import { expect, type Page } from "@playwright/test";
import { terrainBlocked, solidPropAt, WORLD } from "../src/data/world";
import { clearMotionLine } from "../src/game/systems/obstacles";
const read = (p: Page) => p.evaluate(() => (window as any).__farwind());
// 只读取诊断状态，所有推进通过真实键盘输入；寻路使用正式地图碰撞。
export async function move(page: Page, tx: number, ty: number) {
  // 开发快进也使用正式异步保存锁；等待保存结束再开始键盘行程，避免输入在提交边界被清空。
  await page.waitForFunction(() => !(window as any).__farwind().defenseSaving);
  await page.bringToFront();
  if (
    (await read(page)).state.life?.playerSpace !== undefined &&
    (await read(page)).state.life.playerSpace !== "village"
  ) {
    for (const [axis, target] of [
      ["y", 910],
      ["x", 700],
    ] as const) {
      const delta = target - (await read(page)).state.player[axis],
        sign = Math.sign(delta);
      if (Math.abs(delta) < 4) continue;
      const button =
        axis === "x" ? (sign > 0 ? "d" : "a") : sign > 0 ? "s" : "w";
      await page.keyboard.down(button);
      try {
        await page.waitForFunction(
          ({ axis, target, sign }) =>
            sign * ((window as any).__farwind().state.player[axis] - target) >
            -3,
          { axis, target, sign },
          { timeout: 10000 },
        );
      } finally {
        await page.keyboard.up(button);
      }
    }
    await page.keyboard.press("e");
    await page.waitForFunction(
      () => (window as any).__farwind().state.life.playerSpace === "village",
    );
  }
  const start = (await read(page)).state.player,
    step = 10,
    cols = WORLD.width / step;
  const key = (x: number, y: number) =>
    Math.round(y / step) * cols + Math.round(x / step);
  const startKey = key(start.x, start.y),
    end = key(tx, ty),
    queue = [startKey],
    prev = new Map<number, number>([[startKey, -1]]);
  const blocked = (x: number, y: number) =>
    terrainBlocked(x, y) || solidPropAt(x, y);
  const safe = (x: number, y: number) =>
    [-6, 0, 6].every((ox) =>
      [-6, 0, 6].every((oy) => !blocked(x + ox, y + oy)),
    );
  for (let i = 0; i < queue.length && !prev.has(end); i++) {
    const n = queue[i],
      x = n % cols,
      y = Math.floor(n / cols);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx,
        ny = y + dy,
        k = ny * cols + nx;
      if (
        nx < 3 ||
        nx >= cols - 3 ||
        ny < 8 ||
        ny >= 217 ||
        prev.has(k) ||
        !clearMotionLine(
          { x: x * step, y: y * step },
          { x: nx * step, y: ny * step },
        ) ||
        !safe(nx * step, ny * step) ||
        !safe(((x + nx) * step) / 2, ((y + ny) * step) / 2)
      )
        continue;
      prev.set(k, n);
      queue.push(k);
    }
  }
  expect(prev.has(end), `可到达 ${tx},${ty}`).toBe(true);
  const path: number[][] = [];
  for (let n = end; n !== startKey; n = prev.get(n)!)
    path.unshift([(n % cols) * step, Math.floor(n / cols) * step]);
  const turns = path.filter(
    (p, i) =>
      i === path.length - 1 ||
      i === 0 ||
      p[0] - path[i - 1][0] !== path[i + 1][0] - p[0] ||
      p[1] - path[i - 1][1] !== path[i + 1][1] - p[1],
  );
  for (const [x, y] of turns)
    for (const [axis, target] of [
      ["x", x],
      ["y", y],
    ] as const) {
      const current = (await read(page)).state.player[axis],
        delta = target - current;
      if (Math.abs(delta) < 4) continue;
      const sign = Math.sign(delta),
        button = axis === "x" ? (sign > 0 ? "d" : "a") : sign > 0 ? "s" : "w";
      let reached = false;
      while (!reached) {
        await page.keyboard.down(button);
        try {
          await page.waitForFunction(
            ({ axis, target, sign }) => {
              const s = (window as any).__farwind();
              return (
                s.mode === "dialog" ||
                sign * (s.state.player[axis] - target) > -3
              );
            },
            { axis, target, sign },
            { timeout: 12000 },
          );
        } finally {
          await page.keyboard.up(button);
        }
        const current = await read(page);
        reached = sign * (current.state.player[axis] - target) > -3;
        if (current.mode === "dialog")
          await page.getByRole("button", { name: "继续 · E" }).click();
      }
    }
}
