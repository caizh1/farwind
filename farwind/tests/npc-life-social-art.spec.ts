import { test, expect, type Page } from "@playwright/test";
import { initialState } from "../src/game/systems/state";
import { NpcLife } from "../src/game/systems/npcLife";
import { EastDefense } from "../src/game/systems/defense";
import { socialCandidate } from "../src/game/systems/npcSocial";

test.use({ headless: false });
const read = (page: Page) => page.evaluate(() => (window as any).__farwind());
async function imported(
  page: Page,
  state: ReturnType<typeof initialState>,
  name: string,
) {
  await page.goto("/?npcDebug=1");
  page.once("dialog", (d) => d.accept());
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "导入存档" }).click();
  await (
    await chooser
  ).setFiles({
    name,
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(state)),
  });
  await page.waitForFunction(() => (window as any).__farwind?.().mode === "");
}
async function savedReload(page: Page) {
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "保存旅途", exact: true }).click();
  await expect(page.locator("#toast")).toContainText("已保存");
  await page.reload();
  await page.getByRole("button", { name: "继续旅途" }).click();
  await page.waitForFunction(() => (window as any).__farwind?.().mode === "");
}

test("手绘职业四帧、家具遮挡、暂停和配药中途重载", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const s = initialState();
  s.time = 540;
  s.life.playerSpace = "healer-home";
  Object.assign(s.player, { x: 830, y: 855 });
  const l = new NpcLife(s, new EastDefense(s.defense, 0)),
    n = s.life.people[1];
  n.gear = "carried";
  Object.assign(n.body!, { space: "healer-home", x: 830, y: 800 });
  l.begin(
    n,
    l.candidates(n).find((c) => c.facility === "pharmacy")!,
  );
  n.action!.phase = "perform";
  const id = n.action!.id;
  await imported(page, s, "work-art-save.json");
  await page.waitForFunction(
    () =>
      (window as any)
        .__farwind()
        .npcLifeView.residents.find((v: any) => v.id === "healer").texture ===
      "healer-work",
  );
  const frames = new Set();
  for (let expected = 0; expected < 4; expected++) {
    await page.waitForFunction((expected) => {
      const snap = (window as any).__farwind(),
        v = snap.npcLifeView.residents.find((v: any) => v.id === "healer");
      return v.texture === "healer-work" && v.frame === expected;
    }, expected);
    const snap = await read(page),
      v = snap.npcLifeView.residents.find((v: any) => v.id === "healer");
    frames.add(v.frame);
    expect(v.frame).toBe(
      Math.floor(snap.state.life.people[1].action.progress / 300) % 4,
    );
    expect(
      snap.npcLifeView.furniture.some(
        (f: any) => f.texture === "life-table" && f.depth < v.depth,
      ),
    ).toBe(true);
  }
  expect(frames.size).toBe(4);
  await page.screenshot({
    path: "docs/npc-life/evidence/handdrawn-pharmacy.png",
  });
  await page.keyboard.press("Escape");
  const paused = await read(page);
  await page.waitForTimeout(900);
  const frozen = await read(page);
  expect(frozen.state.life.people[1].action.progress).toBe(
    paused.state.life.people[1].action.progress,
  );
  expect(
    frozen.npcLifeView.residents.find((v: any) => v.id === "healer").frame,
  ).toBe(
    paused.npcLifeView.residents.find((v: any) => v.id === "healer").frame,
  );
  await page.keyboard.press("Escape");
  await savedReload(page);
  await page.waitForFunction(
    (id) => (window as any).__farwind().state.life.people[1].committed >= id,
    id,
  );
  const completed = await read(page);
  expect(completed.state.life.stores.medicine).toBe(s.life.stores.medicine + 1);
  expect(completed.state.life.stores.herbs).toBe(s.life.stores.herbs - 2);
  expect(completed.state.bag).toEqual(s.bag);
  expect(errors).toEqual([]);
});

