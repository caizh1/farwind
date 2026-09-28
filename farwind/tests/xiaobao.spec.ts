import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { move } from "./map-navigation";
import { XIAOBAO_CLIPS } from "../src/data/xiaobao";
import { HOMES } from "../src/data/npcLife";
const evidence = process.env.XIAOBAO_PRODUCTION === "1" ? "docs/xiaobao/evidence/production" : "docs/xiaobao/evidence";
test("小宝：十二组固定预览、真实键盘交谈演武、暂停恢复、刷新与室内隔离", async ({ page }) => {
  mkdirSync(evidence, { recursive: true });
  const errors: string[] = [], badAssets: string[] = [], actions = new Set<string>();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => { if (r.url().includes("/assets/xiaobao/") && r.status() !== 200) badAssets.push(r.url()); });
  await page.goto("/xiaobao-preview.html");
  await page.waitForFunction(() => Boolean((window as any).__xiaobaoPreview));
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  for (const [key, clip] of Object.entries(XIAOBAO_CLIPS)) {
    await page.getByLabel("选择动作").selectOption(key);
    const a = await page.evaluate(() => (window as any).__xiaobaoPreview());
    expect(a.pose.texture).toBe(`xiaobao-${clip.sheet}`); expect(a.pose.frame).toBe(clip.row * 6);
    await page.getByRole("slider").fill(String(Math.floor(clip.duration / 2)));
    const b = await page.evaluate(() => (window as any).__xiaobaoPreview());
    expect(b.pose.frameIndex).toBeGreaterThan(0); expect(b.roots).toEqual(a.roots); actions.add(key);
  }
  await page.getByLabel("选择动作").selectOption("wave");
  await page.getByRole("slider").fill("500");
  await page.screenshot({ path: `${evidence}/fixed-preview.png`, fullPage: true, animations: "disabled" });
  await page.goto("/");
  await page.getByRole("button", { name: "启程 · 新游戏", exact: true }).click();
  await page.waitForFunction(() => (window as any).__farwind?.().mode === "");
  const read = () => page.evaluate(() => (window as any).__farwind());
  expect((await read()).xiaobao.visible).toBe(true);
  await page.waitForFunction(() => (window as any).__farwind().xiaobao.action.startsWith("walk"), null, { timeout: 15000 });
  const walking = (await read()).xiaobao;
  await page.waitForTimeout(200);
  const walked = (await read()).xiaobao;
  expect(Math.hypot(walked.x - walking.x, walked.y - walking.y)).toBeGreaterThan(3);
  expect(walked.distance).toBeGreaterThan(walking.distance); expect(walked.frameIndex).not.toBe(walking.frameIndex);
  // 站到散步路线中部；旧坐标仅在小宝经过交互半径边缘时短暂可交谈，
  // 等待条件成立到真实E输入之间的渲染帧会让移动人物离开95像素范围。
  await move(page, 835, 705);
  await page.waitForFunction(() => (window as any).__farwind().target === "xiaobao");
  await page.keyboard.press("e");
  await expect(page.getByRole("heading", { name: "小宝 · 听风小宗师", exact: true })).toBeVisible();
  await expect(page.locator(".dialogue-portrait img")).toHaveAttribute("src", "/assets/xiaobao/portrait.webp");
  await page.screenshot({ path: `${evidence}/world-dialog.png`, animations: "disabled" });
  const before = (await read()).xiaobao;
  await page.waitForTimeout(400);
  expect((await read()).xiaobao).toEqual(before);
  // 窄屏仍能阅读正文、看见立绘与演示入口，按钮留在正常文档流中。
  await page.setViewportSize({ width: 600, height: 420 });
  const panel = page.getByRole("dialog"), buttons = page.locator(".xiaobao-actions button");
  const geometry = await panel.evaluate((element) => {
    const p = element.getBoundingClientRect(), text = element.querySelector("#dialog-text")!.getBoundingClientRect();
    return { left: p.left, right: p.right, top: p.top, bottom: p.bottom, textHeight: text.height, buttons: [...element.querySelectorAll(".xiaobao-actions button")].map((b) => { const r = b.getBoundingClientRect(); return { left: r.left, right: r.right, position: getComputedStyle(b).position }; }) };
  });
  expect(geometry.left).toBeGreaterThanOrEqual(0); expect(geometry.right).toBeLessThanOrEqual(600); expect(geometry.bottom).toBeLessThanOrEqual(420); expect(geometry.textHeight).toBeGreaterThan(30);
  for (const b of geometry.buttons) { expect(b.position).not.toBe("absolute"); expect(b.left).toBeGreaterThanOrEqual(geometry.left); expect(b.right).toBeLessThanOrEqual(geometry.right); }
  await expect(buttons).toHaveCount(3); await page.screenshot({ path: `${evidence}/dialog-narrow.png`, animations: "disabled" });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole("button", { name: "看一套小宗师演武", exact: true }).click();
  await page.waitForFunction(() => (window as any).__farwind().xiaobao.demonstration);
  const demoRoot = (await read()).xiaobao;
  const seen = new Set<string>();
  const captured = new Set<string>();
  for (let i = 0; i < 42; i++) {
    const c = (await read()).xiaobao; seen.add(c.action);
    expect(c.x).toBeCloseTo(demoRoot.x); expect(c.y).toBeCloseTo(demoRoot.y);
    if (["palm", "step"].includes(c.action) && c.frameIndex === 3 && !captured.has(c.action)) {
      await page.screenshot({ path: `${evidence}/world-${c.action}.png`, animations: "disabled" }); captured.add(c.action);
    }
    await page.waitForTimeout(160);
  }
  expect([...seen]).toEqual(expect.arrayContaining(["bow", "palm", "guard", "step", "laugh", "wave"]));
  await page.screenshot({ path: `${evidence}/world-npc.png` });
  await page.keyboard.press("Escape");
  const paused = (await read()).xiaobao; await page.waitForTimeout(350); expect((await read()).xiaobao).toEqual(paused);
  await page.keyboard.press("Escape"); await page.waitForTimeout(300); expect((await read()).xiaobao.elapsed).not.toBe(paused.elapsed);
  // 真实敲门进入住户空间，不能把广场小宝画进室内。
  const home = HOMES.find((h) => h.id === "elder-home")!;
  await move(page, home.door.x, home.door.y + 30);
  await page.waitForFunction(() => (window as any).__farwind().target === "life-door:elder-home");
  await page.keyboard.press("e");
  await page.waitForFunction(() => (window as any).__farwind().mode === "dialog" || (window as any).__farwind().state.life.playerSpace !== "village");
  if ((await read()).mode === "dialog") {
    await expect(page.getByText(/门内传来回应/)).toBeVisible();
    await page.getByRole("button", { name: "继续 · E", exact: true }).click();
    await page.waitForFunction(() => (window as any).__farwind().mode === "", null, { timeout: 10000 });
    await page.keyboard.press("e");
  }
  await page.waitForFunction(() => (window as any).__farwind().state.life.playerSpace !== "village", null, { timeout: 10000 });
  await page.waitForFunction(() => !(window as any).__farwind().xiaobao.visible);
  await page.screenshot({ path: `${evidence}/indoor-isolation.png` });
  await page.waitForFunction(() => !(window as any).__farwind().defenseSaving);
  const savedSpace = (await read()).state.life.playerSpace;
  await page.reload();
  await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  await page.waitForFunction(() => (window as any).__farwind().mode === "");
  expect((await read()).state.life.playerSpace).toBe(savedSpace); expect((await read()).xiaobao.visible).toBe(false);
  expect(errors).toEqual([]); expect(badAssets).toEqual([]);
  writeFileSync(`${evidence}/browser.json`, JSON.stringify({ 结果: "通过", 固定预览动作数: actions.size, 自主行走: { 起点: [walking.x, walking.y], 终点: [walked.x, walked.y], 姿态: [walking.frameIndex, walked.frameIndex] }, 演武观察: [...seen].map((k) => XIAOBAO_CLIPS[k as keyof typeof XIAOBAO_CLIPS].name), 验证: ["真实新游戏与键盘走到小宝", "真实自主行走与步态切换", "E交谈与认可原画的对话立绘", "对话和暂停冻结，恢复继续", "演武地面根保持，轻步只抬素材", "600×420正常文档流按钮与可读正文", "室内隐藏广场人物", "刷新后继续存档，室内隔离仍正确"], 浏览器异常: errors, 资源错误: badAssets }, null, 2) + "\n");
});
