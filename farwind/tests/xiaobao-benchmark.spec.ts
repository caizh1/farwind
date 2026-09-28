import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { initialState, validate } from "../src/game/systems/state";
import { enemyDefs } from "../src/data/world";
import { enemyProfile } from "../src/data/enemies";
import { motionBlocked, clearMeleeLine } from "../src/game/systems/obstacles";
const root = "docs/xiaobao/evidence/benchmark";
test("五种普通敌人的固定基准：同站位、正式导入、真实J输入与自动随行介入对照", async ({
  page,
}) => {
  mkdirSync(root, { recursive: true });
  const records: any[] = [],
    errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  for (const type of ["slime", "leaf", "spore", "boar", "raven"]) {
    const enemy = enemyDefs.find(
      (e) => e.type === type && (type !== "slime" || e.id === "slime-2"),
    )!;
    const player = [-65, -55, -45]
      .flatMap((dy) =>
        [0, -20, 20, -40, 40].map((dx) => ({
          x: enemy.x + dx,
          y: enemy.y + dy,
        })),
      )
      .find((p) => !motionBlocked(p.x, p.y) && clearMeleeLine(p, enemy))!;
    expect(player, enemy.id).toBeDefined();
    for (const companion of [false, true]) {
      await page.goto("/");
      const s = initialState();
      Object.assign(s.player, player);
      s.quest = 3;
      s.killed = enemyDefs.filter((e) => e.id !== enemy.id).map((e) => e.id);
      s.xiaobao.task = companion ? "follow" : "free";
      s.xiaobao.autoSupport = false;
      if (companion) {
        const spot = [
          { x: player.x + 82, y: player.y + 24 },
          { x: player.x - 82, y: player.y + 24 },
          { x: player.x, y: player.y - 90 },
        ].find((p) => !motionBlocked(p.x, p.y) && clearMeleeLine(p, enemy))!;
        expect(spot).toBeDefined();
        Object.assign(s.xiaobao, spot);
      }
      const valid = validate(s);
      writeFileSync(
        root +
          "/" +
          enemy.id +
          (companion ? "-companion" : "-manual") +
          "-save.json",
        JSON.stringify(valid, null, 2) + "\n",
      );
      page.once("dialog", (d) => d.accept());
      const chooser = page.waitForEvent("filechooser");
      await page.getByRole("button", { name: "导入存档", exact: true }).click();
      await (
        await chooser
      ).setFiles({
        name: "benchmark-save.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(valid)),
      });
      await page.waitForFunction(() => (window as any).__farwind().mode === "");
      const start = Date.now();
      let inputs = 0,
        lastFacing = 0;
      while (Date.now() - start < 20000) {
        const d = await page.evaluate(() => (window as any).__farwind());
        if (d.state.killed.includes(enemy.id)) break;
        if (!companion) {
          const target = d.enemies.find((e: any) => e.id === enemy.id),
            dx = target.x - d.state.player.x,
            dy = target.y - d.state.player.y;
          const facing =
            Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 2 : 3) : dy < 0 ? 1 : 0;
          if (Math.hypot(dx, dy) > 70 || lastFacing !== facing) {
            const key = ["s", "w", "a", "d"][facing];
            await page.keyboard.down(key);
            await page.waitForTimeout(Math.hypot(dx, dy) > 70 ? 120 : 35);
            await page.keyboard.up(key);
            inputs++;
            lastFacing = facing;
          }
          await page.keyboard.press("j");
          inputs++;
        }
        await page.waitForTimeout(180);
      }
      const result = await page.evaluate(() => (window as any).__farwind());
      writeFileSync(
        root + "/last-scene.json",
        JSON.stringify(
          {
            说明: "当前真实输入场景，失败时保留首因",
            目标: enemy.id,
            随行: companion,
            输入: inputs,
            现场: result,
          },
          null,
          2,
        ) + "\n",
      );
      expect(
        result.state.killed.filter((id: string) => id === enemy.id),
      ).toHaveLength(1);
      expect(result.state.player.hp).toBeGreaterThan(0);
      records.push({
        敌人: enemyProfile(type).name,
        编号: enemy.id,
        模式: companion ? "自动随行" : "主角手工攻击",
        主动战斗输入数: inputs,
        墙钟耗时毫秒: Date.now() - start,
        主角生命: result.state.player.hp,
        小宝命中: result.xiaobao.metrics.hits,
        行囊: result.state.bag,
        地面掉落: result.state.pendingDrops,
      });
      writeFileSync(
        root + "/progress.json",
        JSON.stringify(
          { 说明: "五类真实输入基准进行中", 记录: records },
          null,
          2,
        ) + "\n",
      );
      await page.keyboard.press("Escape");
    }
  }
  const manual = records
      .filter((r) => r.模式 === "主角手工攻击")
      .reduce((n, r) => n + r.主动战斗输入数, 0),
    withCompanion = records
      .filter((r) => r.模式 === "自动随行")
      .reduce((n, r) => n + r.主动战斗输入数, 0);
  expect(manual).toBeGreaterThan(0);
  const reduction = 1 - withCompanion / manual;
  expect(reduction).toBeGreaterThanOrEqual(0.8);
  expect(errors).toEqual([]);
  writeFileSync(
    root + "/result.json",
    JSON.stringify(
      {
        结果: "通过",
        说明: "代表性固定单敌基准，正式五种野怪、相同合法站位与库存、原始HP及AI、真实J键。历史击退记录仅隔离非目标怪。主角手工循环代表可重复人工基线；自动随行未发攻击、护人或元素指令。准备存档、委托、探索移动不计入主动战斗输入。结论仅限这五个普通单敌场景，不外推复杂战场或所有人工阅读判断。",
        主角基线主动战斗输入: manual,
        自动随行主动战斗输入: withCompanion,
        减少比例: reduction,
        记录: records,
        异常: errors,
      },
      null,
      2,
    ) + "\n",
  );
}, 180000);
