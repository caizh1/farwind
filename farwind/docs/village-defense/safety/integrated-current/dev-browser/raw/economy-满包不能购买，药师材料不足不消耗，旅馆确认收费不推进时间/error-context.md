# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: economy.spec.ts >> 满包不能购买，药师材料不足不消耗，旅馆确认收费不推进时间
- Location: tests/economy.spec.ts:217:1

# Error details

```
TimeoutError: page.waitForFunction: Timeout 10000ms exceeded.
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic:
    - generic:
      - generic:
        - generic:
          - generic [ref=e4]:
            - img "旅行者" [ref=e5]
            - generic [ref=e6]:
              - generic [ref=e7]: 旅人 与小黑同行
              - generic [ref=e8]: 生命 45 / 100
              - generic [ref=e11]: 体力 100 / 100
          - generic: L 风步 · 就绪
          - status: K 架剑就绪
          - generic: 剑风：测试授予
        - generic:
          - button "展开小地图" [ref=e14] [cursor=pointer]:
            - generic [ref=e15]: 风铃村
            - generic [ref=e16]: ·
            - generic [ref=e17]: 第1日 08:35 · 白天
            - generic [aria-hidden] [ref=e20]: ▾
          - button "展开任务详情：与广场的守风人交谈" [ref=e21] [cursor=pointer]:
            - generic [ref=e22]: 任务 · 与广场的守风人交谈
            - generic [aria-hidden] [ref=e23]: ▾
      - generic:
        - group "快捷道具栏，1 至 8":
          - button "恢复药剂 · 快捷键 1 · 数量 0" [ref=e24] [cursor=pointer]:
            - generic [ref=e25]: "1"
            - strong [ref=e26]: "0"
          - button "浆果 · 快捷键 2 · 数量 0" [ref=e27] [cursor=pointer]:
            - generic [ref=e28]: "2"
            - strong [ref=e29]: "0"
          - button "空槽 · 快捷键 3 · 在行囊中绑定" [ref=e30] [cursor=pointer]:
            - generic [ref=e31]: "3"
            - generic [ref=e32]: —
            - strong
          - button "空槽 · 快捷键 4 · 在行囊中绑定" [ref=e33] [cursor=pointer]:
            - generic [ref=e34]: "4"
            - generic [ref=e35]: —
            - strong
          - button "空槽 · 快捷键 5 · 在行囊中绑定" [ref=e36] [cursor=pointer]:
            - generic [ref=e37]: "5"
            - generic [ref=e38]: —
            - strong
          - button "空槽 · 快捷键 6 · 在行囊中绑定" [ref=e39] [cursor=pointer]:
            - generic [ref=e40]: "6"
            - generic [ref=e41]: —
            - strong
          - button "空槽 · 快捷键 7 · 在行囊中绑定" [ref=e42] [cursor=pointer]:
            - generic [ref=e43]: "7"
            - generic [ref=e44]: —
            - strong
          - button "空槽 · 快捷键 8 · 在行囊中绑定" [ref=e45] [cursor=pointer]:
            - generic [ref=e46]: "8"
            - generic [ref=e47]: —
            - strong
    - status: 抵达 · 室内
  - complementary [ref=e48]:
    - button "居民笔记 · N" [ref=e49] [cursor=pointer]
```

# Test source

