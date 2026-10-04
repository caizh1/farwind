import { describe, it, expect } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { initialState, add, count, craft, maxCraftQuantity } from '../src/game/systems/state';
import { economySnapshot, EconomyCommit } from '../src/game/systems/economy';

describe('行囊批量配药与保存', () => {
  it('用户截图样本：九瓶一笔事务，扣料正确并持久化', async () => {
    const s = initialState();
    s.coins = 863;
    s.player.hp = 50;
    s.bag = [
      { id: 'stone', count: 10 }, { id: 'crystal', count: 12 }, { id: 'herb', count: 16 },
      { id: 'berry', count: 18 }, { id: 'wood', count: 17 }, { id: 'charm', count: 1 },
      { id: 'potion', count: 6 }, { id: 'berry', count: 20 }, { id: 'berry', count: 20 },
      { id: 'wood', count: 5 }, { id: 'berry', count: 11 }, { id: 'herb', count: 2 },
      ...Array(12).fill(null),
    ];
    mkdirSync('docs/bag-redesign/evidence', { recursive: true });
    writeFileSync('docs/bag-redesign/evidence/bag-fixture.json', JSON.stringify(s));
    expect(maxCraftQuantity(s)).toBe(9);
    let state = s, writes = 0;
    await new EconomyCommit().run(() => state, { sequence: 1, kind: 'craft', quantity: 9 }, async next => {
      writes++;
      expect(count(next, 'potion')).toBe(15);
      expect(count(state, 'potion')).toBe(6);
    }, next => state = next);
    expect([count(state, 'herb'), count(state, 'berry'), count(state, 'potion'), state.economyRevision, writes]).toEqual([0, 60, 15, 1, 1]);
    expect(state.coins).toBe(863);
  });
  it('满包大批量消耗材料腾出空间，不能按小批量失败断言最大为零', () => {
    const s = initialState();
    s.bag = Array.from({ length: 24 }, () => ({ id: 'wood', count: 20 }));
    s.bag[0] = { id: 'herb', count: 20 };
    s.bag[1] = { id: 'berry', count: 20 };
    const before = structuredClone(s);
    expect(craft({ ...s }, 1)).toBe(false);
    expect(maxCraftQuantity(s)).toBe(10);
    expect(s).toEqual(before);
    const next = economySnapshot(s, { sequence: 1, kind: 'craft', quantity: 10 });
    expect([count(next, 'potion'), count(next, 'herb'), count(next, 'berry')]).toEqual([10, 0, 10]);
  });
  it('跨药剂堆叠并利用材料格；完全放不下时整批不扣料', () => {
    const s = initialState();
    s.bag = Array.from({ length: 24 }, () => ({ id: 'wood', count: 20 }));
    s.bag[0] = { id: 'herb', count: 11 };
    s.bag[1] = { id: 'berry', count: 11 };
    s.bag[2] = { id: 'potion', count: 19 };
    const before = structuredClone(s);
    expect(maxCraftQuantity(s)).toBe(1);
    expect(() => economySnapshot(s, { sequence: 1, kind: 'craft', quantity: 5 })).toThrow('成品空间');
    expect(s).toEqual(before);
    s.bag[0]!.count = 10;
    const next = economySnapshot(s, { sequence: 1, kind: 'craft', quantity: 5 });
    expect(count(next, 'potion')).toBe(24);
  });
  it.each([0, -1, 1.5, NaN, Infinity, 241, null])('数量%s无效，状态完整保留', quantity => {
    const s = initialState(); add(s, 'herb', 20); add(s, 'berry', 20);
    const before = structuredClone(s);
    expect(() => economySnapshot(s, { sequence: 1, kind: 'craft', quantity: quantity as number })).toThrow('制作数量');
    expect(s).toEqual(before);
  });
  it('批量缺料和保存失败均不发布，重复提交不能重复扣料', async () => {
    let state = initialState(); add(state, 'herb', 12); add(state, 'berry', 6);
    const before = structuredClone(state), commit = new EconomyCommit();
    expect(() => economySnapshot(state, { sequence: 1, kind: 'craft', quantity: 7 })).toThrow('未扣材料');
    await expect(commit.run(() => state, { sequence: 1, kind: 'craft', quantity: 6 }, async () => { throw Error('磁盘写入失败'); }, next => state = next)).rejects.toThrow('磁盘写入失败');
    expect(state).toEqual(before);
    state = economySnapshot(state, { sequence: 1, kind: 'craft', quantity: 6 });
    expect(() => economySnapshot(state, { sequence: 1, kind: 'craft', quantity: 6 })).toThrow('已处理');
    expect(count(state, 'potion')).toBe(6);
  });
  it('快捷栏绑定和丢弃通过保存事务，保护任务材料', async () => {
    let state = initialState(); add(state, 'potion', 3); add(state, 'crystal', 1);
    const before = structuredClone(state);
    await expect(new EconomyCommit().run(() => state, { sequence: 1, kind: 'discard', item: 'potion' }, async () => { throw Error('写入失败'); }, next => state = next)).rejects.toThrow();
    expect(state).toEqual(before);
    state = economySnapshot(state, { sequence: 1, kind: 'bind', item: 'potion', slot: 7 });
    expect(state.hotbar[7]).toBe('potion');
    state = economySnapshot(state, { sequence: 2, kind: 'discard', item: 'potion' });
    expect(count(state, 'potion')).toBe(2);
    expect(() => economySnapshot(state, { sequence: 3, kind: 'discard', item: 'crystal' })).toThrow('任务材料');
    expect(() => economySnapshot(state, { sequence: 3, kind: 'bind', item: 'potion', slot: 8 })).toThrow('有效快捷栏');
    expect(() => economySnapshot(state, { sequence: 3, kind: 'bind', item: 'crystal', slot: 0 })).toThrow('消耗品');
  });
});
