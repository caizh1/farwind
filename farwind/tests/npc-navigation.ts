import { expect, type Page } from "@playwright/test";
import { HOMES, ROOM } from "../src/data/npcLife";
import { motionBlocked, clearMotionLine } from "../src/game/systems/obstacles";
import { move } from "./map-navigation";
const read = (p: Page) => p.evaluate(() => (window as any).__farwind());
async function indoorMove(page: Page, x: number, y: number) {
  for (const [axis, target] of [
    ["x", x],
    ["y", y],
  ] as const) {
    const value = (await read(page)).state.player[axis],
      sign = Math.sign(target - value);
    if (Math.abs(value - target) < 4) continue;
    const key = axis === "x" ? (sign > 0 ? "d" : "a") : sign > 0 ? "s" : "w";
    await page.keyboard.down(key);
    try {
      await page.waitForFunction(
        ({ axis, target, sign }) =>
          sign * ((window as any).__farwind().state.player[axis] - target) > -3,
        { axis, target, sign },
        { timeout: 10000 },
      );
    } finally {
      await page.keyboard.up(key);
    }
  }
}
// 仅读取实体；实际寻人、敲门和室内移动均通过键盘完成，不改写状态。
export async function approachNpc(page: Page, id: string) {
  // 取物新增了室外→箱子→室外的实际旅行；每次空间变化重新读取，最多六段接近。
  for (let attempt = 0; attempt < 6; attempt++) {
    const snapshot = await read(page),
      npc = snapshot.npcLife.people.find((n: any) => n.id === id).body;
    if (
      snapshot.state.life.playerSpace !== "village" &&
      snapshot.state.life.playerSpace !== npc.space
    ) {
      await indoorMove(page, 700, 910);
      await page.keyboard.press("e");
      await page.waitForFunction(
        () => (window as any).__farwind().state.life.playerSpace === "village",
      );
    }
    if (npc.space === "village") {
      const target = [
        [0, 40],
        [-40, 0],
        [40, 0],
        [0, -40],
        [-30, 30],
        [30, 30],
      ]
        .map(([dx, dy]) => ({
          x: Math.round((npc.x + dx) / 10) * 10,
          y: Math.round((npc.y + dy) / 10) * 10,
        }))
        .find(
          (p) =>
            [-6, 0, 6].every((dx) =>
              [-6, 0, 6].every((dy) => !motionBlocked(p.x + dx, p.y + dy)),
            ) && clearMotionLine(p, npc),
        );
      expect(target, "实际人物旁有可见的可站立交互位").toBeTruthy();
      await move(page, target!.x, target!.y);
    } else {
      if ((await read(page)).state.life.playerSpace !== npc.space) {
        const h = HOMES.find((h) => h.id === npc.space)!;
        await move(page, h.door.x, h.door.y);
        await page.keyboard.press("e");
        await page.waitForFunction(
          (space) =>
            (window as any).__farwind().mode === "dialog" ||
            (window as any).__farwind().state.life.playerSpace === space,
          npc.space,
          { timeout: 5000 },
        );
        if ((await read(page)).mode === "dialog") {
          await page.getByRole("button", { name: "继续 · E" }).click();
          await page.keyboard.press("e");
        }
        await page.waitForFunction(
          (space) =>
            (window as any).__farwind().state.life.playerSpace === space,
          npc.space,
        );
      }
      // 先到无家具的下侧走廊，再接近实际设施使用位。
      await indoorMove(page, (await read(page)).state.player.x, 890);
      // 过门时人物仍在行走；已能交谈就停，不追过门前的旧坐标退回出口。
      const current = await read(page);
      if (current.target === id) return;
      const actual = current.npcLife.people.find((n: any) => n.id === id).body;
      if (actual.space !== current.state.life.playerSpace) continue;
      await indoorMove(
        page,
        actual.x,
        Math.min(ROOM.bottom - 30, Math.max(ROOM.top + 90, actual.y + 35)),
      );
    }
    if ((await read(page)).target === id) return;
  }
  await expect.poll(async () => (await read(page)).target).toBe(id);
}
