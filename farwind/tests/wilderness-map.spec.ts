import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { move } from "./map-navigation";
import {SHORTCUTS,type ShortcutId} from "../src/data/maps/windbell/shortcuts";
import { syncMapGeometry } from "../src/data/world";
const root = process.env.FARWIND_MAP_EVIDENCE_ROOT ?? "docs/first-map/evidence-m2";
const read = (page: any) => page.evaluate(() => (window as any).__farwind());
// 全程从新游戏开始，调查、采集、扣料和开门均由正式交互产生。
test("FIRST-MAP-03", async ({ page }) => {
  test.setTimeout(600000);
  mkdirSync(root, { recursive: true });
  syncMapGeometry(false);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page
    .getByRole("button", { name: "启程 · 新游戏", exact: true })
    .click();
  await page.waitForFunction(() => (window as any).__farwind?.().mode === "");
  const report: any = {
    说明: "新游戏真实键鼠环行，未写入测试进度；截图是 M2 简化可玩地形，荒野内容仍在建设。",
    节点: [],
    错误: errors,
  };
  const snap = async (name: string, file: string) => {
    const d = await read(page);
    expect(d.ground.resident).toBeGreaterThan(0);
    expect(d.ground.heroDepth).toBeGreaterThan(d.ground.floorDepth);
    expect(d.ground.resident).toBeLessThanOrEqual(30);
    report.节点.push({
      名称: name,
      玩家: d.state.player,
      地图进度: d.state.mapProgress,
      区块: d.ground,
      守军: d.state.defense.guards,
    });
    await page.screenshot({ path: `${root}/${file}.png` });
    writeFileSync(
      `${root}/wilderness-browser.json`,
      JSON.stringify({ ...report, 结果: "进行中" }, null, 2),
    );
  };
  const repair=async(id:ShortcutId)=>{
    const d=SHORTCUTS.find(s=>s.id===id)!;await move(page,d.approach.x,d.approach.y);
    await page.waitForFunction(id=>(window as any).__farwind().target===`repair-${id}`,id);
    await page.keyboard.press("e");await page.getByRole("button",{name:/交付.*并修复/}).click();
    await page.waitForFunction(id=>(window as any).__farwind().state.mapProgress.shortcuts.includes(id),id);
    await page.keyboard.press("Escape");const state=(await read(page)).state;
    syncMapGeometry(state.mapProgress.westRoad==="open",state.mapProgress.shortcuts);
  };
  // 正常购买桥梁材料，使用正式价格、库存与保存交易。
  await move(page,900,1010);await page.waitForFunction(()=>(window as any).__farwind().target==="service-general");await page.keyboard.press("e");
  for(const [id,n] of [["wood",8],["stone",5]] as const){
    await page.getByLabel("物品",{exact:true}).selectOption(id);await page.locator("#shop-quantity").fill(String(n));
    await page.getByRole("button",{name:"核对交易",exact:true}).click();await page.getByRole("button",{name:"确认购买",exact:true}).click();
    await expect(page.locator("#shop-feedback")).toContainText("交易已完成并保存");
  }
  await page.getByRole("button",{name:"离开商店",exact:true}).click();
  await page.keyboard.press("m");
  await page.waitForFunction(() => (window as any).__farwind().mode === "map");
  await page.screenshot({ path: `${root}/world-map.png` });
  await page.keyboard.press("Escape");
  // 村中获取修门材料；没有授予背包物品。
  for (const [x, y, id] of [
    [380, 1340, "wood-v1"],
    [400, 1420, "wood-yard-2"],
    [1730, 1200, "stone-v1"],
  ] as const) {
    await move(page, x, y);
    await page.waitForFunction(
      (id) => (window as any).__farwind().target === id,
      id,
    );
    await page.keyboard.press("e");
  }
  await move(page, 820, 150);
  await move(page, 600, -250);
  await move(page, 830, -600);
  await snap("北部旧哨站", "north-outpost");
  await repair("north-pass");await move(page,1030,-170);await move(page,1030,20);await snap("北哨山道修复并穿越","north-pass");
  await move(page, -70, 120);
  await move(page, -390, 1120);
  await page.waitForFunction(
    () => (window as any).__farwind().target === "west-road-survey",
  );
  await page.keyboard.press("e");
  await page.waitForFunction(
    () => (window as any).__farwind().state.mapProgress.westRoad === "surveyed",
  );
  await page.keyboard.press("Escape");
  await move(page, -960, 1200);
  await snap("西部旧农庄与调查结果", "west-farm");
  // 关闭的西门保持实体阻挡，走南侧环线回村。
  await move(page, -70, 1890);
  await move(page, 900, 1900);
  await move(page, 900, 1650);
  await move(page, 230, 1500);
  await page.waitForFunction(
    () => (window as any).__farwind().target === "west-gate-sign",
  );
  await page.keyboard.press("e");
  await page
    .getByRole("button", { name: "交付木材×4、石材×2并修复", exact: true })
    .click();
  await page.waitForFunction(
    () => (window as any).__farwind().state.mapProgress.westRoad === "open",
  );
  await page.keyboard.press("Escape");
  syncMapGeometry(true,(await read(page)).state.mapProgress.shortcuts); // 仅同步键盘寻路器的本地碰撞副本，不写入浏览器或存档。
  await move(page, -70, 1430);
  await snap("西门已实际穿越", "west-gate-open");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "保存旅途", exact: true }).click();
  await expect(page.locator("#toast")).toContainText("已保存");
  await page.reload();
  await page.getByRole("button", { name: "继续旅途", exact: true }).click();
  await page.waitForFunction(() => (window as any).__farwind().mode === "");
  expect((await read(page)).state.mapProgress.westRoad).toBe("open");
  await move(page, 220, 1430);
  await move(page, 900, 1900);
  await move(page, 1000, 2450);
  await snap("南部芦苇渡桥", "south-wetland");
  await repair("south-weir");await move(page,1535,2910);await move(page,1535,2400);await snap("南部堤桥修复并穿越","south-weir");
  await move(page, 1800, 2300);
  await move(page, 2200, 1960);
  await move(page, 2800, 1740);
  await snap("东部溪谷南线", "east-valley");
  await move(page, 3370, 1700);
  await move(page, 3480, 800);
  await repair("east-corridor");await move(page,2700,555);await move(page,2270,555);await snap("遗迹回廊修复并穿越","east-corridor");
  await move(page, 3100, -300);
  await snap("远端遗迹入口", "ruins-approach");
  await move(page, 2230, 130);
  await move(page, 820, 150);
  await move(page, 670, 720);
  await snap("四向行程返村", "return-village");
  expect(errors).toEqual([]);
  expect((await read(page)).state.mapProgress.shortcuts).toHaveLength(3);
  report.结果 = "通过";
  report.最终状态 = (await read(page)).state;
  writeFileSync(
    `${root}/wilderness-browser.json`,
    JSON.stringify(report, null, 2),
  );
});
