# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: drop.spec.ts >> 隔离满包夹具：正常击杀、整理后领取、存档往返不重复
- Location: tests/drop.spec.ts:4:1

# Error details

```
Error: expect(received).toContain(expected) // indexOf

Expected value: "leaf-1"
Received array: ["slime-1", "slime-2"]

Call Log:
- Timeout 5000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic:
    - generic:
      - generic:
        - generic [ref=e4]:
          - img "旅行者" [ref=e5]
          - generic [ref=e6]:
            - generic [ref=e7]: 旅人 与小黑同行
            - generic [ref=e8]: 生命 100 / 100
            - generic [ref=e11]: 体力 100 / 100
        - generic [ref=e14]:
          - generic [ref=e15]: 风铃村
          - generic [ref=e16]: 第 1 日 · 08:24
          - generic "位置小地图" [ref=e17]
      - generic [ref=e18]:
        - generic [ref=e19]: 风从这里开始
        - generic [ref=e20]: 击退森林的叶灵，取得风之结晶
        - button "Q 旅途手记" [ref=e21] [cursor=pointer]
      - generic:
        - generic: WASD 移动 · Shift 奔跑 · E 交互 · J/左键 三连斩 · Space 风步 · 就绪
        - generic [ref=e22]:
          - button "1 恢复药剂 0" [ref=e23] [cursor=pointer]:
            - generic [ref=e24]: "1"
            - img "恢复药剂" [ref=e25]
            - strong [ref=e26]: "0"
          - button "2 浆果 0" [ref=e27] [cursor=pointer]:
            - generic [ref=e28]: "2"
            - img "浆果" [ref=e29]
            - strong [ref=e30]: "0"
          - button "3 —" [ref=e31] [cursor=pointer]:
            - generic [ref=e32]: "3"
            - generic [ref=e33]: —
            - strong
          - button "4 —" [ref=e34] [cursor=pointer]:
            - generic [ref=e35]: "4"
            - generic [ref=e36]: —
            - strong
          - button "5 —" [ref=e37] [cursor=pointer]:
            - generic [ref=e38]: "5"
            - generic [ref=e39]: —
            - strong
          - button "6 —" [ref=e40] [cursor=pointer]:
            - generic [ref=e41]: "6"
            - generic [ref=e42]: —
            - strong
          - button "7 —" [ref=e43] [cursor=pointer]:
            - generic [ref=e44]: "7"
            - generic [ref=e45]: —
            - strong
          - button "8 —" [ref=e46] [cursor=pointer]:
            - generic [ref=e47]: "8"
            - generic [ref=e48]: —
            - strong
        - generic [ref=e49]:
          - button "Tab 行囊" [ref=e50] [cursor=pointer]
          - button "M 地图" [ref=e51] [cursor=pointer]
          - button "Esc 暂停" [ref=e52] [cursor=pointer]
    - status: 旅途已保存
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | import { initialState } from "../src/game/systems/state";
  3  | const read = (p: any) => p.evaluate(() => (window as any).__farwind());
  4  | test("隔离满包夹具：正常击杀、整理后领取、存档往返不重复", async ({ page }) => {
  5  |   const fixture = initialState();
  6  |   fixture.player.x = 2260;
  7  |   fixture.player.y = 1070;
  8  |   fixture.quest = 3;
  9  |   fixture.killed = ["slime-1", "slime-2"];
  10 |   fixture.bag = Array.from({ length: 24 }, (_, i) => ({
  11 |     id: "stone" as const,
  12 |     count: i ? 20 : 1,
  13 |   }));
  14 |   page.on("dialog", (dialog) => dialog.accept());
  15 |   await page.goto("/");
  16 |   const chooser = page.waitForEvent("filechooser");
  17 |   await page.getByRole("button", { name: "导入存档" }).click();
  18 |   await (
  19 |     await chooser
  20 |   ).setFiles({
  21 |     name: "full-bag-fixture.json",
  22 |     mimeType: "application/json",
  23 |     buffer: Buffer.from(JSON.stringify(fixture)),
  24 |   });
  25 |   await expect
  26 |     .poll(async () => (await read(page)).state.player.x)
  27 |     .toBeGreaterThan(2200);
  28 |   for (let i = 0; i < 16; i++) {
  29 |     const s = await read(page);
  30 |     if (s.state.killed.includes("leaf-1")) break;
  31 |     const leaf = s.enemies.find((e: any) => e.id === "leaf-1");
  32 |     const dx = leaf.x - s.state.player.x,
  33 |       dy = leaf.y - s.state.player.y;
  34 |     const key =
  35 |       Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "d" : "a") : dy > 0 ? "s" : "w";
  36 |     const facing = key === "d" ? 3 : key === "a" ? 2 : key === "w" ? 1 : 0;
  37 |     await page.keyboard.down(key);
  38 |     await expect
  39 |       .poll(async () => (await read(page)).animation.hero.direction)
  40 |       .toBe(facing);
  41 |     await page.keyboard.up(key);
  42 |     await page.keyboard.press("j");
  43 |     await page.waitForTimeout(410);
  44 |   }
  45 |   await expect
  46 |     .poll(async () => (await read(page)).state.killed)
> 47 |     .toContain("leaf-1");
     |      ^ Error: expect(received).toContain(expected) // indexOf
  48 |   const dead = await read(page);
  49 |   expect(dead.state.pendingDrops.map((d: any) => d.enemyId)).toContain(
  50 |     "leaf-1",
  51 |   );
  52 |   expect(dead.enemies.find((e: any) => e.id === "leaf-1").hp).toBe(0);
  53 |   await page.keyboard.press("Tab");
  54 |   await page.locator('[data-slot="0"]').click();
  55 |   await page.getByRole("button", { name: "丢弃一件" }).click();
  56 |   await page.getByRole("button", { name: "收好行囊" }).click();
  57 |   await page.keyboard.press("e");
  58 |   await expect
  59 |     .poll(async () => (await read(page)).state.pendingDrops.length)
  60 |     .toBe(0);
  61 |   await expect
  62 |     .poll(async () =>
  63 |       (await read(page)).state.bag.some((a: any) => a?.id === "crystal"),
  64 |     )
  65 |     .toBe(true);
  66 |   await page.keyboard.press("Escape");
  67 |   await page.getByRole("button", { name: "保存并返回标题" }).click();
  68 |   await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  69 |   const after = await read(page);
  70 |   expect(after.state.killed).toContain("leaf-1");
  71 |   expect(after.state.pendingDrops).toHaveLength(0);
  72 |   expect(
  73 |     after.state.bag
  74 |       .filter((a: any) => a?.id === "crystal")
  75 |       .reduce((n: number, a: any) => n + a.count, 0),
  76 |   ).toBe(1);
  77 | });
  78 | 
```