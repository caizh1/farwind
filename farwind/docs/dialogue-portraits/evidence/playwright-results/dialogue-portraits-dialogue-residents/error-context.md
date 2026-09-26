# 自动测试失败证据

以下保留当时的错误堆栈、页面快照与代码，便于复核首因；修复后的结果见本任务报告。

# 测试信息

- 名称： dialogue-portraits.spec.ts >> dialogue-residents
- 位置： tests/dialogue-portraits.spec.ts:41:1

# 错误详情

```
Error: expect(locator).toBeHidden() failed

Locator:  locator('#modal')
Expected: hidden
Received: visible
Timeout:  5000ms

Call log:
  - Expect "toBeHidden" locator('#modal') with timeout 5000ms
  - waiting for locator('#modal')
    14 × locator resolved to <div id="modal" class="story-modal">…</div>
       - unexpected value "visible"

```

```yaml
- dialog "木匠 · 阿禾":
  - img "木匠阿禾，草帽与黑发须，米色衬衣和棕色工作围裙"
  - banner
  - paragraph: 四份木材就够了，不必砍活着的树。
  - button "继续 · E": 继续
```

# 测试源码

```ts
  1   | import { test, expect, type Page } from "@playwright/test";
  2   | import { mkdir, writeFile } from "node:fs/promises";
  3   | import { move } from "./map-navigation";
  4   | 
  5   | const directory = "docs/dialogue-portraits/evidence";
  6   | const read = (page: Page) => page.evaluate(() => (window as any).__farwind());
  7   | 
  8   | async function layout(page: Page) {
  9   |   const bounds = await page.locator(".dialog-panel").evaluate(panel => {
  10  |     const rect = (element: Element | null) => {
  11  |       if (!element) return null;
  12  |       const r = element.getBoundingClientRect();
  13  |       return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
  14  |     };
  15  |     return {
  16  |       人物: rect(panel.querySelector(".dialogue-portrait")),
  17  |       正文: rect(panel.querySelector(".dialog-copy")),
  18  |       按钮: rect(panel.querySelector("#close"))!,
  19  |       面板: rect(panel)!,
  20  |       视口: { 宽: innerWidth, 高: innerHeight },
  21  |     };
  22  |   });
  23  |   expect(bounds.按钮.x).toBeGreaterThanOrEqual(0);
  24  |   expect(bounds.按钮.right).toBeLessThanOrEqual(bounds.视口.宽);
  25  |   expect(bounds.按钮.bottom).toBeLessThanOrEqual(bounds.视口.高);
  26  |   expect(bounds.面板.y).toBeGreaterThanOrEqual(0);
  27  |   if (bounds.人物) {
  28  |     expect(bounds.人物.right).toBeLessThanOrEqual(bounds.正文!.x);
  29  |     expect(bounds.人物.right).toBeLessThanOrEqual(bounds.按钮.x);
  30  |   }
  31  |   return bounds;
  32  | }
  33  | 
  34  | async function portrait(page: Page, id: string) {
  35  |   const image = page.locator(".dialogue-portrait img");
  36  |   await expect(image).toHaveAttribute("src", `/assets/portraits/${id}-neutral.webp`);
  37  |   await expect.poll(() => image.evaluate((im: HTMLImageElement) => im.naturalWidth)).toBe(768);
  38  |   return layout(page);
  39  | }
  40  | 
  41  | test("dialogue-residents", async ({ page }) => {
  42  |   await mkdir(directory, { recursive: true });
  43  |   const errors: string[] = [];
  44  |   page.on("pageerror", error => errors.push(error.message));
  45  |   const evidence: any[] = [];
  46  |   await page.setViewportSize({ width: 1368, height: 720 });
  47  |   await page.goto("/");
  48  |   await page.getByRole("button", { name: "启程 · 新游戏" }).click();
  49  |   await expect(page.locator("#modal")).toBeHidden();
  50  |   await move(page, 670, 690);
  51  |   await expect.poll(async () => (await read(page)).target).toBe("elder");
  52  |   await page.keyboard.press("e");
  53  |   await expect(page.locator("#dialog-title")).toHaveText("守风人 · 岚爷爷");
  54  |   evidence.push({ 角色: "岚爷爷", ...await portrait(page, "elder") });
  55  |   await page.screenshot({ path: `${directory}/elder-desktop.png` });
  56  |   const paused = await read(page);
  57  |   await page.keyboard.press("j"); await page.keyboard.press("k"); await page.keyboard.press("l");
  58  |   const portraitBox = await page.locator(".dialogue-portrait").boundingBox();
  59  |   await page.mouse.click(portraitBox!.x + portraitBox!.width / 2, portraitBox!.y + portraitBox!.height / 2);
  60  |   await page.waitForTimeout(200);
  61  |   expect((await read(page)).session.sim).toBe(paused.session.sim);
  62  |   await page.keyboard.press("e");
  63  |   await page.waitForTimeout(200);
  64  |   expect((await read(page)).attackSerial).toBe(paused.attackSerial);
  65  |   expect((await read(page)).state.player).toEqual(paused.state.player);
  66  |   expect((await read(page)).animation.hero.action).toBe("idle");
  67  |   await move(page, 1130, 610);
  68  |   await expect.poll(async () => (await read(page)).target).toBe("healer");
  69  |   await page.keyboard.press("e");
  70  |   await expect(page.locator("#dialog-title")).toHaveText("药师 · 小满");
  71  |   evidence.push({ 角色: "小满", ...await portrait(page, "healer") });
  72  |   await page.screenshot({ path: `${directory}/healer-desktop.png` });
  73  |   const healerState = (await read(page)).state;
  74  |   await page.keyboard.press("e");
  75  |   await page.keyboard.press("e");
  76  |   await expect(page.locator("#dialog-title")).toHaveText("药师 · 小满");
  77  |   expect((await read(page)).state.bag).toEqual(healerState.bag);
  78  |   for (const [name, width, height] of [["720", 1280, 720], ["short", 844, 390], ["narrow", 560, 720]] as const) {
  79  |     await page.setViewportSize({ width, height });
  80  |     evidence.push({ 角色: "小满", ...await portrait(page, "healer") });
  81  |     await page.screenshot({ path: `${directory}/healer-${name}.png` });
  82  |   }
  83  |   const beforeClick = (await read(page)).attackSerial;
  84  |   await page.getByRole("button", { name: "继续 · E" }).click();
  85  |   await page.waitForTimeout(200);
  86  |   expect((await read(page)).attackSerial).toBe(beforeClick);
  87  |   await page.setViewportSize({ width: 1368, height: 720 });
  88  |   await move(page, 330, 1040);
  89  |   await expect.poll(async () => (await read(page)).target).toBe("carpenter");
  90  |   await page.keyboard.press("e");
  91  |   await expect(page.locator("#dialog-title")).toHaveText("木匠 · 阿禾");
  92  |   evidence.push({ 角色: "阿禾", ...await portrait(page, "carpenter") });
  93  |   await page.screenshot({ path: `${directory}/carpenter-desktop.png` });
  94  |   expect((await read(page)).state.side).toBe(1);
  95  |   await page.keyboard.press("Escape");
  96  |   await page.keyboard.press("e");
  97  |   expect((await read(page)).state.side).toBe(1);
  98  |   await page.keyboard.press("e");
> 99  |   await expect(page.locator("#modal")).toBeHidden();
      |                                        ^ Error: expect(locator).toBeHidden() failed
  100 |   expect(errors).toEqual([]);
  101 |   await writeFile(`${directory}/runtime-report.json`, JSON.stringify({ 结果: "通过", 说明: "由新游戏实际键盘移动与交互完成，无任务状态注入", 截图布局: evidence, 页面错误: errors }, null, 2));
  102 | });
  103 | 
  104 | test("dialogue-sign-and-inscription", async ({ page }) => {
  105 |   await page.goto("/");
  106 |   await page.getByRole("button", { name: "启程 · 新游戏" }).click();
  107 |   await expect(page.locator("#modal")).toBeHidden();
  108 |   for (const [id, x, y, name] of [["training-guide", 1700, 700, "练习场须知"], ["village-guide", 1960, 1210, "东村口路牌"], ["clue", 3370, 870, "被风磨亮的碑文"]] as const) {
  109 |     await move(page, x, y);
  110 |     await expect.poll(async () => (await read(page)).target).toBe(id);
  111 |     await page.keyboard.press("e");
  112 |     await expect(page.locator("#dialog-title")).toHaveText(name);
  113 |     await expect(page.locator(".dialogue-portrait")).toHaveCount(0);
  114 |     await layout(page);
  115 |     await page.screenshot({ path: `${directory}/${id}-text.png` });
  116 |     await page.keyboard.press("e");
  117 |   }
  118 | });
  119 | 
  120 | test("dialogue-fallback-and-long-text", async ({ page }) => {
  121 |   await page.goto("/docs/dialogue-portraits/preview.html");
  122 |   for (const id of ["sign", "rune", "unknown", "__proto__"]) {
  123 |     await page.getByLabel("预览对象").selectOption(id);
  124 |     await expect(page.locator(".dialogue-portrait")).toHaveCount(0);
  125 |     await expect(page.locator("#dialog-text")).not.toBeEmpty();
  126 |     await layout(page);
  127 |   }
  128 |   await page.getByLabel("预览对象").selectOption("healer");
  129 |   await page.getByLabel("长台词").check();
  130 |   for (const [name, width, height] of [["narrow", 560, 720], ["short", 844, 390], ["tiny", 375, 280]] as const) {
  131 |     await page.setViewportSize({ width, height });
  132 |     await portrait(page, "healer");
  133 |     const text = page.locator("#dialog-text");
  134 |     const overflow = await text.evaluate(p => ({ 内容高: p.scrollHeight, 显示高: p.clientHeight, 字号: parseFloat(getComputedStyle(p).fontSize) }));
  135 |     expect(overflow.内容高).toBeGreaterThan(overflow.显示高);
  136 |     expect(overflow.显示高).toBeGreaterThan(25);
  137 |     expect(overflow.字号).toBeGreaterThanOrEqual(16);
  138 |     await text.hover(); await page.mouse.wheel(0, 10000);
  139 |     await expect.poll(() => text.evaluate(p => p.scrollTop + p.clientHeight >= p.scrollHeight - 2)).toBe(true);
  140 |     await page.screenshot({ path: `${directory}/long-${name}.png` });
  141 |   }
  142 |   await page.route("**/assets/portraits/healer-neutral.webp", route => route.fulfill({ status: 404, body: "测试：素材缺失" }));
  143 |   await page.reload();
  144 |   await expect(page.locator(".dialogue-portrait")).toHaveCount(0);
  145 |   await expect(page.locator(".dialog-panel")).not.toHaveClass(/dialog-panel--portrait/);
  146 |   await expect(page.locator("#dialog-title")).toHaveText("药师 · 小满");
  147 |   await layout(page);
  148 |   await page.screenshot({ path: `${directory}/missing-portrait.png` });
  149 |   await page.getByRole("button", { name: "继续 · E" }).click();
  150 |   await expect(page.locator("#modal")).toBeHidden();
  151 | });
  152 | 
  153 | test("dialogue-late-image-failure", async ({ page }) => {
  154 |   let release!: () => void;
  155 |   const pending = new Promise<void>(resolve => { release = resolve; });
  156 |   await page.route("**/assets/portraits/healer-neutral.webp", async route => {
  157 |     await pending;
  158 |     await route.fulfill({ status: 404, body: "测试：旧立绘请求延迟失败" });
  159 |   });
  160 |   await page.goto("/docs/dialogue-portraits/preview.html", { waitUntil: "domcontentloaded" });
  161 |   await expect(page.locator("#dialog-title")).toHaveText("药师 · 小满");
  162 |   await page.getByLabel("预览对象").selectOption("elder");
  163 |   await portrait(page, "elder");
  164 |   release();
  165 |   await page.waitForTimeout(200);
  166 |   await portrait(page, "elder");
  167 |   await expect(page.locator("#dialog-title")).toHaveText("守风人 · 岚爷爷");
  168 | });
  169 | 
```