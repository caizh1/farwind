import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { move } from "./map-navigation";

const evidence = "docs/xiaobao/evidence/escort";
// 真实新游戏默认战术：留距巡护、主动援护、撤离归队、等候和保存恢复。
test("XIAOBAO-ESCORT-01", async ({ page }) => {
  mkdirSync(evidence, { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const read = () => page.evaluate(() => (window as any).__farwind());
  const gap = (d: any) => Math.hypot(d.xiaobao.x - d.state.player.x, d.xiaobao.y - d.state.player.y);
  await page.goto("/");
  await page.getByRole("button", { name: "启程 · 新游戏", exact: true }).click();
  await page.waitForFunction(() => (window as any).__farwind?.().mode === "");
  await page.locator("#xiaobao-summary").click();
  await page.getByRole("button", { name: "与我出征", exact: true }).click();
  await page.waitForFunction(() => (window as any).__farwind().mode === "");
  expect((await read()).state.xiaobao).toMatchObject({ task: "follow", tactic: "steady", autoSupport: true });
  await move(page, 1420, 850);
  await page.waitForFunction(() => {
    const d = (window as any).__farwind();
    const distance = Math.hypot(d.xiaobao.x - d.state.player.x, d.xiaobao.y - d.state.player.y);
    return distance >= 120 && distance <= 220 && d.xiaobao.status === "留距巡护" && d.xiaobao.action === "idle";
  }, null, { timeout: 10000 });
  const settled = await read();
  await page.waitForTimeout(1500);
  const idle = await read();
  expect(Math.hypot(idle.xiaobao.x - settled.xiaobao.x, idle.xiaobao.y - settled.xiaobao.y)).toBeLessThan(1);
  expect(idle.xiaobao.action).toBe("idle");
  expect(idle.state.killed).toEqual([]);
  await page.screenshot({ path: `${evidence}/idle-spacing.png` });

  // 只通过正式键盘行军进入野怪感知范围，索敌、援护和掉落均由游戏产生。
  await move(page, 2550, 1100);
  await page.waitForFunction(() => (window as any).__farwind().xiaobao.metrics.hits > 0, null, { timeout: 20000 });
  await page.waitForFunction(() => (window as any).__farwind().state.killed.length > 0, null, { timeout: 20000 });
  const fought = await read();
  expect(fought.state.bag).not.toEqual(idle.state.bag);
  await page.screenshot({ path: `${evidence}/guard-combat.png` });
  await move(page, 1420, 850);
  await page.waitForFunction(() => {
    const d = (window as any).__farwind();
    return Math.hypot(d.xiaobao.x - d.state.player.x, d.xiaobao.y - d.state.player.y) <= 220 && d.xiaobao.targetId === null;
  });
  const returned = await read();
  await page.locator("#xiaobao-summary").click();
  await page.getByRole("button", { name: "在此等候", exact: true }).click();
  await page.waitForFunction(() => (window as any).__farwind().mode === "");
  const waiting = await read();
  await move(page, 1700, 850);
  const waited = await read();
  expect(Math.hypot(waited.xiaobao.x - waiting.xiaobao.x, waited.xiaobao.y - waiting.xiaobao.y)).toBeLessThan(1);
  await page.locator("#xiaobao-summary").click();
  await page.getByRole("button", { name: "归队", exact: true }).click();
  await page.waitForFunction(() => {
    const d = (window as any).__farwind();
    return d.mode === "" && Math.hypot(d.xiaobao.x - d.state.player.x, d.xiaobao.y - d.state.player.y) <= 220;
  });
  await page.keyboard.press("Escape");
  const saved = await read(), frozen = saved.xiaobao;
  await page.waitForTimeout(300);
  expect((await read()).xiaobao).toEqual(frozen);
  await page.getByRole("button", { name: "保存并返回标题", exact: true }).click();
  await page.waitForFunction(() => (window as any).__farwind().mode === "title");
  await page.reload();
  await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  await page.waitForFunction(() => (window as any).__farwind().mode === "");
  const restored = await read();
  expect(restored.state.xiaobao).toMatchObject({ task: "follow", tactic: "steady", autoSupport: true });
  expect(restored.state.killed).toEqual(saved.state.killed);
  expect(new Set(restored.state.killed).size).toBe(restored.state.killed.length);
  expect(gap(restored)).toBeLessThanOrEqual(220);
  expect(errors).toEqual([]);
  await page.screenshot({ path: `${evidence}/saved-escort.png` });
  writeFileSync(`${evidence}/browser-validation.json`, JSON.stringify({
    结果: "通过",
    说明: "当前源码固定构建，正式新游戏、默认稳健战术、真实按钮与键盘；未导入存档或修改运行状态。",
    巡护间距: gap(idle), 巡护: idle.xiaobao, 援护: fought.xiaobao,
    撤离间距: gap(returned), 等候位移: Math.hypot(waited.xiaobao.x - waiting.xiaobao.x, waited.xiaobao.y - waiting.xiaobao.y),
    恢复间距: gap(restored), 恢复: restored.state.xiaobao, 异常: errors,
  }, null, 2) + "\n");
});
