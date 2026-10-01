import { test, expect, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { initialState, validate } from "../src/game/systems/state";
import { GUARD_LANDINGS, FACILITIES } from "../src/data/npcLife";
import { EastDefense } from "../src/game/systems/defense";
import { NpcLife } from "../src/game/systems/npcLife";
import { settleEncounterDeath } from "../src/game/systems/encounterState";

const production = process.env.FARWIND_NPC_WALK_PRODUCTION === "1",
  label = production ? "production" : "development",
  root = "docs/npc-life/locomotion/evidence";
const read = (page: Page) => page.evaluate(() => (window as any).__farwind());
async function imported(page: Page, state: ReturnType<typeof initialState>) {
  await page.goto(production ? "/" : "/?npcDebug=1");
  page.once("dialog", (dialog) => dialog.accept());
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "导入存档" }).click();
  await (
    await chooser
  ).setFiles({
    name: "npc-walk-sample.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(validate(state))),
  });
  await page.waitForFunction(() => (window as any).__farwind?.().mode === "");
  await page.bringToFront();
}
async function observeNpc(page: Page, id: string) {
  if (production) return;
  await page.getByRole("button", { name: "NPC 调试", exact: true }).click();
  await page.getByLabel("观察居民").selectOption(id);
  await page.getByRole("button", { name: "观察人物", exact: true }).click();
  await page.getByRole("button", { name: "NPC 调试", exact: true }).click();
}
async function observe(page: Page, duration: number, simulation = false) {
  return page.evaluate(
    async ({ duration, simulation }) => {
      const rows: any[] = [],
        start = performance.now(),
        startSim = (window as any).__farwind().state.life.elapsed;
      while (performance.now() - start < (simulation ? 120000 : duration)) {
        const s = (window as any).__farwind();
        if (simulation && s.state.life.elapsed - startSim >= duration) break;
        for (const v of [...s.npcLifeView.residents, ...s.defendersView]) {
          const body =
            s.state.life.people.find((n: any) => n.id === v.id)?.body ??
            s.state.defense.guards.find((g: any) => g.id === v.id);
          rows.push({
            时间: s.state.life.elapsed,
            人物: v.id,
            图集: v.texture,
            帧: v.frame,
            坐标: [v.x, v.y],
            空间: body.space ?? "village",
            可见: v.visible,
            镜像: v.flip,
            朝向: v.motion.direction,
            速度: v.motion.speed,
            步幅: v.motion.distance,
            动作: v.motion.action,
            锚点: v.origin,
          });
        }
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      return rows;
    },
    { duration, simulation },
  );
}
function checkWalk(rows: any[], ids: string[]) {
  return ids.map((id) => {
    const moving = rows.filter(
        (r) => r.人物 === id && r.速度 > 4 && r.图集.startsWith("npc-motion-"),
      ),
      poses = new Set(moving.map((r) => r.帧 % 7)),
      directions = new Set(moving.map((r) => r.朝向));
    expect(moving.length, `${id}实际移动样本`).toBeGreaterThan(20);
    expect([...poses].sort(), `${id}六帧真实步态`).toEqual([1, 2, 3, 4, 5, 6]);
    for (const row of moving) {
      expect(row.动作).toBe("walk");
      expect(Math.floor(row.帧 / 7)).toBe(
        row.朝向 === 1 ? 1 : row.朝向 >= 2 ? 2 : 0,
      );
      expect(row.镜像).toBe(row.朝向 === 2);
      expect(row.锚点).toEqual([0.5, 148 / 160]);
    }
    const idle = rows.filter(
      (r) => r.人物 === id && r.速度 === 0 && r.图集.startsWith("npc-motion-"),
    );
    expect(idle.every((r) => r.帧 % 7 === 0)).toBe(true);
    return {
      人物: id,
      移动样本: moving.length,
      六帧步态: [...poses].sort(),
      朝向: [...directions],
      停步样本: idle.length,
    };
  });
}
async function saveVideo(page: Page, file: string) {
  const video = page.video();
  await page.close();
  if (video) await video.saveAs(file);
}

// 新游戏居民自然取物，真实位移播放步态，停步与暂停不踏空。
test("NPC-WALK-01", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(production ? "/" : "/?npcDebug=1");
  await page.getByRole("button", { name: "启程 · 新游戏" }).click();
  await page.waitForFunction(() => (window as any).__farwind?.().mode === "");
  await observeNpc(page, "elder");
  const rows = await observe(page, 30000),
    summary = checkWalk(rows, ["elder", "healer", "carpenter"]);
  await page.screenshot({ path: `${root}/${label}-residents.png` });
  await page.keyboard.press("Escape");
  await page.waitForFunction(
    () => (window as any).__farwind().mode === "pause",
  );
  const paused = await read(page);
  await page.waitForTimeout(700);
  const frozen = await read(page);
  expect(frozen.state).toEqual(paused.state);
  expect(frozen.npcLifeView).toEqual(paused.npcLifeView);
  expect(frozen.defendersView).toEqual(paused.defendersView);
  expect(errors).toEqual([]);
  writeFileSync(
    `${root}/${label}-residents.json`,
    JSON.stringify(
      {
        说明: "真实新游戏与自然生活决策，只读快照；摄像机观察不改变人物状态。",
        人物: summary,
        暂停冻结: true,
        页面错误: errors,
        样本: rows,
      },
      null,
      2,
    ),
  );
  await saveVideo(page, `${root}/${label}-residents.webm`);
});

