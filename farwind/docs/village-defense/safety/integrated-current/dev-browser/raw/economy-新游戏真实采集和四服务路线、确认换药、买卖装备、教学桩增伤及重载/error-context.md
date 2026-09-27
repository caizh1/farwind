# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: economy.spec.ts >> 新游戏真实采集和四服务路线、确认换药、买卖装备、教学桩增伤及重载
- Location: tests/economy.spec.ts:58:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 2
Received: 1
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
          - generic: 剑风：测试授予
        - generic:
          - button "展开小地图" [ref=e14] [cursor=pointer]:
            - generic [ref=e15]: 巡逻近郊
            - generic [ref=e16]: ·
            - generic [ref=e17]: 第1日 09:26 · 白天
            - generic [aria-hidden] [ref=e20]: ▾
          - button "展开任务详情：沿东侧石路调查森林异响" [ref=e21] [cursor=pointer]:
            - generic [ref=e22]: 任务 · 沿东侧石路调查森林异响
            - generic [aria-hidden] [ref=e23]: ▾
      - generic:
        - group "快捷道具栏，1 至 8":
          - button "恢复药剂 · 快捷键 1 · 数量 0" [ref=e24] [cursor=pointer]:
            - generic [ref=e25]: "1"
            - strong [ref=e26]: "0"
          - button "浆果 · 快捷键 2 · 数量 2" [ref=e27] [cursor=pointer]:
            - generic [ref=e28]: "2"
            - strong [ref=e29]: "2"
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
    - status: 抵达 · 巡逻近郊
  - complementary [ref=e48]:
    - button "居民笔记 · N" [ref=e49] [cursor=pointer]
