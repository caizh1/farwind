import { expect, type Page } from "@playwright/test";
import { terrainBlocked, solidPropAt, WORLD } from "../src/data/world";
import { clearMotionLine } from "../src/game/systems/obstacles";
const read = (p: Page) => p.evaluate(() => (window as any).__farwind());
// 只读取诊断状态，所有推进通过真实键盘输入；寻路使用正式地图碰撞。
export async function move(page: Page, tx: number, ty: number) {
  // 等待正式保存与会话初始化完成，再开始键盘行程，避免输入在提交边界被清空。
  await page.waitForFunction(() => {
    const s = (window as any).__farwind();
    return !s.defenseSaving && !s.sessionStarting;
  });
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
    Math.round((y - WORLD.top) / step) * cols +
    Math.round((x - WORLD.left) / step);
  const startKey = key(start.x, start.y),
    end = key(tx, ty),
    queue = [startKey],
    prev = new Map<number, number>([[startKey, -1]]);
  const cost = new Map([[startKey, 0]]),
    closed = new Set<number>();
  const heuristic = (n: number) =>
    Math.abs((n % cols) - (end % cols)) +
    Math.abs(Math.floor(n / cols) - Math.floor(end / cols));
  const blocked = (x: number, y: number) =>
    terrainBlocked(x, y) || solidPropAt(x, y);
  const safe = (x: number, y: number) =>
    [-6, 0, 6].every((ox) =>
      [-6, 0, 6].every((oy) => !blocked(x + ox, y + oy)),
    );
  // 有目标的 A*；不再为每一步键盘行程扫描整个扩展地图。
  while (queue.length) {
    let best = 0;
    for (let i = 1; i < queue.length; i++) {
      const a = queue[i],
        b = queue[best],
        fa = cost.get(a)! + heuristic(a),
        fb = cost.get(b)! + heuristic(b);
      if (fa < fb || (fa === fb && heuristic(a) < heuristic(b))) best = i;
    }
    const n = queue.splice(best, 1)[0];
    if (n === end) break;
    if (closed.has(n)) continue;
    closed.add(n);
    const x = n % cols,
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
        ny >= WORLD.height / step - 3 ||
        closed.has(k) ||
        (cost.has(k) && cost.get(k)! <= cost.get(n)! + 1) ||
        !clearMotionLine(
          { x: WORLD.left + x * step, y: WORLD.top + y * step },
          { x: WORLD.left + nx * step, y: WORLD.top + ny * step },
        ) ||
        !safe(WORLD.left + nx * step, WORLD.top + ny * step) ||
        !safe(
          WORLD.left + ((x + nx) * step) / 2,
          WORLD.top + ((y + ny) * step) / 2,
        )
      )
        continue;
      prev.set(k, n);
      cost.set(k, cost.get(n)! + 1);
      queue.push(k);
    }
  }
  expect(prev.has(end), `可到达 ${tx},${ty}`).toBe(true);
  const path: number[][] = [];
  for (let n = end; n !== startKey; n = prev.get(n)!)
    path.unshift([
      WORLD.left + (n % cols) * step,
      WORLD.top + Math.floor(n / cols) * step,
    ]);
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
                s.mode === "dialog" || s.mode === "wind-gifts" ||
                sign * (s.state.player[axis] - target) > -3
              );
            },
            { axis, target, sign },
            { timeout: 12000 },
          );
        } catch (error) {
          const diagnostic = await page.evaluate(() => {
            const s = (window as any).__farwind();
            return { 玩家:s.state.player,模式:s.mode,时间:s.state.time,页面焦点:document.hasFocus(),页面隐藏:document.hidden };
          });
          throw new Error(`键盘行走停住：${JSON.stringify({轴:axis,目标:target,按键:button,...diagnostic})}`, {cause:error});
        } finally {
          await page.keyboard.up(button);
        }
        const current = await read(page);
        reached = sign * (current.state.player[axis] - target) > -3;
        if (current.mode === "dialog")
          await page.getByRole("button", { name: "继续 · E" }).click();
        // 新风赐会暂停世界；正常稍后领取并恢复键盘，不能把暂停误判成路径堵塞。
        if (current.mode === "wind-gifts")
          await page.locator('#gift-close').click();
      }
    }
}
