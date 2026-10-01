import { test, expect, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { initialState, validate, type State } from "../src/game/systems/state";
import { PEOPLE } from "../src/data/npcLife";
import { RUNES } from "../src/data/runes";
import { ENCOUNTERS } from "../src/data/maps/windbell/encounters";
import { settleEncounterDeath } from "../src/game/systems/encounterState";
import { initialBossBattle } from "../src/game/systems/campBossState";

const dir = "../evidence/browser";
const read = (page: Page) => page.evaluate(() => (window as any).__farwind());
function fixture(boss = false) {
  const s = initialState();
  s.xiaobao.task = "free";
  for (const person of PEOPLE)
    s.life.observed[person.id] = {
      time: s.time,
      label: "隔离初始观察记录",
      space: "village",
    };
  if (boss) {
    const camp = ENCOUNTERS.find((c) => c.id === "west-wolf-den")!;
    const g = s.encounters.groups[camp.id];
    g.activated = true;
    for (const m of camp.members.filter((m) => !m.boss))
      settleEncounterDeath(s.encounters, m.id, false);
    Object.assign(g.boss!, {
      stage: "battle",
      warning: 0,
      attempt: 1,
      combat: {
        battle: { ...initialBossBattle(0), phase: 2, nextAt: 20000 },
        attack: null,
        hazards: [],
        shots: [],
        stagger: 0,
        parried: null,
      },
    });
    g.members[camp.members.findIndex((m) => m.boss)].hp = 1;
    Object.assign(s.player, { x: -1780, y: 1490 });
  } else s.runes.owned = RUNES.map((r) => r.id);
  return validate(s);
}
async function loadFixture(page: Page, s: State, name: string) {
  await mkdir(dir, { recursive: true });
  const path = `${dir}/${name}.json`;
  await writeFile(path, JSON.stringify(s));
  await page.goto("/?combatFeel=1");
  await page.waitForFunction(
    () => typeof (window as any).__combatFeel === "object",
  );
  const chooser = page.waitForEvent("filechooser");
  await page.locator("#import").click();
  page.once("dialog", (dialog) => dialog.accept());
  await (await chooser).setFiles(path);
  await page.waitForFunction(() => (window as any).__farwind().mode === "");
  await page.locator("#combat-feel-debug summary").click();
}
async function killBoss(page: Page) {
  await page.keyboard.down("d");
  await page.waitForFunction(
    () => (window as any).__farwind().state.player.x > -1778,
  );
  await page.keyboard.up("d");
  await page.keyboard.press("j");
  await expect(page.locator(".victory-panel")).toBeVisible();
}
async function disk(page: Page) {
  return page.evaluate(
    () =>
      new Promise<any>((ok, no) => {
        const r = indexedDB.open("farwind-combat-feel-isolated", 1);
        r.onsuccess = () => {
          const d = r.result,
            t = d.transaction("states"),
            get = t.objectStore("states").get("current");
          get.onsuccess = () => ok(get.result);
          t.oncomplete = () => d.close();
        };
        r.onerror = () => no(r.error);
      }),
  );
}
async function positions(page: Page) {
  return page.evaluate(() => ({
    panel: document.querySelector(".rune-panel")!.scrollTop,
    grid: document.querySelector(".rune-grid")!.scrollTop,
    focus: document.activeElement?.id,
  }));
}
async function positionForAction(page: Page) {
  await page.locator("#rune-equip").focus();
  await page.evaluate(() => {
    document.querySelector(".rune-panel")!.scrollTop = 160;
    document.querySelector(".rune-grid")!.scrollTop = 280;
  });
  const p = await positions(page);
  expect(p.panel).toBeGreaterThan(0);
  expect(p.grid).toBeGreaterThan(0);
  return p;
}

test("boss-real-kill-reward-save-reload", async ({ page }) => {
  await loadFixture(page, fixture(true), "boss-initial");
  await killBoss(page);
  await expect(page.locator(".victory-panel")).toContainText("荆冠猎王");
  await expect(page.locator(".victory-rewards")).toContainText(
    "已收藏 · 未装备",
  );
  await expect(page.locator("#boss-save-status")).toContainText("已保存");
  const killed = await read(page),
    reward = RUNES.find(
      (r) =>
        r.acquisition.kind === "boss" && r.acquisition.key === "west-wolf-den",
    )!;
  expect(
    killed.state.runes.owned.filter((id: string) => id === reward.id),
  ).toHaveLength(1);
  expect(killed.state.runes.slots).not.toContain(reward.id);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(3700);
  await expect(page.locator(".victory-panel")).toBeVisible();
  await page.screenshot({ path: `${dir}/boss-victory.png` });
  await page.locator("#victory-runes").click();
  await expect(page.locator(".rune-detail")).toContainText(reward.name);
  await expect(page.locator("#rune-equip")).toBeDisabled();
  await expect(page.locator("#rune-feedback")).toContainText("脱战");
  await page.keyboard.press("Escape");
  // The existing first-camp story appears after leaving the receipt; acknowledge it normally.
  await page.getByRole("button", { name: "继续 · E", exact: true }).click();
  await page.waitForFunction(
    () => !(window as any).__farwind().runes.lock,
    undefined,
    { timeout: 20000 },
  );
  await page.keyboard.press("r");
  await page.locator("#rune-equip").click();
  await expect(page.locator("#rune-feedback")).toContainText(
    "效果已生效并保存",
  );
  expect((await disk(page)).runes.slots[0]).toBe(reward.id);
  await page.reload();
  await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  await page.waitForFunction(() => (window as any).__farwind().mode === "");
  const restored = await read(page);
  expect(restored.state.encounters.groups["west-wolf-den"].boss.stage).toBe(
    "defeated",
  );
  expect(
    restored.state.runes.owned.filter((id: string) => id === reward.id),
  ).toHaveLength(1);
  expect(restored.state.runes.slots[0]).toBe(reward.id);
  expect(Object.keys(restored.state.life.observed)).toHaveLength(15);
  await writeFile(
    `${dir}/boss-round-trip.json`,
    JSON.stringify(
      {
        explanation:
          "Valid isolated wounded-boss initial save, real J strike triggers death and rewards; no result state edits.",
        killed,
        restored,
      },
      null,
      2,
    ),
  );
});

test("boss-save-failure-visible-retry", async ({ page }) => {
  await loadFixture(page, fixture(true), "boss-failure-initial");
  await page.evaluate(() => (window as any).__combatFeel.fault(0, 10));
  await killBoss(page);
  await expect(page.locator("#save-warning")).toBeVisible();
  await expect(page.locator("#boss-save-status")).toContainText("尚未保存");
  await expect(page.locator(".victory-rewards")).toContainText(
    "已收藏 · 未装备",
  );
  expect((await disk(page)).encounters.groups["west-wolf-den"].boss.stage).toBe(
    "battle",
  );
  const visible = await page.locator("#save-warning").evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      unobscured: el.contains(
        document.elementFromPoint(r.x + r.width / 2, r.y + 20),
      ),
      bottom: r.bottom,
    };
  });
  expect(visible.unobscured).toBe(true);
  expect(visible.bottom).toBeLessThanOrEqual(720);
  await page.screenshot({ path: `${dir}/boss-save-failure.png` });
  await page.evaluate(() => (window as any).__combatFeel.fault(0, 0));
  await page.locator("#save-retry").click();
  await expect(page.locator("#save-warning")).toBeHidden();
  await expect(page.locator("#boss-save-status")).toContainText("已保存");
  expect((await disk(page)).encounters.groups["west-wolf-den"].boss.stage).toBe(
    "defeated",
  );
});