```

# Test source

```ts
  1   | import { approachNpc } from "./npc-navigation";
  2   | import { test, expect, type Page } from "@playwright/test";
  3   | import { mkdir, writeFile } from "node:fs/promises";
  4   | import { move } from "./map-navigation";
  5   | import { initialState, add } from "../src/game/systems/state";
  6   | import { STRIKES } from "../src/game/systems/combat";
  7   | const root =
  8   |   process.env.FARWIND_EVIDENCE_ROOT ?? "docs/village-defense/m2/evidence";
  9   | const read = (p: Page) => p.evaluate(() => (window as any).__farwind());
  10  | async function fixture(page: Page, state = initialState()) {
  11  |   page.once("dialog", (d) => d.accept());
  12  |   const chooser = page.waitForEvent("filechooser");
  13  |   await page.getByRole("button", { name: "导入存档", exact: true }).click();
  14  |   await (
  15  |     await chooser
  16  |   ).setFiles({
  17  |     name: "economy-fixture.json",
  18  |     mimeType: "application/json",
  19  |     buffer: Buffer.from(JSON.stringify(state)),
  20  |   });
  21  |   await page.waitForFunction(() => (window as any).__farwind().mode === "");
  22  | }
  23  | async function open(page: Page, id: string, x: number, y: number) {
  24  |   if (id === "healer") await approachNpc(page, id);
  25  |   else await move(page, x, y);
  26  |   // NPC会移动，黑猫不是交谈前置条件；采集链仍单独检查伙伴跟随。
  27  |   if (id !== "healer")
  28  |     await expect
  29  |       .poll(async () => {
  30  |         const s = await read(page);
  31  |         return (
  32  |           !s.companion.blocked &&
  33  |           Math.hypot(
  34  |             s.companion.x - s.state.player.x,
  35  |             s.companion.y - s.state.player.y,
  36  |           ) < 120
  37  |         );
  38  |       })
  39  |       .toBe(true);
  40  |   await expect.poll(async () => (await read(page)).target).toBe(id);
  41  |   await page.keyboard.press("e");
  42  |   if (id === "healer")
  43  |     await page.getByRole("button", { name: "查看药师服务" }).click();
  44  |   await expect.poll(async () => (await read(page)).mode).toBe("shop");
  45  | }
  46  | async function confirm(page: Page, name: string) {
  47  |   await page.getByRole("button", { name: "核对交易" }).click();
  48  |   await page.getByRole("button", { name: `确认${name}`, exact: true }).click();
  49  |   await expect(page.locator("#shop-feedback")).toContainText(
  50  |     "交易已完成并保存",
  51  |   );
  52  | }
  53  | async function equip(page: Page, name: string) {
  54  |   await page.locator(".bag .slot").filter({ hasText: name }).first().click();
  55  |   await page.getByRole("button", { name: "穿戴选中装备" }).click();
  56  |   await expect(page.locator("#toast")).toContainText("装备已更新并保存");
  57  | }
  58  | test("新游戏真实采集和四服务路线、确认换药、买卖装备、教学桩增伤及重载", async ({
  59  |   page,
  60  | }) => {
  61  |   await mkdir(root, { recursive: true });
  62  |   const errors: string[] = [];
  63  |   page.on("pageerror", (e) => errors.push(e.message));
  64  |   await page.goto("/");
  65  |   await page.getByRole("button", { name: "启程 · 新游戏" }).click();
  66  |   await move(page, 670, 680);
  67  |   await page.keyboard.press("e");
  68  |   await page.keyboard.press("e");
  69  |   for (const [id, x, y] of [
  70  |     ["wood-v1", 270, 1150],
  71  |     ["wood-yard-1", 440, 1150],
  72  |     ["berry-v1", 350, 1410],
  73  |     ["herb-v1", 1180, 560],
  74  |   ] as const) {
  75  |     await move(page, x, y);
  76  |     await expect
  77  |       .poll(async () => {
  78  |         const s = await read(page);
  79  |         return (
  80  |           !s.companion.blocked &&
  81  |           Math.hypot(
  82  |             s.companion.x - s.state.player.x,
  83  |             s.companion.y - s.state.player.y,
  84  |           ) < 120
  85  |         );
  86  |       })
  87  |       .toBe(true);
  88  |     await expect.poll(async () => (await read(page)).target).toBe(id);
  89  |     await page.keyboard.press("e");
  90  |   }
  91  |   await move(page, 2170, 1080);
> 92  |   expect((await read(page)).state.quest).toBe(2);
      |                                          ^ Error: expect(received).toBe(expected) // Object.is equality
  93  |   await approachNpc(page, "healer");
  94  |   await page.keyboard.press("e");
  95  |   const before = (await read(page)).state;
  96  |   expect(before.crafted).toBe(false);
  97  |   await page.getByRole("button", { name: "查看药师服务" }).click();
  98  |   expect((await read(page)).state.bag).toEqual(before.bag);
  99  |   await page.getByRole("button", { name: "调制药剂" }).click();
  100 |   await confirm(page, "兑换");
  101 |   expect((await read(page)).state.quest).toBe(3);
  102 |   await page.screenshot({ path: `${root}/healer-confirmed.png` });
  103 |   await page.getByRole("button", { name: "离开商店" }).click();
  104 |   await open(page, "service-general", 930, 1220);
  105 |   await page.getByRole("button", { name: "出售材料" }).click();
  106 |   await page.getByLabel("物品", { exact: true }).selectOption("wood");
  107 |   await page.getByLabel("数量", { exact: true }).fill("4");
  108 |   await confirm(page, "出售");
  109 |   expect((await read(page)).state.coins).toBe(128);
  110 |   await page.getByRole("button", { name: "购买", exact: true }).click();
  111 |   await page.getByLabel("物品", { exact: true }).selectOption("potion");
  112 |   await confirm(page, "购买");
  113 |   expect((await read(page)).state.coins).toBe(110);
  114 |   await page.screenshot({ path: `${root}/general-service.png` });
  115 |   await page.getByRole("button", { name: "离开商店" }).click();
  116 |   await open(page, "service-smith", 1950, 1590);
  117 |   await page.getByLabel("物品", { exact: true }).selectOption("ironSword");
  118 |   await confirm(page, "购买");
  119 |   await page.getByLabel("物品", { exact: true }).selectOption("leatherCoat");
  120 |   await confirm(page, "购买");
  121 |   expect((await read(page)).state.coins).toBe(5);
  122 |   await page.screenshot({ path: `${root}/smith-service.png` });
  123 |   await page.getByRole("button", { name: "离开商店" }).click();
  124 |   await page.keyboard.press("Tab");
  125 |   await equip(page, "风杉铁剑");
  126 |   await equip(page, "旅人皮甲");
  127 |   await page.screenshot({ path: `${root}/equipment.png` });
  128 |   await page.getByRole("button", { name: "收好行囊" }).click();
  129 |   await open(page, "service-inn", 1630, 1650);
  130 |   await page.screenshot({ path: `${root}/inn-service.png` });
  131 |   await page.getByRole("button", { name: "离开商店" }).click();
  132 |   await move(page, 2030, 700);
  133 |   await expect
  134 |     .poll(async () => (await read(page)).target)
  135 |     .toBe("barracks-sign");
  136 |   await page.keyboard.press("e");
  137 |   await expect(page.locator("#modal")).toContainText("卫队驻地");
  138 |   await page.keyboard.press("e");
  139 |   await move(page, 850, 715);
  140 |   await page.keyboard.down("w");
  141 |   await page.waitForTimeout(35);
  142 |   await page.keyboard.up("w");
  143 |   await page.keyboard.press("j");
  144 |   await expect
  145 |     .poll(async () => (await read(page)).training.lastDamage)
  146 |     .toBe(STRIKES[0].damage + 4);
  147 |   await move(page, 930, 1220);
  148 |   await page.keyboard.press("Escape");
  149 |   await page.getByRole("button", { name: "保存旅途", exact: true }).click();
  150 |   await expect(page.locator("#toast")).toContainText("已保存");
  151 |   const saved = (await read(page)).state;
  152 |   await page.reload();
  153 |   await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  154 |   const restored = (await read(page)).state;
  155 |   expect(restored.coins).toBe(5);
  156 |   expect(restored.bag).toEqual(saved.bag);
  157 |   expect(restored.equipment).toEqual({
  158 |     weapon: "ironSword",
  159 |     armor: "leatherCoat",
  160 |   });
  161 |   expect(restored.quest).toBe(3);
  162 |   expect((await read(page)).companion.blocked).toBe(false);
  163 |   expect(errors).toEqual([]);
  164 |   await writeFile(
  165 |     `${root}/journey.json`,
  166 |     JSON.stringify(
  167 |       {
  168 |         说明: "本例新游戏开始，移动、采集、交易、装备及森林主线全部来自真实输入；没有修改运行状态。",
  169 |         交易后存档: saved,
  170 |         重载: restored,
  171 |         页面错误: errors,
  172 |       },
  173 |       null,
  174 |       2,
  175 |     ),
  176 |   );
  177 | });
  178 | test("商店实际负向检查、双击只成交一次以及窄屏可操作", async ({ page }) => {
  179 |   await page.goto("/");
  180 |   const s = initialState();
  181 |   s.player = { x: 930, y: 1220, hp: 100, stamina: 100 };
  182 |   s.coins = 18;
  183 |   await fixture(page, s);
  184 |   await open(page, "service-general", 930, 1220);
  185 |   await page.getByLabel("物品", { exact: true }).selectOption("potion");
  186 |   await page.getByLabel("数量", { exact: true }).fill("1.5");
  187 |   await page.getByRole("button", { name: "核对交易" }).click();
  188 |   await expect(page.locator("#shop-feedback")).toContainText("整数");
  189 |   expect((await read(page)).state.coins).toBe(18);
  190 |   await page.getByLabel("数量", { exact: true }).fill("1");
  191 |   await page.getByRole("button", { name: "核对交易" }).click();
  192 |   await page.getByRole("button", { name: "确认购买" }).click({ clickCount: 2 });
```