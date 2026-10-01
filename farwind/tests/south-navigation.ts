import { expect, type Page } from "@playwright/test";
import { localPath } from "../src/game/systems/enemy";
import { motionBlocked, clearMotionLine } from "../src/game/systems/obstacles";
import {WORLD_PLAYABLE} from '../src/data/maps/windbell/bounds';
const read = (p: Page) => p.evaluate(() => (window as any).__farwind());
// 南线验收沿正式碰撞寻路，预留建筑转角余量。诊断只读，位置推进全部来自键盘。
export async function move(page: Page, x: number, y: number, onDisplaced?:()=>Promise<void>, replans=0) {
  await page.bringToFront();
  await page.waitForFunction(() => !(window as any).__farwind().defenseSaving);
  const start = (await read(page)).state.player,
    target = { x, y };
  const route = localPath(
    start,
    (q) => Math.hypot(q.x - x, q.y - y) < 28 && clearMotionLine(q, target),
    target,
    (q) => q.x >= WORLD_PLAYABLE.left && q.x <= WORLD_PLAYABLE.right && q.y >= WORLD_PLAYABLE.top && q.y <= WORLD_PLAYABLE.bottom,
    {
      blocked: (x, y) =>
        [-28, 0, 28].some((ox) =>
          [-28, 0, 28].some((oy) => motionBlocked(x + ox, y + oy)),
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
    for (let attempts = 0; attempts < 80; attempts++) {
      const state = await read(page);
      if (state.mode === "dialog")
        await page
          .getByRole("button", { name: "继续 · E", exact: true })
          .click();
      const p = (await read(page)).state.player,
        dx = point.x - p.x,
        dy = point.y - p.y;
      if (Math.hypot(dx, dy) < 8) break;
      // 临近落点改用短脉冲；持续等坐标的往返延迟会造成越过建筑转角。
      if(Math.hypot(dx,dy)<90){
        const key=Math.abs(dx)>Math.abs(dy)?dx>0?'d':'a':dy>0?'s':'w';
        await page.keyboard.down(key);await page.waitForTimeout(15);await page.keyboard.up(key);continue;
      }
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
                (a) => a.sign * (s.state.player[a.axis] - a.target) > -30,
              )
            );
          },
          axes,
          { timeout: Math.max(12000,Math.ceil(Math.hypot(dx,dy)/100*1000)+5000), polling: 10 },
        );
      } finally {
        for (const a of axes) await page.keyboard.up(a.key);
      }
    }
    const p = (await read(page)).state.player;
    // 实际敌伤击退会让旧转折失效：先通过真实战斗清除威胁，再由当前坐标重新寻路。
    if(Math.hypot(p.x-point.x,p.y-point.y)>=10&&onDisplaced&&replans<3){
      await onDisplaced();return move(page,x,y,onDisplaced,replans+1);
    }
    expect(
      Math.hypot(p.x - point.x, p.y - point.y),
      "真实键盘到达转折",
    ).toBeLessThan(10);
  }
}