test("rune-scroll-focus-transaction-retry-duplicate", async ({ page }) => {
  await loadFixture(page, fixture(), "runes-initial");
  await page.setViewportSize({ width: 1280, height: 600 });
  await page.keyboard.press("r");
  await page.locator('[data-rune-id="r26"]').click();
  const before = await positionForAction(page);
  await page.keyboard.press("Enter");
  await expect(page.locator("#rune-feedback")).toContainText(
    "效果已生效并保存",
  );
  expect((await read(page)).state.runes.slots[0]).toBe("r26");
  expect(await positions(page)).toEqual(before);
  await page.locator('[data-rune-id="r27"]').click();
  const failedBefore = await positionForAction(page);
  await page.evaluate(() => (window as any).__combatFeel.fault(300, 1));
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await expect(page.locator("#rune-feedback")).toContainText("配装未更改");
  await expect(page.locator("#rune-feedback")).toContainText("保存失败");
  expect((await read(page)).state.runes.slots[0]).toBe("r26");
  expect((await disk(page)).runes.slots[0]).toBe("r26");
  expect(await positions(page)).toEqual(failedBefore);
  await page.locator("#rune-feedback").scrollIntoViewIfNeeded();
  const feedbackVisible = await page
    .locator("#rune-feedback")
    .evaluate((el) => {
      const r = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(r.x + 5, r.y + 5));
    });
  expect(feedbackVisible).toBe(true);
  await page.screenshot({ path: `${dir}/rune-failure-feedback.png` });
  await page.evaluate(() => (window as any).__combatFeel.fault(300, 0));
  const retryBefore = await positionForAction(page);
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await expect(page.locator("#rune-feedback")).toContainText(
    "效果已生效并保存",
  );
  expect((await read(page)).state.runes.slots[0]).toBe("r27");
  expect(await positions(page)).toEqual(retryBefore);
  const committed = (await read(page)).session.saving.persisted;
  await page.keyboard.press("Enter");
  await expect(page.locator("#rune-feedback")).toContainText("无需重复装入");
  expect((await read(page)).session.saving.persisted).toBe(committed);
  expect(await positions(page)).toEqual(retryBefore);
  await page.locator('[data-rune-slot="1"]').click();
  await page.locator('[data-rune-id="r27"]').click();
  await page.locator("#rune-equip").click();
  await expect(page.locator("#rune-feedback")).toContainText(
    "同名符文已经装备",
  );
  expect((await read(page)).state.runes.slots.slice(0, 2)).toEqual([
    "r27",
    null,
  ]);
  await page.screenshot({ path: `${dir}/rune-equipped-duplicate.png` });
  await writeFile(
    `${dir}/rune-position.json`,
    JSON.stringify(
      {
        before,
        failedBefore,
        retryBefore,
        final: await positions(page),
        state: (await read(page)).state.runes,
      },
      null,
      2,
    ),
  );
});

