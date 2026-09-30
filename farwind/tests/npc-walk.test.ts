import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { createHash } from "node:crypto";
import {
  NpcMotion,
  NPC_WALK,
  npcWalkPose,
  residentPose,
} from "../src/game/systems/npcAnimation";
import { initialState } from "../src/game/systems/state";

describe("NPC 实际位移步态", () => {
  it.each([30, 60, 120])("%i帧下六帧步态完整，暂停冻结，停步立即站稳", (hz) => {
    const motion = new NpcMotion(),
      frames = new Set<number>();
    motion.sample({ x: 0, y: 0 }, 0);
    for (let i = 1; i <= hz; i++) {
      motion.sample({ x: (i * 86) / hz, y: 0 }, (i * 1000) / hz);
      const pose = npcWalkPose("archer", motion);
      frames.add(pose.frame);
      expect(pose.texture).toBe("npc-motion-archer");
      expect(motion.direction).toBe(3);
      expect(motion.speed).toBeCloseTo(86);
    }
    expect([...frames].sort((a, b) => a - b)).toEqual([15, 16, 17, 18, 19, 20]);
    const paused = npcWalkPose("archer", motion),
      distance = motion.distance;
    motion.sample({ x: 86, y: 0 }, 1000);
    expect(npcWalkPose("archer", motion)).toEqual(paused);
    expect(motion.distance).toBe(distance);
    motion.sample({ x: 86, y: 0 }, 1100);
    expect(npcWalkPose("archer", motion).frame).toBe(14);
    expect(motion.speed).toBe(0);
  });

  it("进出房屋、上下塔和纠正站位不制造假步幅，随后能恢复行走", () => {
    const motion = new NpcMotion();
    motion.sample({ x: 670, y: 620, space: "village" }, 0);
    motion.sample({ x: 671, y: 620, space: "village" }, 20);
    expect(motion.distance).toBe(1);
    motion.sample({ x: 700, y: 910, space: "inn" }, 40);
    expect(motion.distance).toBe(0);
    expect(motion.action).toBe("idle");
    motion.sample({ x: 180, y: 1590, space: "village" }, 60, false);
    motion.sample({ x: 250, y: 1750, space: "village" }, 1860);
    expect(motion.distance).toBe(0);
    motion.sample({ x: 250, y: 1748, space: "village" }, 1890);
    expect(motion.direction).toBe(1);
    expect(npcWalkPose("archer", motion).frame).toBeGreaterThan(7);
    motion.sample({ x: 1200, y: 400, space: "village" }, 1900);
    expect(motion.distance).toBe(0);
  });

  it("整帧确实移动时保留行走；左右反向与近斜线朝向稳定", () => {
    const motion = new NpcMotion();
    motion.direction = 3;
    motion.sample({ x: 0, y: 0 }, 0);
    motion.sample({ x: 1.4, y: 1.4 + 1e-12 }, 16);
    expect(motion.action).toBe("walk");
    expect(motion.direction).toBe(3);
    const pose = npcWalkPose("healer", motion);
    motion.sample({ x: 1.4, y: 1.4 + 1e-12 }, 16);
    expect(npcWalkPose("healer", motion)).toEqual(pose);
    motion.sample({ x: 0, y: 1.4 }, 32);
    expect(motion.direction).toBe(2);
    motion.sample({ x: 0, y: -1 }, 64);
    expect(motion.direction).toBe(1);
  });

  it("工作、睡眠和倒地仍有独立姿态，移动不借用眨眼帧", () => {
    const n = initialState().life.people[1],
      motion = new NpcMotion();
    motion.sample(n.body!, 0);
    motion.sample({ ...n.body!, x: n.body!.x + 4 }, 50);
    expect(residentPose(n, motion).texture).toBe("npc-motion-healer");
    n.body!.health = "down";
    expect(residentPose(n, motion)).toEqual({ texture: "healer", frame: 0 });
  });
});

describe("NPC 图集真实透明、独立姿态与固定地面根", () => {
  it.each(NPC_WALK.ids)("%s二十一帧完整，边缘透明，脚底稳定", async (id) => {
    const file = `public/assets/npc-life/motion/${id}-walk.png`,
      meta = await sharp(file).metadata(),
      hashes = new Set<string>(),
      bottoms: number[] = [];
    expect([meta.width, meta.height, meta.hasAlpha]).toEqual([1120, 480, true]);
    for (let i = 0; i < 21; i++) {
      const data = await sharp(file)
        .extract({
          left: (i % 7) * 160,
          top: Math.floor(i / 7) * 160,
          width: 160,
          height: 160,
        })
        .ensureAlpha()
        .raw()
        .toBuffer();
      hashes.add(createHash("sha256").update(data).digest("hex"));
      let bottom = -1,
        clear = 0;
      for (let y = 0; y < 160; y++)
        for (let x = 0; x < 160; x++) {
          const alpha = data[(y * 160 + x) * 4 + 3];
          if (!alpha) clear++;
          if (alpha > 8) bottom = Math.max(bottom, y);
          if (x < 2 || x > 157 || y < 2 || y > 157) expect(alpha).toBe(0);
        }
      expect(clear).toBeGreaterThan(160 * 160 * 0.35);
      expect(bottom).toBeGreaterThanOrEqual(146);
      expect(bottom).toBeLessThan(149);
      bottoms.push(bottom);
    }
    expect(hashes.size).toBe(21);
    expect(Math.max(...bottoms) - Math.min(...bottoms)).toBeLessThanOrEqual(1);
  });
});