```ts
  1   | import { expect, type Page } from "@playwright/test";
  2   | import { HOMES, ROOM } from "../src/data/npcLife";
  3   | import { motionBlocked, clearMotionLine } from "../src/game/systems/obstacles";
  4   | import { move } from "./map-navigation";
  5   | const read = (p: Page) => p.evaluate(() => (window as any).__farwind());
  6   | async function indoorMove(page: Page, x: number, y: number) {
  7   |   for (const [axis, target] of [
  8   |     ["x", x],
  9   |     ["y", y],
  10  |   ] as const) {
  11  |     const value = (await read(page)).state.player[axis],
  12  |       sign = Math.sign(target - value);
  13  |     if (Math.abs(value - target) < 4) continue;
  14  |     const key = axis === "x" ? (sign > 0 ? "d" : "a") : sign > 0 ? "s" : "w";
  15  |     await page.keyboard.down(key);
  16  |     try {
> 17  |       await page.waitForFunction(
      |                  ^ TimeoutError: page.waitForFunction: Timeout 10000ms exceeded.
  18  |         ({ axis, target, sign }) =>
  19  |           sign * ((window as any).__farwind().state.player[axis] - target) > -3,
  20  |         { axis, target, sign },
  21  |         { timeout: 10000 },
  22  |       );
  23  |     } finally {
  24  |       await page.keyboard.up(key);
  25  |     }
  26  |   }
  27  | }
  28  | // 仅读取实体；实际寻人、敲门和室内移动均通过键盘完成，不改写状态。
  29  | export async function approachNpc(page: Page, id: string) {
  30  |   // 取物新增了室外→箱子→室外的实际旅行；每次空间变化重新读取，最多六段接近。
  31  |   for (let attempt = 0; attempt < 6; attempt++) {
  32  |     const snapshot = await read(page),
  33  |       npc = snapshot.npcLife.people.find((n: any) => n.id === id).body;
  34  |     if (
  35  |       snapshot.state.life.playerSpace !== "village" &&
  36  |       snapshot.state.life.playerSpace !== npc.space
  37  |     ) {
  38  |       await indoorMove(page, 700, 910);
  39  |       await page.keyboard.press("e");
  40  |       await page.waitForFunction(
  41  |         () => (window as any).__farwind().state.life.playerSpace === "village",
  42  |       );
  43  |     }
  44  |     if (npc.space === "village") {
  45  |       const target = [
  46  |         [0, 40],
  47  |         [-40, 0],
  48  |         [40, 0],
  49  |         [0, -40],
  50  |         [-30, 30],
  51  |         [30, 30],
  52  |       ]
  53  |         .map(([dx, dy]) => ({
  54  |           x: Math.round((npc.x + dx) / 10) * 10,
  55  |           y: Math.round((npc.y + dy) / 10) * 10,
  56  |         }))
  57  |         .find(
  58  |           (p) =>
  59  |             [-6, 0, 6].every((dx) =>
  60  |               [-6, 0, 6].every((dy) => !motionBlocked(p.x + dx, p.y + dy)),
  61  |             ) && clearMotionLine(p, npc),
  62  |         );
  63  |       expect(target, "实际人物旁有可见的可站立交互位").toBeTruthy();
  64  |       await move(page, target!.x, target!.y);
  65  |     } else {
  66  |       if ((await read(page)).state.life.playerSpace !== npc.space) {
  67  |         const h = HOMES.find((h) => h.id === npc.space)!;
  68  |         await move(page, h.door.x, h.door.y);
  69  |         await page.keyboard.press("e");
  70  |         await page.waitForFunction(
  71  |           (space) =>
  72  |             (window as any).__farwind().mode === "dialog" ||
  73  |             (window as any).__farwind().state.life.playerSpace === space,
  74  |           npc.space,
  75  |           { timeout: 5000 },
  76  |         );
  77  |         if ((await read(page)).mode === "dialog") {
  78  |           await page.getByRole("button", { name: "继续 · E" }).click();
  79  |           await page.keyboard.press("e");
  80  |         }
  81  |         await page.waitForFunction(
  82  |           (space) =>
  83  |             (window as any).__farwind().state.life.playerSpace === space,
  84  |           npc.space,
  85  |         );
  86  |       }
  87  |       // 先到无家具的下侧走廊，再接近实际设施使用位。
  88  |       await indoorMove(page, (await read(page)).state.player.x, 890);
  89  |       // 过门时人物仍在行走；已能交谈就停，不追过门前的旧坐标退回出口。
  90  |       const current = await read(page);
  91  |       if (current.target === id) return;
  92  |       const actual = current.npcLife.people.find((n: any) => n.id === id).body;
  93  |       if (actual.space !== current.state.life.playerSpace) continue;
  94  |       await indoorMove(
  95  |         page,
  96  |         actual.x,
  97  |         Math.min(ROOM.bottom - 30, Math.max(ROOM.top + 90, actual.y + 35)),
  98  |       );
  99  |     }
  100 |     if ((await read(page)).target === id) return;
  101 |   }
  102 |   await expect.poll(async () => (await read(page)).target).toBe(id);
  103 | }
  104 | 
```