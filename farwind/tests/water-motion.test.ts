import { describe, it, expect } from "vitest";
import { EnvironmentClock, WATER, fountainPoint, ripplePhase, lilyAnchors, waterContains, clearOfBridges, fitWaterPatch, pondSurfaceStrength } from "../src/game/systems/waterMotion";
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
  it("局部水纹完整运动包围矩形被同一POND边界包含", () => {
    for (let i = 0; i < WATER.pond.glints+WATER.pond.ripples; i++) {
      const a = i * 2.39996, r = 0.25 + i % 5 * 0.135;
      const glint = i < WATER.pond.glints, size = glint ? WATER.pond.glintSize : WATER.pond.rippleSize, scale = glint ? 1.3 : 1.5;
      const w = size[0]*scale/2, h = size[1]*scale/2;
      const p = fitWaterPatch(POND.x + Math.cos(a)*POND.rx*r, POND.y + Math.sin(a)*POND.ry*r, w, h);
      for (const x of [-w,w]) for (const y of [-h,h]) expect(waterContains(p.x+x,p.y+y,10)).toBe(true);
    }
  });
  it("岸内固定带的水面采样完全不动，内侧连续过渡，最大位移不会采出原图", () => {
    expect(pondSurfaceStrength(POND.x,POND.y)).toBe(1);
    for (let angle=0;angle<Math.PI*2;angle+=0.1) {
      const edge = {x:POND.x+Math.cos(angle)*POND.rx,y:POND.y+Math.sin(angle)*POND.ry};
      expect(pondSurfaceStrength(edge.x,edge.y)).toBe(0);
      expect(pondSurfaceStrength(POND.x+(edge.x-POND.x)*0.96,POND.y+(edge.y-POND.y)*0.96)).toBe(0);
    }
    for(let x=POND.x-POND.rx;x<=POND.x+POND.rx;x+=2)for(let y=POND.y-POND.ry;y<=POND.y+POND.ry;y+=2) {
      const strength=pondSurfaceStrength(x,y);expect(strength).toBeGreaterThanOrEqual(0);expect(strength).toBeLessThanOrEqual(1);
      if(!waterContains(x,y))continue;
      const dx=strength*WATER.pond.surface.amplitude[0],dy=strength*WATER.pond.surface.amplitude[1];
      expect(x-dx).toBeGreaterThanOrEqual(POND.x-POND.rx);expect(x+dx).toBeLessThanOrEqual(POND.x+POND.rx);
      expect(y-dy).toBeGreaterThanOrEqual(POND.y-POND.ry);expect(y+dy).toBeLessThanOrEqual(POND.y+POND.ry);
    }
  });
});