test("melee-visible-boar-edge-real-strike", async ({ page }) => {
  const s = fixture();
  s.runes.owned = [];
  Object.assign(s.player, { x: 3025, y: 340 });
  const g = s.encounters.groups["east-spring-boar"];
  g.activated = true;
  g.members[0].cooldown = 8000;
  g.members[0].face = { x: -1, y: 0 };
  await loadFixture(page, validate(s), "boar-edge-initial");
  await page.locator("#combat-feel-debug summary").click();
  await page.locator("#combat-hitbox").check();
  await page.locator("#combat-feel-debug summary").click();
  await page.keyboard.down("d");
  await page.waitForFunction(
    () => (window as any).__farwind().state.player.x > 3026,
  );
  await page.keyboard.up("d");
  const before = await read(page),
    boar = before.enemies.find((e: any) => e.id === "boar-1");
  expect(
    Math.hypot(boar.x - before.state.player.x, boar.y - before.state.player.y),
  ).toBeGreaterThan(92);
  expect(boar.hp).toBe(90);
  await page.screenshot({ path: `${dir}/boar-body-before.png` });
  await page.keyboard.press("j");
  await page.waitForFunction(
    () =>
      (window as any).__farwind().enemies.find((e: any) => e.id === "boar-1")
        .hp < 90,
  );
  await page.keyboard.press("Escape");
  const hit = await read(page);
  await page.screenshot({ path: `${dir}/boar-body-hit.png` });
  await writeFile(
    `${dir}/boar-edge.json`,
    JSON.stringify(
      {
        explanation:
          "Imported valid initial condition only. Real D orientation and J strike. Pre-strike foot-root distance exceeds old 92px point range.",
        before,
        hit,
      },
      null,
      2,
    ),
  );
});
