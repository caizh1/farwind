import { test, expect, type Page } from "@playwright/test";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { initialState } from "../src/game/systems/state";
import { captureGameAudio } from "../tools/capture-game-audio.mjs";
export const dir = "docs/sword-wind/evidence",
  raw = ".sword-wind-local/recording",
  off = process.env.VITE_DEV_GRANT_SWORD_WIND === "0";
export const read = (p: Page) => p.evaluate(() => (window as any).__farwind());
export async function setup(
  page: Page,
  x = 760,
  y = 650,
  arena = false,
  killed: string[] = [],
) {
  await mkdir(raw, { recursive: true });
  await page.addInitScript(captureGameAudio);
  page.on("dialog", (d) => d.accept());
  await page.goto(arena ? "/tools/sword-wind-arena.html" : "/");
  await page.waitForFunction(
    () => typeof (window as any).__farwind === "function",
  );
  if (arena)
    await page
      .getByRole("button", { name: "启程 · 新游戏", exact: true })
      .click();
  else {
    const s = initialState();
    s.quest = 3;
    s.player.x = x;
    s.player.y = y;
    s.killed = killed;
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "导入存档", exact: true }).click();
    await (
      await chooser
    ).setFiles({
      name: "wind-fixture.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(s)),
    });
  }
  await page.waitForFunction(() => (window as any).__farwind().mode === "");
  await page.evaluate(() => {
    (window as any).__windFrames = [];
    const loop = () => {
      const s = (window as any).__farwind();
      (window as any).__windFrames.push({
        时间: s.session.sim,
        墙钟: performance.now(),
        动作: s.animation.hero,
        战斗: s.session.combat,
        剑风: s.swordWind,
        训练: s.training,
        敌人: s.enemies,
      });
      (window as any).__windSampler = requestAnimationFrame(loop);
    };
    loop();
  });
}
export async function face(page: Page, key: string, d: number) {
  await page.keyboard.down(key);
  await page.waitForFunction(
    (d) => (window as any).__farwind().animation.hero.direction === d,
    d,
  );
  await page.keyboard.up(key);
}
export async function third(page: Page) {
  await page.keyboard.press("j");
  await page.waitForFunction(
    () => (window as any).__farwind().session.combat.stage === 1,
  );
  await page.keyboard.press("j");
  await page.waitForFunction(
    () => (window as any).__farwind().session.combat.stage === 2,
  );
  await page.keyboard.press("j");
  await page.waitForFunction(
    () => (window as any).__farwind().session.combat.stage === 3,
  );
}
export async function fourth(page: Page, mouse = false) {
  await page.waitForFunction(() =>
    document
      .querySelector("#parry-status")
      ?.textContent?.includes("J 接第四击·剑风"),
  );
  if (mouse) await page.mouse.click(640, 480);
  else await page.keyboard.press("j");
  await page.waitForFunction(
    () => (window as any).__farwind().session.combat.stage === 4,
  );
}
export async function finish(
  page: Page,
  name: string,
  kind = "合法起始夹具＋只读诊断＋真实键鼠",
) {
  const state = await read(page),
    frames = await page.evaluate(() => {
      cancelAnimationFrame((window as any).__windSampler);
      return (window as any).__windFrames;
    });
  await writeFile(
    `${dir}/${name}.json`,
    JSON.stringify(
      {
        说明: kind,
        最终状态: state,
        观察帧数: frames.length,
        播放速度: "未调时间比例，未编辑运行中状态",
      },
      null,
      2,
    ),
  );
  await writeFile(`${raw}/${name}-trace.json`, JSON.stringify(frames));
  const audio = await page.evaluate(() => (window as any).__finishAudio());
  await writeFile(
    `${raw}/${name}-audio.webm`,
    Buffer.from(audio.base64, "base64"),
  );
  await writeFile(
    `${dir}/${name}-media.json`,
    JSON.stringify(
      {
        说明: "旁路采集实际游戏AudioContext总线；正常比例、正常速度",
        音频偏移秒: audio.offset,
      },
      null,
      2,
    ),
  );
  const video = page.video();
  await page.close();
  await video!.saveAs(`${raw}/${name}-video.webm`);
}
test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus && !page.isClosed()) {
    await mkdir(`${raw}/failures`, { recursive: true });
    await writeFile(
      `${raw}/failures/${info.testId}.json`,
      JSON.stringify(
        {
          说明: "首次失败只读现场，保留首因，不自动重试",
          状态: await read(page),
        },
        null,
        2,
      ),
    );
  }
});
