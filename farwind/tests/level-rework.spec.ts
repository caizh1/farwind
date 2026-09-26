import { test, expect, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { move } from "./map-navigation";
import { props } from "../src/data/world";
import { clearMotionLine, motionBlocked } from "../src/game/systems/obstacles";
const directory = "docs/level-rework/evidence";
const read = (page: Page) => page.evaluate(() => (window as any).__farwind());

test("局部入口真实步行、黑猫跟随、双门柱阻挡和存档重载", async ({ page }) => {
  await mkdir(directory, { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "启程 · 新游戏" }).click();
  await page.evaluate(() => {
    (window as any).__levelTrace = [];
    (window as any).__levelTraceTimer = setInterval(() => {
      const s = (window as any).__farwind();
      (window as any).__levelTrace.push({
        时刻: s.session.sim,
        主角: s.state.player,
        黑猫: s.companion,
        模式: s.mode,
      });
    }, 32);
  });
  await move(page, 670, 680);
  await expect.poll(async () => (await read(page)).target).toBe("elder");
  await page.keyboard.press("e");
  await page.getByRole("button", { name: "继续 · E" }).click();
  expect((await read(page)).state.quest).toBe(1);

  const crossings: any[] = [];
  async function reached(name: string, cat: (s: any) => boolean) {
    await expect
      .poll(async () => cat(await read(page)), { timeout: 5000 })
      .toBe(true);
    const snap = await read(page);
    expect(snap.companion.blocked).toBe(false);
    crossings.push({
      地点: name,
      主角: snap.state.player,
      黑猫: snap.companion,
    });
    await page.screenshot({ path: `${directory}/${name}.png` });
  }
  await move(page, 1110, 750);
  await move(page, 1110, 450);
  await reached(
    "court-entry",
    (s) => s.companion.y < 630 && s.companion.x > 1050 && s.companion.x < 1170,
  );
  await move(page, 1180, 560);
  await expect.poll(async () => (await read(page)).target).toBe("herb-v1");
  await page.keyboard.press("e");
  await expect
    .poll(async () => (await read(page)).state.collected["herb-v1"])
    .toBeDefined();
  await move(page, 1110, 750);
  await move(page, 1390, 860);
  await move(page, 1600, 860);
  await reached(
    "north-bank",
    (s) => s.companion.x > 1450 && s.companion.y < 890,
  );
  await move(page, 1640, 860);
  await move(page, 1640, 560);
  await reached(
    "field-entry",
    (s) => s.companion.y < 740 && s.companion.x > 1603 && s.companion.x < 1707,
  );
  expect((await read(page)).trainingTargets).toBe(4);
  await move(page, 1680, 700);
  await expect
    .poll(async () => (await read(page)).target)
    .toBe("training-guide");
  await page.keyboard.press("e");
  await expect(page.locator("#modal")).toContainText("练习场须知");
  await page.getByRole("button", { name: "继续 · E" }).click();
  await move(page, 1640, 860);
  await move(page, 1760, 900);
  await move(page, 1870, 920);
  // 从两柱北侧直向南走，验证连续碰撞确实停在脚底外，而非只断言模型。
  for (const side of ["west", "east"]) {
    const post = props.find((p) => p.id === `village-gate-post-${side}`)!;
    await move(page, post.x, 950);
    await page.keyboard.down("s");
    await page.waitForTimeout(650);
    await page.keyboard.up("s");
    const s = await read(page);
    expect(s.state.player.y).toBeGreaterThan(960);
    expect(s.state.player.y).toBeLessThanOrEqual(974.1);
    expect(s.companion.blocked).toBe(false);
    await page.screenshot({ path: `${directory}/gate-post-${side}.png` });
    await move(page, post.x, 950);
  }
  await move(page, 1870, 920);
  await move(page, 1870, 1130);
  await reached(
    "gate-entry",
    (s) => s.companion.y > 1020 && Math.abs(s.companion.x - 1870) < 45,
  );
  await move(page, 1950, 1210);
  await expect
    .poll(async () => (await read(page)).target)
    .toBe("village-guide");
  await page.keyboard.press("e");
  await expect(page.locator("#modal")).toContainText("东村口路牌");
  await page.getByRole("button", { name: "继续 · E" }).click();
  await move(page, 1870, 1130);
  await page.keyboard.press("Escape");
  const trace = await page.evaluate(() => {
    clearInterval((window as any).__levelTraceTimer);
    return (window as any).__levelTrace;
  });
  expect(
    trace.every(
      (s: any) => !s.黑猫.blocked && !motionBlocked(s.主角.x, s.主角.y),
    ),
  ).toBe(true);
  for (let i = 1; i < trace.length; i++) {
    expect(clearMotionLine(trace[i - 1].主角, trace[i].主角)).toBe(true);
    expect(clearMotionLine(trace[i - 1].黑猫, trace[i].黑猫)).toBe(true);
  }
  const saved = (await read(page)).state;
  await page.getByRole("button", { name: "保存旅途", exact: true }).click();
  await expect(page.locator("#toast.show")).toContainText("旅途已保存");
  await page.reload();
  await page.getByRole("button", { name: "继续旅途" }).click();
  const loaded = (await read(page)).state;
  expect(loaded.player.x).toBeCloseTo(saved.player.x, 1);
  expect(loaded.player.y).toBeCloseTo(saved.player.y, 1);
  expect(loaded.bag).toEqual(saved.bag);
  expect(loaded.collected).toEqual(saved.collected);
  expect(loaded.quest).toBe(saved.quest);
  await move(page, 2140, 1130);
  expect((await read(page)).region).toBe("翡翠森林");
  expect((await read(page)).state.quest).toBe(2);
  expect(errors).toEqual([]);
  await writeFile(
    `${directory}/passage-trace.json`,
    JSON.stringify(trace, null, 2),
  );
  await writeFile(
    `${directory}/passages.json`,
    JSON.stringify(
      {
        结果: "通过",
        路径: crossings,
        保存重载: "位置、背包、采集记录和主线进度保持",
        出村: "真实步行触发森林主线",
        页面错误: errors,
      },
      null,
      2,
    ),
  );
});

test("普通画面和地图无工程标号，开发开关显式开启才出现", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "启程 · 新游戏" }).click();
  expect((await read(page)).layoutLabels).toBe(0);
  await page.keyboard.press("m");
  await expect(page.locator(".map-guide")).toContainText("药师小院");
  expect(await page.locator(".map-guide").innerText()).not.toMatch(
    /(?:^|\n)[A-G]\s/,
  );
  await page.goto("/?layoutDebug=1");
  await page.getByRole("button", { name: "启程 · 新游戏" }).click();
  expect((await read(page)).layoutLabels).toBe(7);
});
