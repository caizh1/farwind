import { test, expect, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { initialState, type State } from "../src/game/systems/state";
import { type WindGiftId } from "../src/game/systems/windGifts";

const evidence = "docs/wind-gifts-redesign";
const receipt = "风赐界面固定样本";
const read = (page: Page): Promise<{ state: State; mode: string }> =>
  page.evaluate(() => (window as any).__farwind());

for (const [quality, lead] of [
  ["normal", 150],
  ["perfect", 55],
] as const)
  test(`真实林豕接触触发回锋：${quality === "normal" ? "普通弹反" : "完美弹反"}`, async ({
    page,
  }) => {
    test.setTimeout(45000);
    // 固定样本表示已发现但未击败的林豕遭遇，避免未发现敌人的近距离刷新保护；攻击时钟及弹反结果均由正式世界生成。
    const state = initialState();
    Object.assign(state.player, { x: 3280, y: 340 });
    state.windGifts.held = [
      { id: "riposte", level: 1 },
      { id: "armor", level: 100 },
    ];
    state.encounters.groups["east-spring-boar"].activated = true;
    page.once("dialog", (dialog) => dialog.accept());
    await page.goto("/");
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "导入存档", exact: true }).click();
    await (
      await chooser
    ).setFiles({
      name: "wind-gifts-combat-sample.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(state)),
    });
    await page.waitForFunction(() => (window as any).__farwind?.().mode === "");
    await page.keyboard.down("a");
    await page.waitForFunction(
      () => (window as any).__farwind().animation.hero.direction === 2,
    );
    await page.keyboard.up("a");
    await page.waitForFunction(
      (lead) => {
        const s = (window as any).__farwind();
        return s.warnings.some(
          (w: any) =>
            w.id.startsWith("boar-1:") && w.lead <= lead && w.lead > lead - 35,
        );
      },
      lead,
      { polling: 5 },
    );
    await page.keyboard.press("k");
    await page.waitForFunction(
      () =>
        (window as any)
          .__farwind()
          .runes.effects.some((f: any) => f.visual === "wind-gift-fan"),
      null,
      { polling: 5 },
    );
    const game = await page.evaluate(() => (window as any).__farwind());
    const contact = game.contacts.find(
      (c: any) =>
        c.id.startsWith("boar-1:") &&
        (c.result === "normal" || c.result === "perfect"),
    );
    expect(contact?.result).toBe(quality);
    const fan = game.runes.events.filter((e: any) =>
      e.tags.includes("riposte_fan"),
    );
    expect(fan.length).toBeGreaterThan(0);
    expect(
      fan.every(
        (e: any) =>
          e.sourceKind !== "native" && Math.abs(e.amount - 7.2) < 1e-6,
      ),
    ).toBe(true);
    await mkdir(evidence, { recursive: true });
    await page.screenshot({ path: `${evidence}/riposte-${quality}.png` });
    await page.waitForTimeout(300);
    const settled = await page.evaluate(() => (window as any).__farwind());
    expect(
      settled.runes.events.filter((e: any) => e.tags.includes("riposte_fan")),
    ).toHaveLength(fan.length);
    const native = settled.runes.events.find(
      (e: any) => e.sourceKind === "native" && e.targetId === "boar-1",
    );
    expect(native?.amount).toBeCloseTo(quality === "normal" ? 28.8 : 36);
    await writeFile(
      `${evidence}/riposte-${quality}.json`,
      JSON.stringify(
        {
          说明: "隔离浏览器导入已发现但未击败的林豕遭遇固定存档；真实按键弹反，未修改敌人生命、攻击时钟或命中结果。只读预测时间辅助起按，属于精确集成验证，不作为玩家手感验收。",
          弹反结果: quality === "normal" ? "普通弹反" : "完美弹反",
          剑气命中数: fan.length,
          剑气伤害: fan.map((e: any) => e.amount),
          近战伤害: native.amount,
          重复释放: false,
        },
        null,
        2,
      ),
    );
  });

async function openSample(
  page: Page,
  held: State["windGifts"]["held"] = [],
  candidates: WindGiftId[] = ["potion", "armor", "riposte"],
) {
  // 独立浏览器中导入固定界面样本，只验收布局及正式领取事务，不作为键鼠通关证据。
  const state = initialState();
  state.windGifts = {
    held,
    pending: [{ receipt, candidates }],
    receipts: [receipt],
    cooldowns: { shock: 0, chain: 0 },
  };
  page.once("dialog", (dialog) => dialog.accept());
  await page.goto("/");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "导入存档", exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: "wind-gifts-sample.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(state)),
  });
  await page.waitForFunction(() => (window as any).__farwind?.().mode === "");
  await page.keyboard.press("q", { delay: 80 });
  await page.locator("#journal-wind-gifts").click();
  await expect(page.locator(".gift-card")).toHaveCount(3);
  await mkdir(evidence, { recursive: true });
}

