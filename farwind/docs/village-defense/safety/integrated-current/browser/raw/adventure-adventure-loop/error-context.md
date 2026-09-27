# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: adventure.spec.ts >> adventure-loop
- Location: tests/adventure.spec.ts:20:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 3
Received: 1

Call Log:
- Timeout 5000ms exceeded while waiting on the predicate
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
              - generic [ref=e8]: 生命 100 / 100
              - generic [ref=e11]: 体力 100 / 100
          - generic: L 风步 · 就绪
          - status: K 架剑就绪
        - generic:
          - button "展开小地图" [ref=e14] [cursor=pointer]:
            - generic [ref=e15]: 巡逻近郊
            - generic [ref=e16]: ·
            - generic [ref=e17]: 第1日 09:33 · 白天
            - generic [aria-hidden] [ref=e20]: ▾
          - button "展开任务详情：沿东侧石路调查森林异响" [ref=e21] [cursor=pointer]:
            - generic [ref=e22]: 任务 · 沿东侧石路调查森林异响
            - generic [aria-hidden] [ref=e23]: ▾
      - generic:
        - group "快捷道具栏，1 至 8":
          - button "恢复药剂 · 快捷键 1 · 数量 1" [ref=e24] [cursor=pointer]:
            - generic [ref=e25]: "1"
            - strong [ref=e26]: "1"
          - button "浆果 · 快捷键 2 · 数量 1" [ref=e27] [cursor=pointer]:
            - generic [ref=e28]: "2"
            - strong [ref=e29]: "1"
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
    - status: 制作成功：恢复药剂 ×1
  - complementary [ref=e48]:
    - button "居民笔记 · N" [ref=e49] [cursor=pointer]
