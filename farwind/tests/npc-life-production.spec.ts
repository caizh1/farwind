import { test, expect } from "@playwright/test";
import { initialState } from "../src/game/systems/state";
import { NpcLife } from "../src/game/systems/npcLife";
import { EastDefense } from "../src/game/systems/defense";
import { FACILITIES } from "../src/data/npcLife";
import { approachNpc } from "./npc-navigation";
const read = (page: any) => page.evaluate(() => (window as any).__farwind());
test("正式构建：旧档迁移、动态药房交谈、原服务与隐藏调试", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const old: any = initialState();
  old.schema_version = 5;
  delete old.life;
  old.time = 600;
  old.player.x = 1110;
  old.player.y = 460;
  old.defense.guards[2].dead = true;
  old.defense.guards[2].hp = 0;
  old.defense.guards[2].mode = "dead";
  await page.goto("/?npcDebug=1");
  page.once("dialog", (d) => d.accept());
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "导入存档" }).click();
  await (
    await chooser
  ).setFiles({
    name: "npc-production-old.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(old)),
  });
  await page.waitForFunction(() => (window as any).__farwind?.().mode === "");
  expect(
    await page.getByRole("button", { name: "NPC 调试", exact: true }).count(),
  ).toBe(0);
  expect((await read(page)).state.schema_version).toBe(6);
  expect((await read(page)).state.defense.guards[2].dead).toBe(true);
  await page.waitForFunction(
    () =>
      (window as any).__farwind().state.life.people[1].body.space ===
      "healer-home",
  );
  await approachNpc(page, "healer");
  await page.keyboard.press("e");
  await expect(page.locator("#dialog-title")).toContainText("小满");
  const bag = (await read(page)).state.bag;
  await page.getByRole("button", { name: "查看药师服务" }).click();
  await expect(page.locator("#shop-feedback")).toBeVisible();
  expect((await read(page)).state.bag).toEqual(bag);
  await page.getByRole("button", { name: "离开商店" }).click();
  await page.screenshot({
    path: "docs/npc-life/evidence/production-pharmacy.png",
  });
  expect(errors).toEqual([]);
});

test("正式构建：生活子版本2的配药旧档显示事实短句，存取后不重复闲聊", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const old: any = initialState();
  old.time = 540;
  old.life.playerSpace = "healer-home";
  Object.assign(old.player, { x: 830, y: 845 });
  const life = new NpcLife(old, new EastDefense(old.defense, 0)),
    healer = old.life.people[1];
  Object.assign(
    healer.body,
    FACILITIES.find((f) => f.id === "pharmacy")!.place,
  );
  healer.gear = "carried";
  life.begin(
    healer,
    life.candidates(healer).find((c) => c.facility === "pharmacy")!,
  );
  healer.action.phase = "perform";
  old.life.version = 2;
  delete old.life.speechAt;
  delete old.life.speechUrgentAt;
  delete old.life.speechEventFloor;
  for (const n of old.life.people) {
    delete n.speech;
    delete n.supplies;
  }
  await page.goto("/?npcDebug=1");
  page.once("dialog", (d) => d.accept());
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "导入存档" }).click();
  await (
    await chooser
  ).setFiles({
    name: "npc-life-v2-work.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(old)),
  });
  await page.waitForFunction(() => {
    const r = (window as any).__farwind?.();
    return (
      r?.mode === "" &&
      r.npcLife.speech?.text.includes("药还在配") &&
      r.npcLife.speech.until > r.state.life.elapsed
    );
  });
  const before = await read(page);
  expect(before.state.life.version).toBe(3);
  expect(before.state.life.people[1].speech.routines).toContain("work");
  expect(before.state.life.stores).toEqual(old.life.stores);
  expect(before.state.bag).toEqual(old.bag);
  expect(
    await page.getByRole("button", { name: "NPC 调试", exact: true }).count(),
  ).toBe(0);
  await page.screenshot({
    path: "docs/npc-life/evidence/production-work-speech.png",
  });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "保存旅途", exact: true }).click();
  await expect(page.locator("#toast")).toContainText("已保存");
  await page.reload();
  await page.getByRole("button", { name: "继续旅途" }).click();
  await page.waitForFunction(() => (window as any).__farwind?.().mode === "");
  expect((await read(page)).npcLife.speech).toBeNull();
  expect((await read(page)).state.life.people[1].speech.routines).toContain(
    "work",
  );
  expect(errors).toEqual([]);
});

test("正式构建：原旅馆补给与独立客房侧门分别可用", async ({ page }) => {
  const old: any = initialState();
  old.schema_version = 5;
  delete old.life;
  old.player = { x: 1630, y: 1650, hp: 45, stamina: 22 };
  await page.goto("/");
  page.once("dialog", (d) => d.accept());
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "导入存档" }).click();
  await (
    await chooser
  ).setFiles({
    name: "inn-old-service.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(old)),
  });
  await page.waitForFunction(() => (window as any).__farwind?.().mode === "");
  await expect.poll(async () => (await read(page)).target).toBe("service-inn");
  await page.keyboard.press("e");
  await page.getByRole("button", { name: "核对交易" }).click();
  const before = (await read(page)).state;
  await page.getByRole("button", { name: "确认休息", exact: true }).click();
  await expect(page.locator("#shop-feedback")).toContainText(
    "交易已完成并保存",
  );
  const paid = (await read(page)).state;
  expect([paid.coins, paid.player.hp, paid.player.stamina, paid.time]).toEqual([
    before.coins - 12,
    100,
    100,
    before.time,
  ]);
  expect(paid.bag).toEqual(before.bag);
  await page.getByRole("button", { name: "离开商店" }).click();
  await page.keyboard.down("a");
  await page.waitForFunction(
    () => (window as any).__farwind().state.player.x < 1554,
  );
  await page.keyboard.up("a");
  await expect
    .poll(async () => (await read(page)).target)
    .toBe("life-door:inn");
  await page.keyboard.press("e");
  await page.waitForFunction(
    () => (window as any).__farwind().state.life.playerSpace === "inn",
  );
  expect((await read(page)).state.life.version).toBe(3);
  await page.screenshot({ path: "docs/npc-life/evidence/production-inn.png" });
  const sequence = (await read(page)).state.defense.sequence;
  await page.keyboard.press("e");
  await page.waitForFunction(
    () => (window as any).__farwind().state.life.playerSpace === "village",
  );
  expect((await read(page)).state.defense.sequence).toBe(sequence);
});