test("桌面及窄屏无溢出，稍后领取保持候选，真实选择经保存后可重载", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openSample(page);
  for (const [width, height] of [
    [1440, 900],
    [1075, 600],
    [768, 600],
    [640, 720],
    [390, 844],
    [320, 640],
  ]) {
    await page.setViewportSize({ width, height });
    await expect(page.locator('[data-gift="potion"]')).toBeEnabled();
    expect(
      await page
        .locator(".gift-panel")
        .evaluate((e) => e.scrollWidth <= e.clientWidth),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width > 700)
      expect(
        await page
          .locator(".gift-choices button")
          .evaluateAll((buttons) =>
            buttons.every(
              (button) =>
                button.getBoundingClientRect().bottom <=
                button.closest(".gift-panel")!.getBoundingClientRect().bottom,
            ),
          ),
      ).toBe(true);
    expect(
      await page.locator(".gift-card").evaluateAll((cards) =>
        cards.every((card) => {
          const box = card.getBoundingClientRect();
          return [...card.querySelectorAll("svg,button")].every((e) => {
            const r = e.getBoundingClientRect();
            return (
              r.left >= box.left &&
              r.right <= box.right &&
              getComputedStyle(e).position !== "absolute"
            );
          });
        }),
      ),
    ).toBe(true);
    await page.screenshot({ path: `${evidence}/reward-${width}.png` });
  }
  await page.locator("#gift-close").click();
  expect((await read(page)).state.windGifts.pending[0].candidates).toEqual([
    "potion",
    "armor",
    "riposte",
  ]);
  await page.keyboard.press("q", { delay: 80 });
  await page.locator("#journal-wind-gifts").click();
  await page.locator('[data-gift="potion"]').click();
  await expect(page.locator("#gift-feedback")).toContainText("已保存并生效");
  expect((await read(page)).state.windGifts.held).toEqual([
    { id: "potion", level: 1 },
  ]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: `${evidence}/owned-saved.png` });
  await page.reload();
  await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  await page.waitForFunction(() => (window as any).__farwind?.().mode === "");
  expect((await read(page)).state.windGifts.held).toEqual([
    { id: "potion", level: 1 },
  ]);
  expect((await read(page)).state.windGifts.pending).toEqual([]);
  expect(errors).toEqual([]);
});

test("升级展示总收益，持有列表展示二级实际效果", async ({ page }) => {
  await openSample(page, [{ id: "potion", level: 1 }]);
  await expect(
    page.locator(".gift-card").first().locator(".gift-stat strong"),
  ).toHaveText("+30%");
  await expect(
    page.locator(".gift-card").first().locator(".gift-growth"),
  ).toContainText("当前 +15% → 升级后 +30%");
  await page.screenshot({ path: `${evidence}/upgrade.png` });
  await page.locator('[data-gift="potion"]').click();
  await expect(page.locator(".gift-owned .gift-held")).toContainText("恢复药剂治疗量 +30%");
  await expect(page.locator(".gift-preview")).toHaveAttribute("open", "");
  await expect(page.locator("#gift-demo-title")).toHaveText("添药 · 2级效果");
  await expect(page.locator("#gift-visual-description")).toContainText("+30%");
  expect((await read(page)).state.windGifts.held).toEqual([
    { id: "potion", level: 2 },
  ]);
});

test("超过六项无需替换，高等级继续升级并保存", async ({ page }) => {
  const held: State["windGifts"]["held"] = [
    "blade",
    "gale",
    "shock",
    "chain",
    "stride",
    "thrift",
    "armor",
  ].map((id) => ({ id: id as WindGiftId, level: 12 }));
  await openSample(page, held);
  await expect(page.locator("[data-replace]")).toHaveCount(0);
  await expect(page.locator(".gift-owned-title")).toContainText("7");
  await expect(
    page.locator(".gift-card").nth(1).locator(".gift-level"),
  ).toHaveText("12 → 13级");
  await expect(
    page.locator(".gift-card").nth(1).locator(".gift-stat strong"),
  ).toHaveText("−13%");
  await page.screenshot({ path: `${evidence}/uncapped-upgrade.png` });
  await page.locator('[data-gift="armor"]').click();
  await expect(page.locator("#gift-feedback")).toContainText("已保存并生效");
  expect(
    (await read(page)).state.windGifts.held.find((g) => g.id === "armor")
      ?.level,
  ).toBe(13);
  await page.screenshot({ path: `${evidence}/uncapped-owned.png` });
  await page.reload();
  await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  await page.waitForFunction(() => (window as any).__farwind?.().mode === "");
  expect(
    (await read(page)).state.windGifts.held.find((g) => g.id === "armor")
      ?.level,
  ).toBe(13);
  await openSample(page, held);
  await page.setViewportSize({ width: 320, height: 640 });
  expect(
    await page
      .locator(".gift-panel")
      .evaluate((e) => e.scrollWidth <= e.clientWidth),
  ).toBe(true);
  await page.locator('[data-gift="potion"]').click();
  await expect(page.locator("#gift-feedback")).toContainText("已保存并生效");
  const gifts = (await read(page)).state.windGifts;
  expect(gifts.held).toHaveLength(8);
  expect(gifts.held.find((g) => g.id === "potion")?.level).toBe(1);
  expect(gifts.held.find((g) => g.id === "blade")?.level).toBe(12);
});
