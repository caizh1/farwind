import { test, expect } from "@playwright/test";
import { initialState } from "../src/game/systems/state";
import { NpcLife } from "../src/game/systems/npcLife";
import { EastDefense } from "../src/game/systems/defense";
import { FACILITIES } from "../src/data/npcLife";
import { approachNpc } from "./npc-navigation";
import { encounterState } from "./npc-combat-fixtures";
import { move } from "./map-navigation";
import { writeFileSync } from "node:fs";
const read = (page: any) => page.evaluate(() => (window as any).__farwind());
test("正式构建：真实轻伤高于旧阈值仍被小满到场救治，挥剑不伤友方", async ({
  page,
}) => {
  test.setTimeout(100000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const state = encounterState();
  // 玩家从可通行的近处接应，固定一击轻伤样本；更晚到场可能产生新的真实敌伤。
  Object.assign(state.player, { x: 830, y: 600 });
  await page.goto("/?npcDebug=1");
  page.once("dialog", (d) => d.accept());
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "导入存档" }).click();
  await (
    await chooser
  ).setFiles({
    name: "civilian-minor-encounter.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(state)),
  });
  await page.waitForFunction(() => (window as any).__farwind?.().mode === "");
  expect(
    await page.getByRole("button", { name: "NPC 调试", exact: true }).count(),
  ).toBe(0);
  await page.waitForFunction(
    () =>
      (window as any).__farwind().state.life.people[0].body.health === "hurt",
  );
  const wounded = await read(page);
  expect(wounded.state.life.people[0].body.hp).toBe(90);
  await move(page, 850, 600);
  for (
    let i = 0;
    i < 10 && (await read(page)).defense.enemies.some((e: any) => e.hp > 0);
    i++
  ) {
    const s = await read(page),
      enemy = s.defense.enemies.find((e: any) => e.hp > 0),
      hero = s.state.player,
      dx = enemy.x - hero.x,
      dy = enemy.y - hero.y;
    const key =
      Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "d" : "a") : dy > 0 ? "s" : "w";
    await page.keyboard.down(key);
    await page.waitForTimeout(Math.hypot(dx, dy) > 65 ? 160 : 30);
    await page.keyboard.press("j");
    await page.keyboard.up(key);
    await page.waitForTimeout(650);
  }
  expect((await read(page)).defense.enemies.every((e: any) => e.hp === 0)).toBe(
    true,
  );
  await page.waitForFunction(
    () =>
      (window as any)
        .__farwind()
        .state.life.events.some(
          (e: any) => e.kind === "care" && e.subjects.includes("elder"),
        ),
    null,
    { timeout: 80000 },
  );
  await page.keyboard.press("Escape");
  const cared = await read(page);
  writeFileSync(
    "docs/npc-life/evidence/civilian-production-contact-check.json",
    JSON.stringify(
      {
        说明: "核对所有真实命中来源与治疗前后，不以最终血量猜测友伤或降血。",
        首次伤情: wounded,
        到场救治: cared,
      },
      null,
      2,
    ),
  );
  expect(cared.state.life.people[0].body.hp).toBe(90);
  expect(cared.state.life.people[0].body.health).toBe("convalescent");
  expect(cared.state.life.people[1].supplies.medicine).toBe(1);
  expect(
    cared.state.life.events.filter(
      (e: any) => e.kind === "injury" && e.source === "player",
    ),
  ).toEqual([]);
  expect(cared.state.bag).toEqual(state.bag);
  await page.screenshot({
    path: "docs/npc-life/evidence/civilian-production-minor-care.png",
  });
  await page.getByRole("button", { name: "保存旅途", exact: true }).click();
  await expect(page.locator("#toast")).toContainText("已保存");
  await page.reload();
  await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  await page.waitForFunction(() => (window as any).__farwind?.().mode === "");
  const restored = await read(page);
  expect(restored.state.life.people[0].body.hp).toBe(90);
  expect(
    restored.state.life.events.filter(
      (e: any) => e.kind === "care" && e.subjects.includes("elder"),
    ),
  ).toHaveLength(1);
  expect(restored.state.life.people[1].supplies.medicine).toBe(1);
  writeFileSync(
    "docs/npc-life/evidence/civilian-combat-production.json",
    JSON.stringify(
      {
        说明: "正式构建固定突破样本，未点击伤情或快进；伤害由真实攻击，玩家操作与治疗均在页面进行。既有北门死亡作为起始事实，不是本次随机灾难。",
        实际轻伤: wounded,
        实际救治: cared,
        重新加载: restored,
        页面异常: errors,
      },
      null,
      2,
    ),
  );
  expect(errors).toEqual([]);
});
test("正式构建：旧档迁移、动态药房交谈、原服务与隐藏调试", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const old: any = initialState();
  old.schema_version = 5;old.skills={swordWind:false};
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
  expect((await read(page)).state.schema_version).toBe(7);
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
  expect(before.state.life.version).toBe(4);
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
  old.schema_version = 5;old.skills={swordWind:false};
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
  expect((await read(page)).state.life.version).toBe(4);
  await page.screenshot({ path: "docs/npc-life/evidence/production-inn.png" });
  const sequence = (await read(page)).state.defense.sequence;
  await page.keyboard.press("e");
  await page.waitForFunction(
    () => (window as any).__farwind().state.life.playerSpace === "village",
  );
  expect((await read(page)).state.defense.sequence).toBe(sequence);
});
