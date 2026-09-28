import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { initialState, validate } from "../src/game/systems/state";
import { enemyDefs } from "../src/data/world";
import { clearMeleeLine, motionBlocked } from "../src/game/systems/obstacles";

const root = "docs/xiaobao/evidence/effect-save";
for (const scenario of [
  { skill: "star", label: "自动弹星指", age: 220 },
  { skill: "rock", label: "落石压制", age: 1100 },
  { skill: "fire", label: "火域封路", age: 2100 },
  { skill: "unity", label: "五行归元", age: 3220 },
]) {
  test(`正式${scenario.label}中途存档：保持实例阶段、剩余冷却与唯一掉落`, async ({ page }) => {
    mkdirSync(root, { recursive: true });
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    const enemy = enemyDefs.find(e => e.type === "boar")!, state = initialState();
    const player = [-55, -65, -45].flatMap(dy => [0, -20, 20].map(dx => ({ x: enemy.x + dx, y: enemy.y + dy })))
      .find(p => !motionBlocked(p.x, p.y) && clearMeleeLine(p, enemy))!;
    const companion = [140, -140, 120, -120].map(dx => ({ x: player.x + dx, y: player.y + 24 }))
      .find(p => !motionBlocked(p.x, p.y) && clearMeleeLine(p, enemy))!;
    expect(player).toBeTruthy(); expect(companion).toBeTruthy();
    Object.assign(state.player, player);
    state.killed = enemyDefs.filter(e => e.id !== enemy.id).map(e => e.id);
    Object.assign(state.xiaobao, companion, { task: "follow", autoSupport: false, recovery: 1800 });
    const valid = validate(state);
    writeFileSync(`${root}/${scenario.skill}-initial-save.json`, JSON.stringify(valid, null, 2) + "\n");
    await page.goto("/");
    page.once("dialog", d => d.accept());
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "导入存档", exact: true }).click();
    await (await chooser).setFiles({ name: "effect-save.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(valid)) });
    await page.waitForFunction(() => { const d = (window as any).__farwind(); return d.mode === "" && d.state.time > 480.1 && !d.defenseSaving; });
    const read = () => page.evaluate(() => (window as any).__farwind());
    if (scenario.skill !== "star") {
      await page.keyboard.press("j");
      await page.waitForFunction(id => (window as any).__farwind().skillGrowth.enemies.find((e: any) => e.id === id)?.hp < 90, enemy.id, { polling: 5, timeout: 3000 });
      await page.locator("#xiaobao-summary").click();
      await page.getByRole("button", { name: scenario.label, exact: true }).click();
      await page.waitForFunction(() => (window as any).__farwind().mode === "");
    }
    await page.waitForFunction(({ skill, age }) => (window as any).__farwind().state.xiaobao.effects.some((e: any) => e.skill === skill && e.age >= age), scenario, { polling: 5, timeout: 10000 });
    await page.keyboard.press("Escape");
    const frozen = await read(), saved = frozen.state.xiaobao.effects.find((e: any) => e.skill === scenario.skill);
    expect(saved, "正式实例必须仍在运行").toBeTruthy();
    if (scenario.skill === "rock") expect(saved.stage).toBe(2);
    if (scenario.skill === "fire") expect(saved.stage).toBe(3);
    if (scenario.skill === "unity") expect(saved.stage).toBe(6);
    writeFileSync(`${root}/${scenario.skill}-live-save.json`, JSON.stringify(validate(frozen.state), null, 2) + "\n");
    await page.waitForTimeout(100);
    expect((await read()).state.xiaobao.effects).toEqual(frozen.state.xiaobao.effects);
    await page.screenshot({ path: `${root}/${scenario.skill}-paused.png` });
    await page.getByRole("button", { name: "保存并返回标题", exact: true }).click();
    await page.waitForFunction(() => (window as any).__farwind().mode === "title");
    await page.reload();
    await page.getByRole("button", { name: "继续旅途", exact: true }).click();
    const restored = await read(), effect = restored.state.xiaobao.effects.find((e: any) => e.id === saved.id);
    writeFileSync(`${root}/${scenario.skill}-restored-diagnosis.json`, JSON.stringify({ 说明: "实际刷新后的首因快照", 保存时: frozen, 恢复时: restored }, null, 2) + "\n");
    expect(effect, "读档必须恢复同一实例").toBeTruthy();
    expect(effect.age).toBeGreaterThanOrEqual(saved.age);
    expect(effect.stage).toBeGreaterThanOrEqual(saved.stage);
    for (const key of saved.hit) expect(effect.hit).toContain(key);
    expect(restored.state.xiaobao.cooldowns[scenario.skill]).toBeGreaterThan(0);
    expect(restored.state.xiaobao.cooldowns[scenario.skill]).toBeLessThanOrEqual(frozen.state.xiaobao.cooldowns[scenario.skill]);
    expect(restored.state.xiaobao.qi).toBeGreaterThanOrEqual(frozen.state.xiaobao.qi);
    for (const affected of frozen.state.xiaobao.affected) {
      const actual = restored.skillGrowth.enemies.find((e: any) => e.id === affected.id);
      expect(actual.hp).toBe(affected.hp);
      expect(Math.hypot(actual.x - affected.x, actual.y - affected.y)).toBeLessThan(5);
    }
    await page.waitForFunction(id => !(window as any).__farwind().state.xiaobao.effects.some((e: any) => e.id === id), saved.id, { timeout: 6000 });
    const effectEnded = await read();
    writeFileSync(`${root}/${scenario.skill}-finished-diagnosis.json`, JSON.stringify({ 说明: "正式实例结束现场，未注入命中或击退", 现场: effectEnded }, null, 2) + "\n");
    // 投射物是扫掠弹道，敌人实际躲开可以无伤害；最终唯一奖励由后续真实战斗检查。
    await page.waitForFunction(id => (window as any).__farwind().state.killed.includes(id), enemy.id, { timeout: 12000 });
    const finished = await read();
    expect(finished.state.killed.filter((id: string) => id === enemy.id)).toHaveLength(1);
    expect(finished.state.bag.filter((i: any) => i?.id === "berry").reduce((n: number, i: any) => n + i.count, 0)).toBe(1);
    expect(finished.state.pendingDrops.filter((d: any) => d.enemyId === enemy.id)).toHaveLength(0);
    expect(finished.xiaobao.objects).toBe(6);
    expect(errors).toEqual([]);
    writeFileSync(`${root}/${scenario.skill}.json`, JSON.stringify({ 结果: "通过", 说明: "合法历史站位与击退记录只隔离原始90生命棘甲林豕，起始1800毫秒恢复是测试前提。自动弹星指或真实J攻击后界面指令产生正式实例；阶段、暂停、保存标题刷新和剩余结算由游戏推进。范围技能高伤害已在前段击退目标，后段无存活目标不再命中，仍验证领域及奖励不重放。", 技能: scenario.label, 保存时: frozen, 恢复时: restored, 完成时: finished, 异常: errors }, null, 2) + "\n");
  });
}
