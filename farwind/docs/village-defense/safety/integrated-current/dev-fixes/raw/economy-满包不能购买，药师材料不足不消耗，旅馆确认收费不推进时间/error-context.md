# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: economy.spec.ts >> 满包不能购买，药师材料不足不消耗，旅馆确认收费不推进时间
- Location: tests/economy.spec.ts:220:1

# Error details

```
TimeoutError: page.waitForFunction: Timeout 6000ms exceeded.
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
            - generic [ref=e17]: 第1日 08:27 · 白天
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
  1  | import {localPath} from '../src/game/systems/enemy';
  2  | import {spaceBlocked,spaceClear} from '../src/game/systems/npcNavigation';
  3  | import { expect, type Page } from "@playwright/test";
  4  | import { HOMES, ROOM } from "../src/data/npcLife";
  5  | import { motionBlocked, clearMotionLine } from "../src/game/systems/obstacles";
  6  | import { move } from "./map-navigation";
  7  | const read = (p: Page) => p.evaluate(() => (window as any).__farwind());
  8  | async function indoorMove(page:Page,x:number,y:number){
  9  |  const initial=await read(page),space=initial.state.life.playerSpace,start=initial.state.player,target={x,y};
  10 |  if(Math.hypot(start.x-x,start.y-y)<5)return;
  11 |  const route=localPath(start,p=>Math.hypot(p.x-x,p.y-y)<8&&spaceClear(space,p,target),target,()=>true,{blocked:(x,y)=>spaceBlocked(space,x,y),clear:(a,b)=>spaceClear(space,a,b)},{radius:1200,nodes:8192}).path;
  12 |  expect(route,'室内实际家具间存在可通行路线').toBeTruthy();
  13 |  for(const point of [...route!,target]){
  14 |   const current=(await read(page)).state.player,dx=point.x-current.x,dy=point.y-current.y;if(Math.hypot(dx,dy)<6)continue;
  15 |   const keys=[...(Math.abs(dx)>3?[dx>0?'d':'a']:[]),...(Math.abs(dy)>3?[dy>0?'s':'w']:[])];
  16 |   for(const key of keys)await page.keyboard.down(key);
> 17 |   try{await page.waitForFunction(p=>Math.hypot((window as any).__farwind().state.player.x-p.x,(window as any).__farwind().state.player.y-p.y)<8,point,{timeout:6000,polling:16});}
     |                  ^ TimeoutError: page.waitForFunction: Timeout 6000ms exceeded.
  18 |   finally{for(const key of keys)await page.keyboard.up(key);}
  19 |  }
  20 | }
  21 | // 仅读取实体；实际寻人、敲门和室内移动均通过键盘完成，不改写状态。
  22 | export async function approachNpc(page: Page, id: string) {
  23 |   // 取物新增了室外→箱子→室外的实际旅行；每次空间变化重新读取，最多六段接近。
  24 |   for (let attempt = 0; attempt < 6; attempt++) {
  25 |     const snapshot = await read(page),
  26 |       npc = snapshot.npcLife.people.find((n: any) => n.id === id).body;
  27 |     if (
  28 |       snapshot.state.life.playerSpace !== "village" &&
  29 |       snapshot.state.life.playerSpace !== npc.space
  30 |     ) {
  31 |       await indoorMove(page, 700, 910);
  32 |       await page.keyboard.press("e");
  33 |       await page.waitForFunction(
  34 |         () => (window as any).__farwind().state.life.playerSpace === "village",
  35 |       );
  36 |     }
  37 |     if (npc.space === "village") {
  38 |       const target = [
  39 |         [0, 40],
  40 |         [-40, 0],
  41 |         [40, 0],
  42 |         [0, -40],
  43 |         [-30, 30],
  44 |         [30, 30],
  45 |       ]
  46 |         .map(([dx, dy]) => ({
  47 |           x: Math.round((npc.x + dx) / 10) * 10,
  48 |           y: Math.round((npc.y + dy) / 10) * 10,
  49 |         }))
  50 |         .find(
  51 |           (p) =>
  52 |             [-6, 0, 6].every((dx) =>
  53 |               [-6, 0, 6].every((dy) => !motionBlocked(p.x + dx, p.y + dy)),
  54 |             ) && clearMotionLine(p, npc),
  55 |         );
  56 |       expect(target, "实际人物旁有可见的可站立交互位").toBeTruthy();
  57 |       await move(page, target!.x, target!.y);
  58 |     } else {
  59 |       if ((await read(page)).state.life.playerSpace !== npc.space) {
  60 |         const h = HOMES.find((h) => h.id === npc.space)!;
  61 |         await move(page, h.door.x, h.door.y);
  62 |         await page.keyboard.press("e");
  63 |         await page.waitForFunction(
  64 |           (space) =>
  65 |             (window as any).__farwind().mode === "dialog" ||
  66 |             (window as any).__farwind().state.life.playerSpace === space,
  67 |           npc.space,
  68 |           { timeout: 5000 },
  69 |         );
  70 |         if ((await read(page)).mode === "dialog") {
  71 |           await page.getByRole("button", { name: "继续 · E" }).click();
  72 |           await page.keyboard.press("e");
  73 |         }
  74 |         await page.waitForFunction(
  75 |           (space) =>
  76 |             (window as any).__farwind().state.life.playerSpace === space,
  77 |           npc.space,
  78 |         );
  79 |       }
  80 |       // 先到无家具的下侧走廊，再接近实际设施使用位。
  81 |       await indoorMove(page, (await read(page)).state.player.x, 890);
  82 |       // 过门时人物仍在行走；已能交谈就停，不追过门前的旧坐标退回出口。
  83 |       const current = await read(page);
  84 |       if (current.target === id) return;
  85 |       const actual = current.npcLife.people.find((n: any) => n.id === id).body;
  86 |       if (actual.space !== current.state.life.playerSpace) continue;
  87 |       await indoorMove(
  88 |         page,
  89 |         actual.x,
  90 |         Math.min(ROOM.bottom - 30, Math.max(ROOM.top + 90, actual.y + 35)),
  91 |       );
  92 |     }
  93 |     if ((await read(page)).target === id) return;
  94 |   }
  95 |   await expect.poll(async () => (await read(page)).target).toBe(id);
  96 | }
  97 | 
```