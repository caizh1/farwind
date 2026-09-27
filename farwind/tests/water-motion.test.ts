import { describe, it, expect } from "vitest";
import { EnvironmentClock, WATER, fountainPoint, ripplePhase, lilyAnchors, waterContains, clearOfBridges, fitWaterPatch } from "../src/game/systems/waterMotion";
import { POND, BRIDGES, props } from "../src/data/world";

describe("独立环境水效时钟", () => {
  it("只推进有效游玩delta，暂停与隐藏后的首帧不补算", () => {
    const clock = new EnvironmentClock();
    expect(clock.advance(16, true)).toBe(0);
    clock.advance(16, true); expect(clock.time).toBe(16);
    clock.advance(9000, false); expect(clock.time).toBe(16);
    clock.advance(9000, true); expect(clock.time).toBe(16);
    clock.advance(20, true); expect(clock.time).toBe(36);
    clock.advance(9000, true); expect(clock.time).toBe(36 + WATER.maxDelta);
    clock.advance(-5, true); clock.advance(Infinity, true); expect(clock.time).toBe(86);
    clock.reset(); expect(clock.time).toBe(0); expect(clock.running).toBe(false);
  });

});
describe("水效几何与动画周期", () => {
  it("涟漪只向外扩散，在重生边界完全透明，不缩回", () => {
    const points = [0, 200, 800, 1500, 2199].map(t => ripplePhase(t, 2200));
    expect(points[0].alpha).toBe(0);
    for (let i = 1; i < points.length; i++) expect(points[i].scale).toBeGreaterThan(points[i-1].scale);
    expect(points.at(-1)!.alpha).toBeLessThan(0.001);
    expect(ripplePhase(2200, 2200).alpha).toBe(0);
  });
  it("喷泉位置来自实际prop显示原点与尺寸，移动或缩放不会依赖旧世界坐标", () => {
    const p = props.find(p => p.id === "plaza-fountain")!;
    const image = { x: p.x, y: p.y, displayWidth: p.w, displayHeight: p.h, originX: 0.5, originY: 1 };
    const at = fountainPoint(image, 120, 241);
    expect(at.x).toBeCloseTo(655); expect(at.y).toBeCloseTo(840.33333);
    const resized = fountainPoint({ ...image, x: 1000, y: 1200, displayWidth: 260, displayHeight: 260 }, 120, 241);
    expect(resized.x-1000).toBeCloseTo((at.x-p.x)*2);
    expect(resized.y-1200).toBeCloseTo((at.y-p.y)*2);
  });
  it("荷叶保留18个旧锚点，最大浮动仍在池内；桥下锚点不会显示穿桥", () => {
    const anchors = lilyAnchors(); expect(anchors).toHaveLength(18);
    expect(anchors.filter(a => a.flower)).toHaveLength(6);
    for (const a of anchors) for (const offset of [-WATER.pond.lilyAmplitude, WATER.pond.lilyAmplitude])
      expect(waterContains(a.x, a.y + offset, 12)).toBe(true);
    expect(clearOfBridges(BRIDGES[0].x+20, BRIDGES[0].y+20)).toBe(false);
    expect(waterContains(POND.x+POND.rx, POND.y)).toBe(false);
    expect(waterContains(POND.x, POND.y)).toBe(true);
  });
  it("局部水纹完整运动包围矩形被同一POND边界包含，不必逐帧重画或整池滤镜", () => {
    for (let i = 0; i < 22; i++) {
      const a = i * 2.39996, r = 0.25 + i % 5 * 0.135;
      const w = i < 12 ? (110 + i % 3 * 15) / 2 + 5 : i < 19 ? 42 * 1.3 / 2 + 5 : 22 * 1.5 / 2 + 5;
      const h = i < 12 ? 62 / 2 + 2 : i < 19 ? 18 * 1.3 / 2 + 2 : 10 * 1.5 / 2 + 2;
      const p = fitWaterPatch(POND.x + Math.cos(a)*POND.rx*r, POND.y + Math.sin(a)*POND.ry*r, w, h);
      for (const x of [-w,w]) for (const y of [-h,h]) expect(waterContains(p.x+x,p.y+y,10)).toBe(true);
    }
  });
});
