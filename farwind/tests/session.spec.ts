import { move } from "./map-navigation";
import { test, expect, type Page } from "@playwright/test";
const read = (p: Page) => p.evaluate(() => (window as any).__farwind());
async function hold(p: Page, key: string, ms: number) {
  await p.keyboard.down(key);
  await p.waitForTimeout(ms);
  const s = await read(p);
  await p.keyboard.up(key);
  return s;
}
async function title(p: Page) {
  await p.keyboard.press("Escape");
  await p.getByRole("button", { name: "保存并返回标题" }).click();
  await expect(p.getByRole("button", { name: "启程 · 新游戏" })).toBeVisible();
}
async function moving(p: Page) {
  await expect(p.locator("#modal")).toBeHidden();
  await p.keyboard.down("d");
  await expect
    .poll(async () => (await read(p)).animation.hero.action)
    .toBe("walk");
  await p.keyboard.up("d");
  await expect
    .poll(async () => (await read(p)).animation.hero.action)
    .toBe("idle");
}
test("session-sprint-recovery", async ({ page }) => {
  await page.goto("/?animationDebug=1");
  await page.getByRole("button", { name: "启程 · 新游戏" }).click();
  await expect
    .poll(async () => (await read(page)).session.sim)
    .toBeGreaterThan(200);
  await page.keyboard.press("Escape");
  await page.locator("#pause-help").click();
  await expect(page.locator(".controls-guide")).toContainText("按住空格并移动");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.keyboard.down("Shift");
  await page.keyboard.down("a");
  await expect
    .poll(async () => (await read(page)).animation.hero.speed)
    .toBeCloseTo(150, 0);
  const oldKey = await read(page);
  expect(oldKey.animation.hero.action).toBe("walk");
  await page.keyboard.up("a");
  await page.keyboard.up("Shift");
  await expect
    .poll(async () => (await read(page)).animation.hero.action)
    .toBe("idle");
  const stationary = await hold(page, "Space", 180);
  expect(stationary.animation.hero.action).toBe("idle");
  expect(stationary.session.combat.dashCooldownRemaining).toBe(0);
  const sprintStart = (await read(page)).session.sim;
  const transitions: any[] = [];
  // 逐实际渲染帧读取，避免50毫秒墙钟轮询漏掉切换边界而缩短实测周期。
  await page.evaluate(()=>{
    const trace:{sim:number;体力:number;动作:string}[]=[],observer={active:true};
    (window as any).__sprintObservation={trace,observer};
    let last:string|undefined;
    const sample=()=>{if(!observer.active)return;const s=(window as any).__farwind(),action=s.session.exhausted?"walk":"run";
      if(["walk","run"].includes(action)&&action!==last){trace.push({sim:s.session.sim,体力:s.state.player.stamina,动作:action});last=action;}
      requestAnimationFrame(sample);};requestAnimationFrame(sample);
  });
  await page.keyboard.down("Space");
  for (let n = 0; n < 32; n++) {
    const key = n % 2 ? "d" : "a";
    await page.keyboard.down(key);
    await expect
      .poll(async () => (await read(page)).animation.hero.speed, {
        intervals: [16, 32, 50],
      })
      .toBeGreaterThan(100);
    if (n === 0) {
      expect((await read(page)).animation.hero.action).toBe("run");
      await page.keyboard.up("Space");
      await expect
        .poll(async () => (await read(page)).animation.hero.action)
        .toBe("walk");
      await page.keyboard.down("Space");
      await expect
        .poll(async () => (await read(page)).animation.hero.action)
        .toBe("run");
    }
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(50);
      const s = await read(page),
        a = s.animation.hero.action;
      expect(["walk", "run"]).toContain(a);

      if (
        s.session.exhausted &&
        s.state.player.stamina > 3 &&
        s.state.player.stamina < 15
      ) {
        await page.keyboard.up("Space");
        await page.keyboard.down("Space");
        expect(s.animation.hero.action).toBe("walk");
      }
    }
    await page.keyboard.up(key);
  }
  const sampled=await page.evaluate(()=>{const observation=(window as any).__sprintObservation;observation.observer.active=false;return observation.trace;});
  // 转向松键可产生短时动画切换；耗尽周期读取生产锁存状态，保留800毫秒门槛。
  transitions.push(...sampled);
  for(let i=1;i<transitions.length;i++)expect(transitions[i].sim-transitions[i-1].sim).toBeGreaterThan(800);
  await page.keyboard.up("Space");
  expect(transitions.length).toBeGreaterThan(4);
  // 同机运行软件GPU时墙钟与模拟时长不同，以实际模拟时间约束切换数量。
  expect(transitions.length).toBeLessThanOrEqual(
    Math.ceil(((await read(page)).session.sim - sprintStart) / 800) + 1,
  );
  await page.keyboard.press("Escape");
  await expect(page.getByText("世界与时间已暂停。")).toBeVisible();
  const paused = await read(page);
  await hold(page, "d", 400);
  expect((await read(page)).session).toEqual(paused.session);
  await page.keyboard.press("Escape");
  await moving(page);
});
test("session-title-continue-new-refresh", async ({ page }) => {
  await page.goto("/?animationDebug=1");
  await page.getByRole("button", { name: "启程 · 新游戏" }).click();
  await page.waitForTimeout(3000);
  await page.keyboard.press("j");
  await expect
    .poll(async () => (await read(page)).animation.hero.action, {
      intervals: [16, 32, 50],
    })
    .toBe("attack");
  await expect
    .poll(async () => (await read(page)).animation.hero.action)
    .toBe("idle");
  const saved = (await read(page)).state;
  await title(page);
  await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  await page.waitForTimeout(100);
  expect((await read(page)).session.attackUntil).toBe(0);
  expect((await read(page)).state.bag).toEqual(saved.bag);
  await moving(page);
  // 当前地图的药草位于药师小院，通过正常通行路线到达，不设置游戏状态。
  await move(page, 1180, 560);
  await expect.poll(async () => (await read(page)).target).toBe("herb-v1");
  await page.keyboard.press("e");
  await expect
    .poll(async () => (await read(page)).state.collected["herb-v1"])
    .toBeDefined();
  await expect
    .poll(async () => (await read(page)).animation.hero.action)
    .toBe("idle");
  await title(page);
  await page.getByRole("button", { name: "启程 · 新游戏" }).click();
  await page.getByRole("button", { name: "确认新游戏" }).click();
  await page.waitForTimeout(100);
  expect((await read(page)).session.attackUntil).toBe(0);
  await moving(page);
  await title(page);
  await page.reload();
  await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  await moving(page);
  await page.keyboard.press("j");
  await expect
    .poll(async () => (await read(page)).animation.hero.action, {
      intervals: [16, 32, 50],
    })
    .toBe("attack");
  await expect
    .poll(async () => (await read(page)).animation.hero.action)
    .toBe("idle");
  await page.keyboard.press("Tab");
  await expect(page.getByText("旅人的行囊", { exact: true })).toBeVisible();
  await page.keyboard.press("Tab");
});
