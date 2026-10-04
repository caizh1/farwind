import { describe, expect, it } from 'vitest';
import { WORLD } from '../src/data/world';
import { initialState } from '../src/game/systems/state';
import { minimapView } from '../src/game/ui/minimap';

describe('小地图真实坐标投影', () => {
  it('桥头使用玩家真实坐标并保持等比例', () => {
    const s = initialState();
    s.player.x = 7100; s.player.y = 1600;
    const before = structuredClone(s);
    const v = minimapView(s);
    expect(v.camera.x).toBe(7100); expect(v.camera.y).toBe(1600);
    expect(v.width / v.height).toBeCloseTo(2 / 1);
    expect(v.width * v.camera.scale).toBe(320);
    expect(v.height * v.camera.scale).toBe(160);
    expect(s).toEqual(before);
  });
  it('世界四角保留可见玩家，视野不会越过支持边界', () => {
    for (const x of [WORLD.left + 24, WORLD.right - 24]) for (const y of [WORLD.top + 24, WORLD.bottom - 24]) {
      const s = initialState(); s.player.x = x; s.player.y = y;
      const v = minimapView(s);
      expect(v.left).toBeGreaterThanOrEqual(WORLD.left);
      expect(v.top).toBeGreaterThanOrEqual(WORLD.top);
      expect(v.left + v.width).toBeLessThanOrEqual(WORLD.right);
      expect(v.top + v.height).toBeLessThanOrEqual(WORLD.bottom);
      expect(x).toBeGreaterThan(v.left); expect(x).toBeLessThan(v.left + v.width);
      expect(y).toBeGreaterThan(v.top); expect(y).toBeLessThan(v.top + v.height);
    }
  });
  it('室内显示室外入口，不采用独立室内坐标', () => {
    const s = initialState(); s.life.playerSpace = 'general-shop';
    s.life.outside = { x: 1060, y: 790 }; s.player.x = 700; s.player.y = 910;
    const v = minimapView(s);
    expect(v.player).toEqual(s.life.outside);
    expect(v.player.x).toBeGreaterThan(v.left); expect(v.player.x).toBeLessThan(v.left + v.width);
    expect(v.player.y).toBeGreaterThan(v.top); expect(v.player.y).toBeLessThan(v.top + v.height);
  });
});
