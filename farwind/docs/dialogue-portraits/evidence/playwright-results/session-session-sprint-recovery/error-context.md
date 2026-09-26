# 自动测试失败证据

以下保留当时的错误堆栈、页面快照与代码，便于复核首因；修复后的结果见本任务报告。

# 测试信息

- 名称： session.spec.ts >> session-sprint-recovery
- 位置： tests/session.spec.ts:27:1

# 错误详情

```
Error: expect(received).toBeCloseTo(expected, precision)

Expected: 150
Received: 125.39682538519202

Expected precision:    0
Expected difference: < 0.5
Received difference:   24.603174614807983
```

# 页面快照

```yaml
- generic [active] [ref=e1]:
  - generic:
    - generic:
      - generic:
        - generic:
          - generic:
            - img "旅行者"
            - generic:
              - generic: 旅人 与小黑同行
              - generic: 生命 100 / 100
              - generic: 体力 100 / 100
          - generic: L 风步 · 就绪
        - generic:
          - button "展开小地图" [ref=e4] [cursor=pointer]:
            - generic [ref=e5]: 风铃村
            - generic [ref=e6]: ·
            - generic [ref=e7]: 08:02
            - generic [aria-hidden] [ref=e10]: ▾
          - button "展开任务详情：与广场的守风人交谈" [ref=e11] [cursor=pointer]:
            - generic [ref=e12]: 任务 · 与广场的守风人交谈
            - generic [aria-hidden] [ref=e13]: ▾
      - generic:
        - group "快捷道具栏，1 至 8":
          - button "恢复药剂 · 快捷键 1 · 数量 0" [ref=e14] [cursor=pointer]:
            - generic [ref=e15]: "1"
            - strong [ref=e16]: "0"
          - button "浆果 · 快捷键 2 · 数量 0" [ref=e17] [cursor=pointer]:
            - generic [ref=e18]: "2"
            - strong [ref=e19]: "0"
          - button "空槽 · 快捷键 3 · 在行囊中绑定" [ref=e20] [cursor=pointer]:
            - generic [ref=e21]: "3"
            - generic [ref=e22]: —
            - strong
          - button "空槽 · 快捷键 4 · 在行囊中绑定" [ref=e23] [cursor=pointer]:
            - generic [ref=e24]: "4"
            - generic [ref=e25]: —
            - strong
          - button "空槽 · 快捷键 5 · 在行囊中绑定" [ref=e26] [cursor=pointer]:
            - generic [ref=e27]: "5"
            - generic [ref=e28]: —
            - strong
          - button "空槽 · 快捷键 6 · 在行囊中绑定" [ref=e29] [cursor=pointer]:
            - generic [ref=e30]: "6"
            - generic [ref=e31]: —
            - strong
          - button "空槽 · 快捷键 7 · 在行囊中绑定" [ref=e32] [cursor=pointer]:
            - generic [ref=e33]: "7"
            - generic [ref=e34]: —
            - strong
          - button "空槽 · 快捷键 8 · 在行囊中绑定" [ref=e35] [cursor=pointer]:
            - generic [ref=e36]: "8"
            - generic [ref=e37]: —
            - strong
    - status: 风铃村欢迎你。向北走几步，按 E 与守风人交谈。
```

# 测试源码

