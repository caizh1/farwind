import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { initialState } from "../src/game/systems/state";
import { EastDefense } from "../src/game/systems/defense";
import { NpcLife } from "../src/game/systems/npcLife";
import { NpcMotion, residentPose } from "../src/game/systems/npcAnimation";

describe("职业素材与实际行动", () => {
  it("工作帧跟随进度，暂停不推进，移动或取消立即回到原角色图集", () => {
    const s = initialState();
    s.time = 540;
    const l = new NpcLife(s, new EastDefense(s.defense, 0)),
      n = s.life.people[1], motion = new NpcMotion();
    l.begin(
      n,
      l.candidates(n).find((c) => c.facility === "pharmacy")!,
    );
    n.action!.phase = "perform";
    n.action!.progress = 610;
    expect(residentPose(n, motion)).toEqual({
      texture: "healer-work",
      frame: 2,
    });
    const still = residentPose(n, motion);
    motion.sample({ x: 0, y: 0 }, 10000);
    expect(residentPose(n, motion)).toEqual(still);
    motion.update({ dx: 5, dy: 0, dt: 0.05 });
    expect(residentPose(n, motion).texture).toBe("npc-motion-healer");
    motion.reset();
    n.action!.kind = "treat";
    expect(residentPose(n, motion).texture).toBe("npc-motion-healer");
    l.cancel(n, "验收中断");
    motion.direction = 0;
    expect(residentPose(n, motion)).toEqual({
      texture: "npc-motion-healer",
      frame: 0,
    });
  });
  for (const id of ["elder", "healer", "carpenter"])
    it(`${id}四帧保留透明边缘、真实动作差异与固定脚底`, async () => {
      const file = `public/assets/npc-life/${id}-work.png`,
        meta = await sharp(file).metadata();
      expect([meta.width, meta.height]).toEqual([512, 128]);
      expect(meta.hasAlpha).toBe(true);
      const frames: Buffer[] = [],
        bottoms: number[] = [];
      for (let i = 0; i < 4; i++) {
        const data = await sharp(file)
          .extract({ left: i * 128, top: 0, width: 128, height: 128 })
          .raw()
          .toBuffer();
        frames.push(data);
        let bottom = -1;
        for (let y = 0; y < 128; y++)
          for (let x = 0; x < 128; x++)
            if (data[(y * 128 + x) * 4 + 3] > 8) bottom = Math.max(bottom, y);
        bottoms.push(bottom);
        for (let y = 0; y < 128; y++)
          expect(data[y * 128 * 4 + 3] + data[(y * 128 + 127) * 4 + 3]).toBe(0);
      }
      expect(new Set(frames.map((f) => f.toString("base64"))).size).toBe(4);
      expect(Math.max(...bottoms) - Math.min(...bottoms)).toBeLessThanOrEqual(
        1,
      );
    });
  it("家具具有真实透明通道且保持源图比例", async () => {
    for (const id of ["bed", "table"]) {
      const file = `public/assets/npc-life/${id}.png`,
        m = await sharp(file).metadata();
      const { data, info } = await sharp(file)
        .raw()
        .toBuffer({ resolveWithObject: true });
      expect(m.hasAlpha).toBe(true);
      expect(data[3]).toBe(0);
      let visible = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i] > 8) visible++;
      expect(visible).toBeGreaterThan(info.width * info.height * 0.2);
      expect(visible).toBeLessThan(info.width * info.height * 0.9);
      expect(id === "bed" ? m.height! > m.width! : m.width! > m.height!).toBe(
        true,
      );
    }
  });
});
