import { test, expect } from "@playwright/test";
import { initialState } from "../src/game/systems/state";
import { writeFile } from "node:fs/promises";
import { captureGameAudio } from "../tools/capture-game-audio.mjs";
test.use({ video: { mode: "on", size: { width: 1280, height: 720 } } });
const dir = "docs/combat-contact/evidence";
test("隔离森林夹具：侧向第二刀经过正前叶灵；背向三连及停手", async ({
  page,
}) => {
  await page.addInitScript(captureGameAudio);
  page.on("dialog", (d) => d.accept());
  await page.goto("/");
  const fixture = initialState();
  delete fixture.map_version;
  fixture.player.x = 2230;
  fixture.player.y = 1070;
  fixture.quest = 3;
  fixture.killed = ["slime-1", "slime-2"];
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "导入存档" }).click();
  await (
    await chooser
  ).setFiles({
    name: "contact-fixture.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(fixture)),
  });
  await page.waitForFunction(
    () =>
      (window as any).__farwind().state.player.x > 2200 &&
      (window as any).__farwind?.().session.sim > 500,
  );
  await page.keyboard.down("d");
  await page.waitForFunction(
    () => (window as any).__farwind().animation.hero.direction === 3,
  );
  await page.keyboard.up("d");
  await page.evaluate(() => {
    (window as any).__contact = [];
    (window as any).__contactTimer = setInterval(() => {
      const s = (window as any).__farwind();
      (window as any).__contact.push({
        sim: s.session.sim,
        combat: s.session.combat,
        hero: s.animation.hero,
        player: s.state.player,
        enemies: s.enemies,
      });
    }, 8);
  });
  // 固定按键节奏，接招不读取内部窗口；独立场景转向只用于建立前置条件。
  await page.keyboard.press("j");
  await page.waitForTimeout(60);
  await page.keyboard.press("j");
  await page.waitForTimeout(1100);
  const side = await page.evaluate(() => (window as any).__contact);
  const hits = side.filter(
    (s: any) =>
      s.combat.stage === 2 &&
      s.combat.phase === "active" &&
      s.enemies.find((e: any) => e.id === "leaf-1").hp === 34,
  );
  expect(hits.length).toBeGreaterThan(0);
  expect(hits.every((s: any) => s.combat.facing === 3)).toBe(true);
  expect(
    hits.some((s: any) => {
      const e = s.enemies.find((e: any) => e.id === "leaf-1"),
        w = s.hero.weapon;
      return (
        w &&
        e.x > s.player.x &&
        Math.hypot(
          s.player.x + w.tip.x - e.x,
          s.player.y + w.tip.y - (e.y - 25),
        ) < 38
      );
    }),
  ).toBe(true);
  await page.screenshot({ path: `${dir}/side-contact-runtime.png` });
  // 通过游戏菜单开启独立村庄场景，背向空挥清楚标识，不冒充森林命中。
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "返回标题" }).click();
  await page.getByRole("button", { name: "启程 · 新游戏" }).click();
  await page.getByRole("button", { name: "确认新游戏" }).click();
  await page.waitForFunction(
    () => (window as any).__farwind?.().session.sim > 500,
  );
  await page.keyboard.down("w");
  await page.waitForFunction(
    () => (window as any).__farwind().animation.hero.direction === 1,
  );
  await page.keyboard.up("w");
  await page.keyboard.press("j");
  await page.waitForTimeout(60);
  await page.keyboard.press("j");
  await page.waitForTimeout(250);
  await page.keyboard.press("j");
  await page.waitForTimeout(1300);
  const trace = await page.evaluate(() => {
    clearInterval((window as any).__contactTimer);
    return (window as any).__contact;
  });
  const back = trace.filter((s: any) => s.combat.facing === 1);
  for (const stage of [1, 2, 3])
    expect(
      back.some(
        (s: any) =>
          s.combat.stage === stage &&
          s.combat.phase === "active" &&
          s.hero.texture === "hero-combat-back",
      ),
    ).toBe(true);
  expect(
    trace.some(
      (s: any) =>
        s.hero.phase === "settle" && s.hero.texture === "hero-combat-back",
    ),
  ).toBe(true);
  expect(
    (await page.evaluate(() => (window as any).__farwind())).animation.hero
      .texture,
  ).toBe("hero-motion");
  await writeFile(`${dir}/contact-trace.json`, JSON.stringify(trace, null, 2));
  const audio = await page.evaluate(() => (window as any).__finishAudio());
  await writeFile(
    `${dir}/contact-audio.webm`,
    Buffer.from(audio.base64, "base64"),
  );
  await writeFile(`${dir}/contact-audio-offset.txt`, String(audio.offset));
  const video = page.video();
  await page.close();
  await video!.saveAs(`${dir}/contact-runtime.webm`);
});
