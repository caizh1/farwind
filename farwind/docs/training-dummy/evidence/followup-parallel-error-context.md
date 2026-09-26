# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: combat-followup.spec.ts >> 最终显示：宽限内持剑，接招不插空手；缓退松键按有效面向风步
- Location: tests/combat-followup.spec.ts:4:1

# Error details

```
Error: page.waitForFunction: Test ended.
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | test.use({ video: "on" });
  3  | 
  4  | test("最终显示：宽限内持剑，接招不插空手；缓退松键按有效面向风步", async ({
  5  |   page,
  6  | }) => {
  7  |   await page.goto("/?animationDebug=1");
  8  |   await page.getByRole("button", { name: "启程 · 新游戏" }).click();
  9  |   await page.waitForFunction(
  10 |     () =>
  11 |       (window as any).__farwind?.().mode === "" &&
  12 |       (window as any).__farwind().session.sim > 500,
  13 |   );
  14 |   await page.keyboard.down("d");
  15 |   await page.waitForTimeout(100);
  16 |   await page.keyboard.up("d");
  17 |   await page.keyboard.press("j");
  18 |   await page.waitForFunction(
  19 |     () => (window as any).__farwind().animation.hero.phase === "ready",
  20 |     undefined,
  21 |     { polling: 8 },
  22 |   );
  23 |   const ready = await page.evaluate(() => (window as any).__farwind());
  24 |   expect(ready.session.combat.stage).toBe(0);
  25 |   expect(ready.animation.hero.texture).toBe("hero-combat-side");
  26 |   await page.keyboard.press("j");
  27 |   await page.waitForFunction(
  28 |     () => (window as any).__farwind().session.combat.stage === 2,
  29 |     undefined,
  30 |     { polling: 8 },
  31 |   );
  32 |   expect(
  33 |     (await page.evaluate(() => (window as any).__farwind())).animation.hero
  34 |       .texture,
  35 |   ).toBe("hero-combat-side");
  36 |   await page.waitForTimeout(800);
  37 |   for (const [key, opposite, direction] of [
  38 |     ["d", "a", 3],
  39 |     ["a", "d", 2],
  40 |     ["w", "s", 1],
  41 |     ["s", "w", 0],
  42 |   ] as const) {
  43 |     await page.keyboard.down(key);
  44 |     await page.waitForTimeout(100);
  45 |     await page.keyboard.up(key);
  46 |     await page.keyboard.press("j");
> 47 |     await page.waitForFunction(
     |                ^ Error: page.waitForFunction: Test ended.
  48 |       () => {
  49 |         const s = (window as any).__farwind();
  50 |         return (
  51 |           s.session.combat.stage === 1 &&
  52 |           s.session.attackUntil - s.session.sim < 130
  53 |         );
  54 |       },
  55 |       undefined,
  56 |       { polling: 8 },
  57 |     );
  58 |     await page.keyboard.down(opposite);
  59 |     await page.waitForTimeout(30);
  60 |     await page.keyboard.up(opposite);
  61 |     await page.keyboard.press("Space");
  62 |     await page.waitForFunction(
  63 |       () => (window as any).__farwind().session.combat.dashRemaining > 0,
  64 |       undefined,
  65 |       { polling: 8 },
  66 |     );
  67 |     expect(
  68 |       (await page.evaluate(() => (window as any).__farwind())).animation.hero
  69 |         .direction,
  70 |     ).toBe(direction);
  71 |     await page.waitForTimeout(750);
  72 |   }
  73 |   await page.screenshot({
  74 |     path: "docs/combat-followup/evidence/ready-dash.png",
  75 |   });
  76 | });
  77 | 
```