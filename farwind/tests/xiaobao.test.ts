import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { Xiaobao } from "../src/game/systems/xiaobao";
import { clearMotionLine, motionBlocked } from "../src/game/systems/obstacles";
import { XIAOBAO, xiaobaoPose } from "../src/data/xiaobao";
import { props } from "../src/data/world";

describe("小宝的真实动作与地面根", () => {
  it("完整日常走过当前地图合法路线，步态跟随真实位移，零时步冻结", () => {
    const c = new Xiaobao(), actions = new Set<string>();
    let previous = { x: c.x, y: c.y }, distance = 0;
    for (let i = 0; i < 3600; i++) {
      c.update(1000 / 60, 480, clearMotionLine);
      expect(motionBlocked(c.x, c.y)).toBe(false);
      expect(clearMotionLine(previous, c)).toBe(true);
      expect(props.some((p) => ["tree", "pink"].includes(p.art) && c.y < p.y - 15 && c.y > p.y - p.h && Math.abs(c.x - p.x) < p.w * 0.45)).toBe(false);
      distance += Math.hypot(c.x - previous.x, c.y - previous.y);
      previous = { x: c.x, y: c.y }; actions.add(c.action);
    }
    expect([...actions]).toEqual(expect.arrayContaining(["idle", "wave", "laugh", "bow", "meditate", "palm", "guard", "step", "walkDown", "walkUp", "walkSide"]));
    expect(distance).toBeGreaterThan(400);
    // 同一时步跨过拐角时，分段路程略大于两端直线距离。
    expect(c.motion.distance).toBeGreaterThanOrEqual(distance);
    expect(c.motion.distance - distance).toBeLessThan(1);
    const before = c.snapshot(); c.update(0, 480, clearMotionLine); expect(c.snapshot()).toEqual(before);
    expect(xiaobaoPose("walkSide", 100000, 0).frameIndex).toBe(0);
    expect(xiaobaoPose("walkSide", 0, XIAOBAO.stride / 2).frameIndex).toBe(3);
  });
  it("夜里小憩，演示不中途被夜色打断，结束后休息，重新开局清掉演示", () => {
    const c = new Xiaobao(); c.update(100, 1320, clearMotionLine); expect(c.action).toBe("sleep");
    c.perform("all", { x: 700, y: 755 }); const root = [c.x, c.y], actions = new Set<string>();
    for (let i = 0; i < 110; i++) { c.update(100, 1320, clearMotionLine); actions.add(c.action); expect([c.x, c.y]).toEqual(root); }
    expect([...actions]).toEqual(expect.arrayContaining(["bow", "palm", "guard", "step", "laugh", "wave", "sleep"]));
    expect(c.demonstration).toBe(false); expect(c.action).toBe("sleep");
    c.update(100, 480, clearMotionLine); expect(c.action).toBe("idle");
    c.perform("step", { x: 900, y: 755 }); c.reset(); expect(c.demonstration).toBe(false); expect(c.pose.lift).toBe(0);
  });
  it("阻挡时不播放行走或累积步幅；大帧不能穿过障碍", () => {
    const c = new Xiaobao(); c.update(3000, 480, clearMotionLine); c.update(3000, 480, clearMotionLine); c.update(3000, 480, clearMotionLine); c.update(1200, 480, clearMotionLine);
    const before = { x: c.x, y: c.y, distance: c.motion.distance };
    for (let i = 0; i < 5; i++) c.update(200, 480, () => false);
    expect({ x: c.x, y: c.y, distance: c.motion.distance }).toEqual(before); expect(c.action).toBe("idle");
  });
  for (const sheet of ["motion", "social", "mastery"]) it(`${sheet}保留24个不同透明帧，完整主体与固定脚底`, async () => {
    const file = `public/assets/xiaobao/${sheet}.png`, meta = await sharp(file).metadata();
    expect([meta.width, meta.height, meta.hasAlpha]).toEqual([960, 640, true]);
    const hashes = new Set<string>();
    for (let i = 0; i < 24; i++) {
      const data = await sharp(file).extract({ left: i % 6 * 160, top: Math.floor(i / 6) * 160, width: 160, height: 160 }).raw().toBuffer();
      hashes.add(createHash("sha256").update(data).digest("hex"));
      let visible = 0, bottom = 0;
      for (let y = 0; y < 160; y++) for (let x = 0; x < 160; x++) {
        const alpha = data[(y * 160 + x) * 4 + 3];
        if (alpha > 8) { visible++; bottom = Math.max(bottom, y); }
        if (x < 3 || x > 156 || y < 3 || y > 156) expect(alpha).toBe(0);
      }
      expect(visible).toBeGreaterThan(2000); expect(bottom).toBeGreaterThanOrEqual(145); expect(bottom).toBeLessThan(149);
    }
    expect(hashes.size).toBe(24);
  });
});