```

# Test source

```ts
  1   | import {approachNpc} from './npc-navigation';
  2   | import { move } from "./map-navigation";
  3   | import { writeFile } from "node:fs/promises";
  4   | import { captureGameAudio } from "../tools/capture-game-audio.mjs";
  5   | import { test, expect, type Page } from "@playwright/test";
  6   | test.use({ video: "on" });
  7   | const snapshot = (p: Page) => p.evaluate(() => (window as any).__farwind());
  8   | async function dismiss(p: Page) {
  9   |   const s = await snapshot(p);
  10  |   if (s.mode === "dialog")
  11  |     await p.getByRole("button", { name: "继续 · E" }).click();
  12  |   else if (s.mode === "pause")
  13  |     await p.getByRole("button", { name: "继续旅途", exact: true }).click();
  14  | }
  15  | async function interact(p: Page, id: string) {
  16  |   await expect.poll(async () => (await snapshot(p)).target).toBe(id);
  17  |   await p.keyboard.press("e");
  18  |   await p.waitForTimeout(100);
  19  | }
  20  | test("adventure-loop", async ({ page, context }) => {
  21  |   test.setTimeout(300000);
  22  |   const errors: string[] = [];
  23  |   page.on("pageerror", (e) => errors.push(e.message));
  24  |   await page.addInitScript(captureGameAudio);
  25  |   await page.goto("/");
  26  |   await page.getByRole("button", { name: "启程 · 新游戏" }).click();
  27  |   await approachNpc(page,"elder");
  28  |   await interact(page, "elder");
  29  |   await dismiss(page);
  30  |   await expect.poll(async () => (await snapshot(page)).state.quest).toBe(1);
  31  |   await move(page, 1180, 560);
  32  |   await interact(page, "herb-v1");
  33  |   await move(page, 350, 1410);
  34  |   await interact(page, "berry-v1");
  35  |   await move(page, 270, 1150);
  36  |   await interact(page, "wood-v1");
  37  |   await move(page, 1730, 1210);
  38  |   await interact(page, "stone-v1");
  39  |   await move(page, 2170, 1080);
  40  |   await dismiss(page);
  41  |   await page.keyboard.press("Tab");
  42  |   await page.getByRole("button", { name: "制作恢复药剂", exact: true }).click();
  43  |   await page.screenshot({ path: "docs/map-expansion/adventure/inventory.png" });
  44  |   await page.getByRole("button", { name: "收好行囊" }).click();
> 45  |   await expect.poll(async () => (await snapshot(page)).state.quest).toBe(3);
      |                                                                     ^ Error: expect(received).toBe(expected) // Object.is equality
  46  |   await page.screenshot({ path: "docs/map-expansion/adventure/forest.png" });
  47  |   await move(page, 2500, 1080);
  48  |   for (let round = 0; round < 70; round++) {
  49  |     await dismiss(page);
  50  |     const s = await snapshot(page);
  51  |     if (s.state.quest >= 4) break;
  52  |     const enemies = s.enemies.filter((e: any) => e.hp > 0),
  53  |       target = enemies.find((e: any) => e.id === "leaf-1") ?? enemies[0];
  54  |     if (!target) break;
  55  |     const dx = target.x - s.state.player.x,
  56  |       dy = target.y - s.state.player.y;
  57  |     const key =
  58  |       Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "d" : "a") : dy > 0 ? "s" : "w";
  59  |     await page.keyboard.down(key);
  60  |     await page.waitForTimeout(Math.hypot(dx, dy) > 70 ? 180 : 25);
  61  |     await page.keyboard.up(key);
  62  |     await page.keyboard.press("j");
  63  |     await page.waitForTimeout(440);
  64  |     if (s.state.player.hp < 60) await page.keyboard.press("1");
  65  |   }
  66  |   await expect.poll(async () => (await snapshot(page)).state.quest).toBe(4);
  67  |   await move(page, 3200, 1100);
  68  |   await move(page, 3370, 920);
  69  |   await move(page, 3450, 920);
  70  |   await move(page, 3450, 680);
  71  |   await move(page, 3510, 590);
  72  |   await interact(page, "wind-0");
  73  |   await move(page, 3730, 500);
  74  |   await move(page, 3760, 450);
  75  |   await interact(page, "wind-1");
  76  |   await move(page, 3950, 510);
  77  |   await interact(page, "wind-2");
  78  |   await page.screenshot({ path: "docs/map-expansion/adventure/ruins.png" });
  79  |   await move(page, 3740, 730);
  80  |   await interact(page, "waymark");
  81  |   await dismiss(page);
  82  |   await expect
  83  |     .poll(async () => (await snapshot(page)).state.shortcut)
  84  |     .toBe(true);
  85  |   await move(page, 3550, 890);
  86  |   await interact(page, "shortcut");
  87  |   await approachNpc(page,"elder");
  88  |   await interact(page, "elder");
  89  |   await dismiss(page);
  90  |   await expect.poll(async () => (await snapshot(page)).state.quest).toBe(7);
  91  |   await page.keyboard.press("q");
  92  |   await page.screenshot({ path: "docs/map-expansion/adventure/quest.png" });
  93  |   await page.getByRole("button", { name: "合上手记" }).click();
  94  |   await page.keyboard.press("Escape");
  95  |   await page.getByRole("button", { name: "保存旅途", exact: true }).click();
  96  |   await expect(page.locator("#toast")).toContainText("已保存");
  97  |   const before = (await snapshot(page)).state;
  98  |   const audio = await page.evaluate(() => (window as any).__finishAudio());
  99  |   await writeFile(
  100 |     "docs/map-expansion/adventure/forest-audio.webm",
  101 |     Buffer.from(audio.base64, "base64"),
  102 |   );
  103 |   await writeFile(
  104 |     "docs/map-expansion/adventure/forest-audio-offset.txt",
  105 |     String(audio.offset),
  106 |   );
  107 |   const video = page.video();
  108 |   await page.close();
  109 |   await video?.saveAs("docs/map-expansion/adventure/forest-journey.webm");
  110 |   const reopened = await context.newPage();
  111 |   await reopened.goto("/");
  112 |   await reopened.getByRole("button", { name: "继续旅途", exact: true }).click();
  113 |   const after = (await snapshot(reopened)).state;
  114 |   expect(after.quest).toBe(7);
  115 |   expect(after.shortcut).toBe(true);
  116 |   expect(after.bag).toEqual(before.bag);
  117 |   expect(after.stones).toEqual([0, 1, 2]);
  118 |   expect(after.reward).toBe(true);
  119 |   expect(errors).toEqual([]);
  120 |   await reopened.screenshot({
  121 |     path: "docs/map-expansion/adventure/continued.png",
  122 |   });
  123 | });
  124 | 
```