// 四门弓手轮休途中完整迈步、真实转向，暂停存读档继续行程。
test("NPC-WALK-02", async ({ page }) => {
  const errors: string[] = [],
    s = initialState(),
    ids = ["east-archer", "north-archer", "south-archer", "west-archer"];
  page.on("pageerror", (error) => errors.push(error.message));
  s.time = 19 * 60 + 36;
  // 南门最近的芦边史莱姆距离塔岗不足警戒半径；使用已击败、尚未重生的合法遭遇记录。
  s.encounters.groups["south-reed-patrol"].activated = true;
  settleEncounterDeath(s.encounters, "wild-reed-slime", false);
  // 固定首日晚间、四名弓手已落地且有完整回家任务的合法输入样本；随后由正式AI推进。
  for (const id of ids)
    Object.assign(
      s.defense.guards.find((g) => g.id === id)!,
      GUARD_LANDINGS[id],
      { offDuty: true, mode: "life", towerTransitMs: 0 },
    );
  const life = new NpcLife(s, new EastDefense(s.defense, 0));
  for (const id of ids) {
    const n = s.life.people.find((n) => n.id === id)!,
      bed = FACILITIES.find((f) => f.id === `bed:${id}`)!;
    expect(
      life.begin(n, {
        kind: "sleep",
        target: bed.place,
        facility: bed.id,
        task: null,
        score: 80,
        label: "轮休",
      }),
    ).toBe(true);
  }
  life.syncGuardOrders();
  Object.assign(s.player, { x: 340, y: 1690 });
  await imported(page, s);
  await observeNpc(page, "west-archer");
  const rows = await observe(page, 30000, true);
  writeFileSync(
    `${root}/${label}-archers-observed.json`,
    JSON.stringify(
      {
        说明: "首日晚间的完整轮休任务，南门芦边史莱姆已击败且尚未重生；按实际模拟时长采样，页面内仅观察。",
        结束状态: (await read(page)).state,
        导航: (await read(page)).npcLife.people.filter((n: any) => ids.includes(n.id)).map((n: any) => ({ 人物: n.id, 路径: n.path })),
        样本: rows,
      },
      null,
      2,
    ),
  );
  const summary = checkWalk(rows, ids);
  await page.screenshot({ path: `${root}/${label}-archers.png` });
  await page.keyboard.press("Escape");
  await page.waitForFunction(
    () => (window as any).__farwind().mode === "pause",
  );
  const paused = await read(page);
  await page.waitForTimeout(600);
  const frozen = await read(page);
  expect(frozen.state).toEqual(paused.state);
  expect(frozen.defendersView).toEqual(paused.defendersView);
  await page.getByRole("button", { name: "保存旅途", exact: true }).click();
  await expect(page.locator("#toast")).toContainText("已保存");
  await page.reload();
  await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  await page.waitForFunction(() => (window as any).__farwind?.().mode === "");
  const loaded = await read(page),
    elapsed = loaded.state.life.elapsed - paused.state.life.elapsed;
  for (const id of ids) {
    const before = paused.state.defense.guards.find((g: any) => g.id === id),
      after = loaded.state.defense.guards.find((g: any) => g.id === id);
    expect(after.hp).toBeCloseTo(before.hp);
    expect(after.dead).toBe(before.dead);
    expect(
      Math.hypot(after.x - before.x, after.y - before.y),
    ).toBeLessThanOrEqual((elapsed * 86) / 1000 + 0.01);
  }
  await observeNpc(page, "west-archer");
  const resumed = await observe(page, 1500, true);
  const west = resumed.filter(
    (r) =>
      r.人物 === "west-archer" && r.速度 > 4 && r.图集 === "npc-motion-archer",
  );
  expect(west.length).toBeGreaterThan(20);
  expect(errors).toEqual([]);
  writeFileSync(
    `${root}/${label}-archers.json`,
    JSON.stringify(
      {
        说明: "导入明确标记的首日晚间落地样本，含完整轮休任务及南门芦边史莱姆已击败记录；之后只操作观察、暂停、保存和继续旅途，没有改写浏览器状态或快进。",
        人物: summary,
        暂停冻结: true,
        存读档连续: true,
        读档后远翎行走样本: west.length,
        页面错误: errors,
        样本: rows,
        读档后样本: resumed,
      },
      null,
      2,
    ),
  );
  await saveVideo(page, `${root}/${label}-archers.webm`);
});

