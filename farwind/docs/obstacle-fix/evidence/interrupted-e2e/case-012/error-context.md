# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: obstacles.spec.ts >> 隔离实机树边反例：正常出生、换侧、绕障与真实命中，不修改敌人
- Location: tests/obstacles.spec.ts:33:1

# Error details

```
TypeError: Cannot read properties of undefined (reading 'map')
```

# Page snapshot

```yaml
- generic [active] [ref=f1e1]:
  - generic:
    - status
    - generic [ref=f1e5]:
      - generic [ref=f1e6]:
        - text: 远 风 之 地
        - heading "远风之地" [level=1] [ref=f1e7]
      - paragraph [ref=f1e8]: 沿着风，遇见属于你的故事。
      - paragraph [ref=f1e9]: 第一章 · 风铃村的来信
      - generic [ref=f1e10]:
        - button "启程 · 新游戏" [ref=f1e11] [cursor=pointer]
        - button "继续旅途" [ref=f1e12] [cursor=pointer]
        - button "设置" [ref=f1e13] [cursor=pointer]
      - paragraph [ref=f1e14]: 本地存档可能随站点数据清理而丢失，请定期导出备份。
      - button "导入存档" [ref=f1e15] [cursor=pointer]
```

# Test source

```ts
  1   | import { test, expect, type Page } from "@playwright/test";
  2   | import { writeFile } from "node:fs/promises";
  3   | import { initialState } from "../src/game/systems/state";
  4   | import {
  5   |   clearMotionLine,
  6   |   motionBlocked,
  7   |   clearMeleeLine,
  8   | } from "../src/game/systems/obstacles";
  9   | test.use({ video: { mode: "on", size: { width: 1280, height: 720 } } });
  10  | const read = (page: Page) => page.evaluate(() => (window as any).__farwind());
  11  | async function walk(page: Page, x: number, y: number) {
  12  |   for (const [axis, target] of [
  13  |     ["x", x],
  14  |     ["y", y],
  15  |   ] as const) {
  16  |     const p = (await read(page)).state.player;
  17  |     if (Math.abs(p[axis] - target) < 3) continue;
  18  |     const sign = Math.sign(target - p[axis]),
  19  |       key = axis === "x" ? (sign > 0 ? "d" : "a") : sign > 0 ? "s" : "w";
  20  |     await page.keyboard.down(key);
  21  |     try {
  22  |       await page.waitForFunction(
  23  |         ({ axis, target, sign }) =>
  24  |           sign * ((window as any).__farwind().state.player[axis] - target) > -2,
  25  |         { axis, target, sign },
  26  |         { timeout: 6000 },
  27  |       );
  28  |     } finally {
  29  |       await page.keyboard.up(key);
  30  |     }
  31  |   }
  32  | }
  33  | test("隔离实机树边反例：正常出生、换侧、绕障与真实命中，不修改敌人", async ({
  34  |   page,
  35  | }) => {
  36  |   const fixture = initialState();
  37  |   fixture.player.x = 3030;
  38  |   fixture.player.y = 1010;
  39  |   fixture.quest = 4;
  40  |   fixture.killed = ["slime-1", "slime-2", "leaf-1"];
  41  |   page.on("dialog", (d) => d.accept());
  42  |   await page.goto("/?obstacleDebug=1");
  43  |   const chooser = page.waitForEvent("filechooser");
  44  |   await page.getByRole("button", { name: "导入存档" }).click();
  45  |   await (
  46  |     await chooser
  47  |   ).setFiles({
  48  |     name: "tree-edge-fixture.json",
  49  |     mimeType: "application/json",
  50  |     buffer: Buffer.from(JSON.stringify(fixture)),
  51  |   });
  52  |   await page.waitForFunction(
  53  |     () =>
  54  |       (window as any).__farwind().mode === "" &&
  55  |       (window as any).__farwind().state.player.x > 3000,
  56  |   );
  57  |   await page.evaluate(() => {
  58  |     (window as any).__obstacleTrace = [];
  59  |     (window as any).__obstacleTimer = setInterval(() => {
  60  |       const s = (window as any).__farwind();
  61  |       (window as any).__obstacleTrace.push({
  62  |         时间: s.session.sim,
  63  |         玩家: s.state.player,
  64  |         敌人: s.enemies[0],
  65  |         战斗: s.session.combat,
  66  |       });
  67  |     }, 16);
  68  |   });
  69  |   await page.waitForTimeout(2000);
  70  |   await walk(page, 3210, 1010);
  71  |   await walk(page, 3210, 960);
  72  |   await page.keyboard.down("a");
  73  |   await page.waitForFunction(
  74  |     () => (window as any).__farwind().animation.hero.direction === 2,
  75  |   );
  76  |   await page.keyboard.up("a");
  77  |   await page.keyboard.press("j");
  78  |   await expect.poll(async () => (await read(page)).enemies[0].hp).toBe(54);
  79  |   await page.screenshot({ path: "docs/obstacle-fix/evidence/edge-hit.png" });
  80  |   await page.waitForTimeout(850);
  81  |   await walk(page, 3210, 1020);
  82  |   await walk(page, 3130, 1020);
  83  |   await walk(page, 3130, 993);
  84  |   await page.waitForTimeout(900);
  85  |   await walk(page, 3060, 993);
  86  |   await walk(page, 3060, 930);
  87  |   await walk(page, 3130, 930);
  88  |   await page.waitForTimeout(2400);
  89  |   const trace = await page.evaluate(() => {
  90  |     clearInterval((window as any).__obstacleTimer);
  91  |     return (window as any).__obstacleTrace;
  92  |   });
> 93  |   const enemyTrace = trace.map((s: any) => s.敌人);
      |                            ^ TypeError: Cannot read properties of undefined (reading 'map')
  94  |   expect(enemyTrace.some((e: any) => e.ai === "绕障")).toBe(true);
  95  |   expect(
  96  |     enemyTrace.some(
  97  |       (e: any) => e.meleeBlocker === "tree-20" && e.ai !== "前摇",
  98  |     ),
  99  |   ).toBe(true);
  100 |   for (let i = 0; i < trace.length; i++) {
  101 |     const e = trace[i].敌人;
  102 |     expect(e.recovered).toBe(false);
  103 |     expect(e.disabled).toBe(false);
  104 |     expect(motionBlocked(e.x, e.y)).toBe(false);
  105 |     if (i > 0) expect(clearMotionLine(enemyTrace[i - 1], e)).toBe(true);
  106 |     const prior = i ? trace[i - 1].敌人 : null;
  107 |     if (e.windup > 0 && (!prior || prior.windup === 0))
  108 |       expect(clearMeleeLine(e, trace[i].玩家)).toBe(true);
  109 |   }
  110 |   await writeFile(
  111 |     "docs/obstacle-fix/evidence/isolated-runtime.json",
  112 |     JSON.stringify(
  113 |       {
  114 |         说明: "隔离实机：仅导入玩家起点与其他敌人已死亡进度；叶灵使用正式出生点、AI、生命和碰撞，正常速度真实键盘。",
  115 |         轨迹: trace,
  116 |       },
  117 |       null,
  118 |       2,
  119 |     ),
  120 |   );
  121 |   await page.screenshot({
  122 |     path: "docs/obstacle-fix/evidence/detour-runtime.png",
  123 |   });
  124 |   await page.keyboard.press("Escape");
  125 |   const paused = await read(page);
  126 |   await page.waitForTimeout(350);
  127 |   expect((await read(page)).enemies).toEqual(paused.enemies);
  128 |   await page.getByRole("button", { name: "保存并返回标题" }).click();
  129 |   await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  130 |   expect((await read(page)).state.quest).toBe(fixture.quest);
  131 |   expect((await read(page)).state.killed).toEqual(fixture.killed);
  132 |   expect((await read(page)).enemies[0].recovered).toBe(false);
  133 | });
  134 | 
  135 | test("隔离异常掉落旧档：修复安全点、死亡ID不复活、正常领取关键材料与续玩", async ({
  136 |   page,
  137 | }) => {
  138 |   const fixture = initialState();
  139 |   fixture.quest = 4;
  140 |   fixture.player.x = 3210;
  141 |   fixture.player.y = 920;
  142 |   fixture.killed = ["slime-1", "slime-2", "leaf-1", "leaf-2"];
  143 |   fixture.pendingDrops = [
  144 |     { enemyId: "leaf-2", item: "crystal", x: 3130, y: 965 },
  145 |   ];
  146 |   page.on("dialog", (d) => d.accept());
  147 |   await page.goto("/");
  148 |   const chooser = page.waitForEvent("filechooser");
  149 |   await page.getByRole("button", { name: "导入存档" }).click();
  150 |   await (
  151 |     await chooser
  152 |   ).setFiles({
  153 |     name: "invalid-drop-fixture.json",
  154 |     mimeType: "application/json",
  155 |     buffer: Buffer.from(JSON.stringify(fixture)),
  156 |   });
  157 |   await page.waitForFunction(
  158 |     () =>
  159 |       (window as any).__farwind().mode === "" &&
  160 |       (window as any).__farwind().state.player.x > 3000,
  161 |   );
  162 |   const s = await read(page),
  163 |     drop = s.state.pendingDrops[0];
  164 |   expect(s.enemies).toEqual([]);
  165 |   expect(s.state.killed).toEqual(fixture.killed);
  166 |   expect(motionBlocked(drop.x, drop.y)).toBe(false);
  167 |   expect(Math.hypot(drop.x - 3130, drop.y - 965)).toBeLessThan(40);
  168 |   await walk(page, drop.x, 920);
  169 |   await page.keyboard.press("e");
  170 |   await expect
  171 |     .poll(async () => (await read(page)).state.pendingDrops.length)
  172 |     .toBe(0);
  173 |   const state = (await read(page)).state;
  174 |   expect(state.bag.some((s: any) => s?.id === "crystal" && s.count === 1)).toBe(
  175 |     true,
  176 |   );
  177 |   expect(state.quest).toBe(4);
  178 |   await page.keyboard.press("Escape");
  179 |   await page.getByRole("button", { name: "保存并返回标题" }).click();
  180 |   await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  181 |   expect((await read(page)).enemies).toEqual([]);
  182 |   expect((await read(page)).state.pendingDrops).toEqual([]);
  183 |   expect((await read(page)).state.bag).toEqual(state.bag);
  184 | });
  185 | 
```