```ts
  1   | import { move } from "./map-navigation";
  2   | import { test, expect, type Page } from "@playwright/test";
  3   | const read = (p: Page) => p.evaluate(() => (window as any).__farwind());
  4   | async function hold(p: Page, key: string, ms: number) {
  5   |   await p.keyboard.down(key);
  6   |   await p.waitForTimeout(ms);
  7   |   const s = await read(p);
  8   |   await p.keyboard.up(key);
  9   |   return s;
  10  | }
  11  | async function title(p: Page) {
  12  |   await p.keyboard.press("Escape");
  13  |   await p.getByRole("button", { name: "保存并返回标题" }).click();
  14  |   await expect(p.getByRole("button", { name: "启程 · 新游戏" })).toBeVisible();
  15  | }
  16  | async function moving(p: Page) {
  17  |   await expect(p.locator("#modal")).toBeHidden();
  18  |   await p.keyboard.down("d");
  19  |   await expect
  20  |     .poll(async () => (await read(p)).animation.hero.action)
  21  |     .toBe("walk");
  22  |   await p.keyboard.up("d");
  23  |   await expect
  24  |     .poll(async () => (await read(p)).animation.hero.action)
  25  |     .toBe("idle");
  26  | }
  27  | test("session-sprint-recovery", async ({ page }) => {
  28  |   await page.goto("/?animationDebug=1");
  29  |   await page.getByRole("button", { name: "启程 · 新游戏" }).click();
  30  |   await expect
  31  |     .poll(async () => (await read(page)).session.sim)
  32  |     .toBeGreaterThan(200);
  33  |   await page.keyboard.press("Escape");
  34  |   await page.locator("#pause-help").click();
  35  |   await expect(page.locator(".controls-guide")).toContainText("按住空格并移动");
  36  |   await page.keyboard.press("Escape");
  37  |   await page.keyboard.press("Escape");
  38  |   await page.keyboard.down("Shift");
  39  |   const oldKey = await hold(page, "a", 180);
  40  |   expect(oldKey.animation.hero.action).toBe("walk");
> 41  |   expect(oldKey.animation.hero.speed).toBeCloseTo(150, 0);
      |                                       ^ Error: expect(received).toBeCloseTo(expected, precision)
  42  |   await page.keyboard.up("Shift");
  43  |   const stationary = await hold(page, "Space", 180);
  44  |   expect(stationary.animation.hero.action).toBe("idle");
  45  |   expect(stationary.session.combat.dashCooldownRemaining).toBe(0);
  46  |   const transitions: any[] = [];
  47  |   let last = "run",
  48  |     lastChange = 0;
  49  |   await page.keyboard.down("Space");
  50  |   for (let n = 0; n < 32; n++) {
  51  |     const key = n % 2 ? "d" : "a";
  52  |     await page.keyboard.down(key);
  53  |     await expect
  54  |       .poll(async () => (await read(page)).animation.hero.speed, {
  55  |         intervals: [16, 32, 50],
  56  |       })
  57  |       .toBeGreaterThan(100);
  58  |     if (n === 0) {
  59  |       expect((await read(page)).animation.hero.action).toBe("run");
  60  |       await page.keyboard.up("Space");
  61  |       await expect
  62  |         .poll(async () => (await read(page)).animation.hero.action)
  63  |         .toBe("walk");
  64  |       await page.keyboard.down("Space");
  65  |       await expect
  66  |         .poll(async () => (await read(page)).animation.hero.action)
  67  |         .toBe("run");
  68  |     }
  69  |     for (let i = 0; i < 10; i++) {
  70  |       await page.waitForTimeout(50);
  71  |       const s = await read(page),
  72  |         a = s.animation.hero.action;
  73  |       expect(["walk", "run"]).toContain(a);
  74  |       if (a !== last) {
  75  |         if (lastChange) expect(s.session.sim - lastChange).toBeGreaterThan(800);
  76  |         transitions.push({
  77  |           sim: s.session.sim,
  78  |           体力: s.state.player.stamina,
  79  |           动作: a,
  80  |         });
  81  |         lastChange = s.session.sim;
  82  |         last = a;
  83  |       }
  84  |       if (
  85  |         s.session.exhausted &&
  86  |         s.state.player.stamina > 3 &&
  87  |         s.state.player.stamina < 15
  88  |       ) {
  89  |         await page.keyboard.up("Space");
  90  |         await page.keyboard.down("Space");
  91  |         expect(s.animation.hero.action).toBe("walk");
  92  |       }
  93  |     }
  94  |     await page.keyboard.up(key);
  95  |   }
  96  |   await page.keyboard.up("Space");
  97  |   expect(transitions.length).toBeGreaterThan(4);
  98  |   expect(transitions.length).toBeLessThan(18);
  99  |   await page.keyboard.press("Escape");
  100 |   await expect(page.getByText("世界与时间已暂停。")).toBeVisible();
  101 |   const paused = await read(page);
  102 |   await hold(page, "d", 400);
  103 |   expect((await read(page)).session).toEqual(paused.session);
  104 |   await page.keyboard.press("Escape");
  105 |   await moving(page);
  106 | });
  107 | test("session-title-continue-new-refresh", async ({ page }) => {
  108 |   await page.goto("/?animationDebug=1");
  109 |   await page.getByRole("button", { name: "启程 · 新游戏" }).click();
  110 |   await page.waitForTimeout(3000);
  111 |   await page.keyboard.press("j");
  112 |   await expect
  113 |     .poll(async () => (await read(page)).animation.hero.action, {
  114 |       intervals: [16, 32, 50],
  115 |     })
  116 |     .toBe("attack");
  117 |   await expect
  118 |     .poll(async () => (await read(page)).animation.hero.action)
  119 |     .toBe("idle");
  120 |   const saved = (await read(page)).state;
  121 |   await title(page);
  122 |   await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  123 |   await page.waitForTimeout(100);
  124 |   expect((await read(page)).session.attackUntil).toBe(0);
  125 |   expect((await read(page)).state.bag).toEqual(saved.bag);
  126 |   await moving(page);
  127 |   // 当前地图的药草位于药师小院，通过正常通行路线到达，不设置游戏状态。
  128 |   await move(page, 1180, 560);
  129 |   await expect.poll(async () => (await read(page)).target).toBe("herb-v1");
  130 |   await page.keyboard.press("e");
  131 |   await expect
  132 |     .poll(async () => (await read(page)).state.collected["herb-v1"])
  133 |     .toBeDefined();
  134 |   await page.waitForTimeout(400);
  135 |   expect((await read(page)).animation.hero.action).toBe("idle");
  136 |   await title(page);
  137 |   await page.getByRole("button", { name: "启程 · 新游戏" }).click();
  138 |   await page.getByRole("button", { name: "确认新游戏" }).click();
  139 |   await page.waitForTimeout(100);
  140 |   expect((await read(page)).session.attackUntil).toBe(0);
  141 |   await moving(page);
```