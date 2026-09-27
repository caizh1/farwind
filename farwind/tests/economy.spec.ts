import { approachNpc } from "./safety-npc-navigation";
import { test, expect, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { move } from "./map-navigation";
import { initialState, add } from "../src/game/systems/state";
import { STRIKES } from "../src/game/systems/combat";
const root =
  process.env.FARWIND_EVIDENCE_ROOT ?? "docs/village-defense/m2/evidence";
const read = (p: Page) => p.evaluate(() => (window as any).__farwind());
async function fixture(page: Page, state = initialState()) {
  page.once("dialog", (d) => d.accept());
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "导入存档", exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: "economy-fixture.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(state)),
  });
  await page.waitForFunction(() => (window as any).__farwind().mode === "");
}
async function open(page: Page, id: string, x: number, y: number) {
  if (id === "healer") await approachNpc(page, id);
  else await move(page, x, y);
  // NPC会移动，黑猫不是交谈前置条件；采集链仍单独检查伙伴跟随。
  if (id !== "healer")
    await expect
      .poll(async () => {
        const s = await read(page);
        return (
          !s.companion.blocked &&
          Math.hypot(
            s.companion.x - s.state.player.x,
            s.companion.y - s.state.player.y,
          ) < 120
        );
      })
      .toBe(true);
  await expect.poll(async () => (await read(page)).target).toBe(id);
  await page.keyboard.press("e");
  if (id === "healer")
    await page.getByRole("button", { name: "查看药师服务" }).click();
  await expect.poll(async () => (await read(page)).mode).toBe("shop");
}
async function confirm(page: Page, name: string) {
  await page.getByRole("button", { name: "核对交易" }).click();
  await page.getByRole("button", { name: `确认${name}`, exact: true }).click();
  await expect(page.locator("#shop-feedback")).toContainText(
    "交易已完成并保存",
  );
}
async function equip(page: Page, name: string) {
  await page.locator(".bag .slot").filter({ hasText: name }).first().click();
  await page.getByRole("button", { name: "穿戴选中装备" }).click();
  await expect(page.locator("#toast")).toContainText("装备已更新并保存");
}
test("新游戏真实采集和四服务路线、确认换药、买卖装备、教学桩增伤及重载", async ({
  page,
}) => {
  await mkdir(root, { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "启程 · 新游戏" }).click();
  await move(page, 670, 680);
  await page.keyboard.press("e");
  await page.keyboard.press("e");
  for (const [id, x, y] of [
    ["wood-v1", 270, 1150],
    ["wood-yard-1", 440, 1150],
    ["berry-v1", 350, 1410],
    ["herb-v1", 1180, 560],
  ] as const) {
    await move(page, x, y);
    await expect
      .poll(async () => {
        const s = await read(page);
        return (
          !s.companion.blocked &&
          Math.hypot(
            s.companion.x - s.state.player.x,
            s.companion.y - s.state.player.y,
          ) < 120
        );
      })
      .toBe(true);
    await expect.poll(async () => (await read(page)).target).toBe(id);
    await page.keyboard.press("e");
  }
  await move(page, 2170, 1080);
  expect((await read(page)).state.quest).toBe(1);
  await move(page, 2300, 1080);
  if((await read(page)).mode==="dialog")await page.getByRole("button",{name:"继续 · E",exact:true}).click();
  expect((await read(page)).state.quest).toBe(2);
  await approachNpc(page, "healer");
  await page.keyboard.press("e");
  const before = (await read(page)).state;
  expect(before.crafted).toBe(false);
  await page.getByRole("button", { name: "查看药师服务" }).click();
  expect((await read(page)).state.bag).toEqual(before.bag);
  await page.getByRole("button", { name: "调制药剂" }).click();
  await confirm(page, "兑换");
  expect((await read(page)).state.quest).toBe(3);
  await page.screenshot({ path: `${root}/healer-confirmed.png` });
  await page.getByRole("button", { name: "离开商店" }).click();
  await open(page, "service-general", 930, 1220);
  await page.getByRole("button", { name: "出售材料" }).click();
  await page.getByLabel("物品", { exact: true }).selectOption("wood");
  await page.getByLabel("数量", { exact: true }).fill("4");
  await confirm(page, "出售");
  expect((await read(page)).state.coins).toBe(128);
  await page.getByRole("button", { name: "购买", exact: true }).click();
  await page.getByLabel("物品", { exact: true }).selectOption("potion");
  await confirm(page, "购买");
  expect((await read(page)).state.coins).toBe(110);
  await page.screenshot({ path: `${root}/general-service.png` });
  await page.getByRole("button", { name: "离开商店" }).click();
  await open(page, "service-smith", 1950, 1590);
  await page.getByLabel("物品", { exact: true }).selectOption("ironSword");
  await confirm(page, "购买");
  await page.getByLabel("物品", { exact: true }).selectOption("leatherCoat");
  await confirm(page, "购买");
  expect((await read(page)).state.coins).toBe(5);
  await page.screenshot({ path: `${root}/smith-service.png` });
  await page.getByRole("button", { name: "离开商店" }).click();
  await page.keyboard.press("Tab");
  await equip(page, "风杉铁剑");
  await equip(page, "旅人皮甲");
  await page.screenshot({ path: `${root}/equipment.png` });
  await page.getByRole("button", { name: "收好行囊" }).click();
  await open(page, "service-inn", 1630, 1650);
  await page.screenshot({ path: `${root}/inn-service.png` });
  await page.getByRole("button", { name: "离开商店" }).click();
  await move(page, 2030, 700);
  await expect
    .poll(async () => (await read(page)).target)
    .toBe("barracks-sign");
  await page.keyboard.press("e");
  await expect(page.locator("#modal")).toContainText("卫队驻地");
  await page.keyboard.press("e");
  await move(page, 850, 715);
  await page.keyboard.down("w");
  await page.waitForTimeout(35);
  await page.keyboard.up("w");
  await page.keyboard.press("j");
  await expect
    .poll(async () => (await read(page)).training.lastDamage)
    .toBe(STRIKES[0].damage + 4);
  await move(page, 930, 1220);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "保存旅途", exact: true }).click();
  await expect(page.locator("#toast")).toContainText("已保存");
  const saved = (await read(page)).state;
  await page.reload();
  await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  const restored = (await read(page)).state;
  expect(restored.coins).toBe(5);
  expect(restored.bag).toEqual(saved.bag);
  expect(restored.equipment).toEqual({
    weapon: "ironSword",
    armor: "leatherCoat",
  });
  expect(restored.quest).toBe(3);
  expect((await read(page)).companion.blocked).toBe(false);
  expect(errors).toEqual([]);
  await writeFile(
    `${root}/journey.json`,
    JSON.stringify(
      {
        说明: "本例新游戏开始，移动、采集、交易、装备及森林主线全部来自真实输入；没有修改运行状态。",
        交易后存档: saved,
        重载: restored,
        页面错误: errors,
      },
      null,
      2,
    ),
  );
});
test("商店实际负向检查、双击只成交一次以及窄屏可操作", async ({ page }) => {
  await page.goto("/");
  const s = initialState();
  s.player = { x: 930, y: 1220, hp: 100, stamina: 100 };
  s.coins = 18;
  await fixture(page, s);
  await open(page, "service-general", 930, 1220);
  await page.getByLabel("物品", { exact: true }).selectOption("potion");
  await page.getByLabel("数量", { exact: true }).fill("1.5");
  await page.getByRole("button", { name: "核对交易" }).click();
  await expect(page.locator("#shop-feedback")).toContainText("整数");
  expect((await read(page)).state.coins).toBe(18);
  await page.getByLabel("数量", { exact: true }).fill("1");
  await page.getByRole("button", { name: "核对交易" }).click();
  await page.getByRole("button", { name: "确认购买" }).click({ clickCount: 2 });
  await expect
    .poll(async () => (await read(page)).state.economyRevision)
    .toBe(1);
  expect((await read(page)).state.coins).toBe(0);
  if (await page.locator("#shop-back").count())
    await page.getByRole("button", { name: "重新选择" }).click();
  await confirmFailure(page, "铜币不足");
  for (const [width, height] of [
    [560, 720],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    const box = await page.locator("#close").boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    await page.locator("#close").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${root}/shop-${width}.png` });
  }
});
async function confirmFailure(page: Page, text: string) {
  await page.getByRole("button", { name: "核对交易" }).click();
  await page.getByRole("button", { name: "确认购买" }).click();
  await expect(page.locator("#shop-feedback")).toContainText(text);
}
test("满包不能购买，药师材料不足不消耗，旅馆确认收费不推进时间", async ({
  page,
}) => {
  await page.goto("/");
  const s = initialState();
  s.player = { x: 930, y: 1220, hp: 45, stamina: 22 };
  s.bag = Array.from({ length: 24 }, () => ({ id: "wood", count: 20 }));
  await fixture(page, s);
  await open(page, "service-general", 930, 1220);
  await page.getByLabel("物品", { exact: true }).selectOption("potion");
  const original = (await read(page)).state;
  await confirmFailure(page, "行囊空间不足");
  expect((await read(page)).state.bag).toEqual(original.bag);
  expect((await read(page)).state.coins).toBe(120);
  await page.keyboard.press("Escape");
  await open(page, "healer", 1110, 600);
  await page.getByRole("button", { name: "调制药剂" }).click();
  await page.getByRole("button", { name: "核对交易" }).click();
  await page.getByRole("button", { name: "确认兑换" }).click();
  await expect(page.locator("#shop-feedback")).toContainText("需要药草");
  await page.keyboard.press("Escape");
  await open(page, "service-inn", 1630, 1650);
  const before = (await read(page)).state;
  await confirm(page, "休息");
  const after = (await read(page)).state;
  expect([
    after.coins,
    after.player.hp,
    after.player.stamina,
    after.time,
  ]).toEqual([108, 100, 100, before.time]);
  expect(after.bag).toEqual(before.bag);
  await page.screenshot({ path: `${root}/inn-paid.png` });
  await page.keyboard.press("Escape");
  await page.reload();
  await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  expect((await read(page)).state.coins).toBe(108);
});
test("IDB写请求成功后事务中止，钱物库存与上次有效档完全保留", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      const r = put.call(this, value, key);
      if (value.economyRevision > 0)
        r.addEventListener("success", () => this.transaction.abort(), {
          once: true,
        });
      return r;
    };
  });
  await page.goto("/");
  const s = initialState();
  s.player.x = 930;
  s.player.y = 1220;
  await fixture(page, s);
  await open(page, "service-general", 930, 1220);
  await page.getByLabel("物品", { exact: true }).selectOption("potion");
  const before = (await read(page)).state;
  await confirmFailure(page, "上一份有效存档仍保留");
  expect((await read(page)).state).toEqual(before);
  await page.screenshot({ path: `${root}/transaction-aborted.png` });
  await page.keyboard.press("Escape");
  await page.reload();
  await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  const after = (await read(page)).state;
  expect([
    after.coins,
    after.economyRevision,
    after.shopStock,
    after.bag,
  ]).toEqual([before.coins, 0, before.shopStock, before.bag]);
});
test("交易待保存时不能Esc关闭，世界和输入全部暂停", async ({ page }) => {
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      const r = put.call(this, value, key);
      if (value.economyRevision > 0) {
        const deadline = performance.now() + 1200;
        r.addEventListener(
          "success",
          () => {
            const keep = () => {
              const read = this.get("current");
              read.addEventListener("success", () => {
                if (performance.now() < deadline) keep();
              });
            };
            keep();
          },
          { once: true },
        );
      }
      return r;
    };
  });
  await page.goto("/");
  const s = initialState();
  s.player.x = 930;
  s.player.y = 1220;
  await fixture(page, s);
  await open(page, "service-general", 930, 1220);
  await page.getByLabel("物品", { exact: true }).selectOption("potion");
  await page.getByRole("button", { name: "核对交易" }).click();
  const before = await read(page);
  await page.getByRole("button", { name: "确认购买" }).click();
  await expect(page.locator("#close")).toBeDisabled();
  await page.keyboard.press("Escape");
  await page.keyboard.press("j");
  await page.keyboard.press("l");
  await page.keyboard.press("k");
  await page.keyboard.press("Tab");
  const pending = await read(page);
  expect(pending.mode).toBe("shop");
  expect(pending.state.coins).toBe(120);
  expect(pending.state.time).toBe(before.state.time);
  expect(pending.session.sim).toBe(before.session.sim);
  expect(pending.attackSerial).toBe(before.attackSerial);
  await expect(page.locator("#shop-feedback")).toContainText("交易已完成");
  expect((await read(page)).state.coins).toBe(102);
});

test("正式森林战斗实际扣血及铁剑增伤，默认战斗数值保持", async ({ page }) => {
  await page.goto("/");
  const records: any[] = [];
  for (const armor of [false, true]) {
    const s = initialState();
    s.player.x = 2390;
    s.player.y = 1060;
    if (armor) s.equipment = { weapon: "ironSword", armor: "leatherCoat" };
    await fixture(page, s);
    await expect
      .poll(async () => (await read(page)).state.player.hp, { timeout: 12000 })
      .toBe(armor ? 93 : 90);
    const contact = (await read(page)).contacts.find(
      (c: any) => c.result === "hurt",
    );
    expect(contact.hp).toBe(armor ? 93 : 90);
    await page.keyboard.down("d");
    await page.waitForTimeout(30);
    await page.keyboard.up("d");
    await page.keyboard.press("j");
    await expect
      .poll(
        async () =>
          (await read(page)).enemies.find((e: any) => e.id === "slime-1").hp,
      )
      .toBe(armor ? 26 : 30);
    const actual = await read(page);
    records.push({
      装备: armor,
      主角生命: contact.hp,
      史莱姆剩余生命: actual.enemies.find((e: any) => e.id === "slime-1").hp,
    });
    await page.screenshot({
      path: `${root}/combat-${armor ? "equipped" : "default"}.png`,
    });
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "保存并返回标题" }).click();
  }
  await writeFile(
    `${root}/combat.json`,
    JSON.stringify(
      {
        说明: "夹具只建立装备前提与站位，正式敌人AI、接触伤害和单次J攻击产生实际结果。",
        样本: records,
      },
      null,
      2,
    ),
  );
});

test("真实导入旧结构和旧建筑站位，恢复后钱和坐标不重复迁移", async ({
  page,
}) => {
  await page.goto("/");
  const old: any = initialState();
  old.schema_version = 1;
  old.map_version = 3;
  for (const key of ["coins", "equipment", "shopStock", "economyRevision"])
    delete old[key];
  old.player.x = 930;
  old.player.y = 1100;
  old.quest = 3;
  old.crafted = true;
  add(old, "wood", 4);
  await fixture(page, old);
  let restored = (await read(page)).state;
  expect([
    restored.schema_version,
    restored.map_version,
    restored.coins,
    restored.quest,
  ]).toEqual([6, 6, 120, 3]);
  expect(restored.bag).toEqual(old.bag);
  expect(
    Math.hypot(restored.player.x - 930, restored.player.y - 1100),
  ).toBeLessThan(160);
  expect(restored.player.x).toBeLessThan(2100);
  // 恢复点贴近建筑边界；先真实向外走，避免测试寻路的额外6像素裕量误判起点。
  await page.keyboard.down("s");
  try {
    await page.waitForFunction(
      () => (window as any).__farwind().state.player.y > 1158,
    );
  } finally {
    await page.keyboard.up("s");
  }
  await open(page, "service-general", 930, 1220);
  await page.getByLabel("物品", { exact: true }).selectOption("wood");
  await confirm(page, "购买");
  expect((await read(page)).state.coins).toBe(117);
  await page.keyboard.press("Escape");
  await page.reload();
  await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  restored = (await read(page)).state;
  expect([
    restored.coins,
    restored.map_version,
    restored.economyRevision,
    restored.quest,
  ]).toEqual([117, 6, 1, 3]);
  await page.screenshot({ path: `${root}/legacy-migrated.png` });
});