// 新游戏自然返程，核对近战卫兵真正使用了交替靴子的行走图集。
test("NPC-WALK-03", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(production ? "/" : "/?npcDebug=1");
  await page.getByRole("button", { name: "启程 · 新游戏" }).click();
  await page.waitForFunction(() => (window as any).__farwind?.().mode === "");
  await observeNpc(page, "west-watch");
  const rows = await observe(page, 30000);
  const moving = rows.filter((r) =>
    r.人物 === "west-watch" && r.速度 > 4 && r.图集 === "defender-guard-walk"
  );
  expect(moving.length, "禾岩自然返程的实际移动样本").toBeGreaterThan(20);
  expect([...new Set(moving.map((r) => r.帧 % 2))].sort()).toEqual([0, 1]);
  for (const row of moving) {
    expect(Math.floor(row.帧 / 2)).toBe(row.朝向 === 1 ? 1 : row.朝向 >= 2 ? 2 : 0);
    expect(row.镜像).toBe(row.朝向 === 2);
    expect(row.锚点).toEqual([0.5, 148 / 160]);
  }
  const idle = rows.filter((r) => r.人物 === "west-watch" && r.速度 === 0);
  expect(idle.every((r) => r.图集 !== "defender-guard-walk")).toBe(true);
  expect(errors).toEqual([]);
  for (const phase of [0, 1]) {
    await page.waitForFunction((expected) => {
      const v = (window as any).__farwind().defendersView.find((item: any) => item.id === "west-watch");
      return v?.visible && v.texture === "defender-guard-walk" && v.frame % 2 === expected;
    }, phase, { timeout: 15000 });
    if (!production) await page.screenshot({ path: `${root}/${label}-guard-step-phase-${phase}.png` });
  }
  if (!production) await page.screenshot({ path: `${root}/${label}-guard-step.png` });
  writeFileSync(`${root}/${label}-guard-step.json`, JSON.stringify({
    说明: "新游戏自然行程与摄像机观察；只读卫兵实际位移、朝向、图集和帧，素材靴子位置由像素测试核对。",
    移动样本: moving.length,
    两个步相: [...new Set(moving.map((r) => r.帧 % 2))].sort(),
    停步样本: idle.length,
    页面错误: errors,
    样本: rows.filter((r) => r.人物 === "west-watch"),
  }, null, 2));
  if (production) await page.close();
  else await saveVideo(page, `${root}/${label}-guard-step.webm`);
});