test("已知照护样本的实际跨屋探访、近距对白与重载幂等", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const s = initialState();
  s.time = 1080;
  s.life.playerSpace = "healer-home";
  Object.assign(s.player, { x: 530, y: 620 });
  const l = new NpcLife(s, new EastDefense(s.defense, 0)),
    visitor = s.life.people[0],
    patient = s.life.people[1];
  Object.assign(visitor.body!, { space: "elder-home", x: 830, y: 800 });
  Object.assign(patient.body!, {
    space: "healer-home",
    x: 460,
    y: 560,
    hp: 70,
    health: "convalescent",
    recoverAt: s.time + 180,
  });
  // 导入明确标记的照护前提；验收实际探访，不能当作自然敌人命中的证据。
  const care = l.emit(
    "care",
    patient.body!,
    "carpenter",
    [patient.id],
    "演练样本：小满已接受照护",
    true,
  );
  l.remember(visitor, care, "report");
  visitor.known.healer = { ...patient.body!, time: s.time };
  l.begin(visitor, socialCandidate(l, visitor)!);
  const trust = patient.relations.elder.trust;
  await imported(page, s, "known-care-social-save.json");
  const first = await read(page);
  expect(first.state.life.people[0].body.space).toBe("elder-home");
  await page.waitForFunction(
    () =>
      (window as any)
        .__farwind()
        .state.life.events.some((e: any) => e.kind === "company"),
    null,
    { timeout: 60000 },
  );
  const arrived = await read(page),
    companies = arrived.state.life.events.filter(
      (e: any) => e.kind === "company",
    );
  expect(companies).toHaveLength(1);
  expect(companies[0].place.space).toBe("healer-home");
  expect(arrived.state.life.people[1].relations.elder.trust).toBe(trust + 2);
  expect(arrived.state.life.people[0].social.visited.healer).toBe(
    care.sequence,
  );
  expect(arrived.state.bag).toEqual(s.bag);
  await page.screenshot({ path: "docs/npc-life/evidence/social-visit.png" });
  // 当前岚爷爷离玩家最近，E 按实时实体交谈；不是回到他旧住宅位置。
  await page.keyboard.press("e");
  await expect(page.getByRole("dialog")).toContainText("到场探望");
  await page.keyboard.press("Escape");
  await savedReload(page);
  const restored = await read(page);
  expect(restored.state.life.version).toBe(4);
  expect(
    restored.state.life.events.filter((e: any) => e.kind === "company"),
  ).toHaveLength(1);
  expect(restored.state.life.people[1].relations.elder.trust).toBe(trust + 2);
  expect(errors).toEqual([]);
});

test("入床只显示头部，出床恢复原角色，床与空间保持一致", async ({ page }) => {
  const s = initialState();
  s.time = 1350;
  s.life.playerSpace = "healer-home";
  Object.assign(s.player, { x: 530, y: 620 });
  const l = new NpcLife(s, new EastDefense(s.defense, 0)),
    n = s.life.people[1];
  Object.assign(n.body!, { space: "healer-home", x: 460, y: 560 });
  l.begin(
    n,
    l.candidates(n).find((c) => c.facility === "bed:healer")!,
  );
  n.action!.phase = "perform";
  await imported(page, s, "sleep-art-save.json");
  // 场景可交互早于首个表现帧；等待实际入床渲染，仍严格核对裁切和家具深度。
  await page.waitForFunction(
    () => {
      const snap = (window as any).__farwind();
      return (
        snap.state.life.people[1].action?.phase === "perform" &&
        snap.npcLifeView.residents.find((v: any) => v.id === "healer").cropped
      );
    },
    null,
    { timeout: 3000 },
  );
  const sleep = await read(page),
    v = sleep.npcLifeView.residents.find((v: any) => v.id === "healer");
  expect(v.visible).toBe(true);
  expect(v.cropped).toBe(true);
  expect(v.texture).toBe("healer");
  expect(
    sleep.npcLifeView.furniture.some(
      (f: any) => f.texture === "life-bed" && f.depth < v.depth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "docs/npc-life/evidence/handdrawn-sleep.png" });
  await page.getByRole("button", { name: "NPC 调试", exact: true }).click();
  await page.getByLabel("观察居民").selectOption("healer");
  await page.getByRole("button", { name: "调试伤情", exact: true }).click();
  await page.waitForFunction(
    () =>
      !(window as any)
        .__farwind()
        .npcLifeView.residents.find((v: any) => v.id === "healer").cropped,
  );
});
