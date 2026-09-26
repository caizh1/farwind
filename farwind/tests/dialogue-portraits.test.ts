import { describe, it, expect, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { dialoguePortraitFor, dialoguePortraits } from "../src/data/dialoguePortraits";
import { props } from "../src/data/world";
import { interact } from "../src/game/systems/interactions";
import { add, count, initialState } from "../src/game/systems/state";
import type { World } from "../src/game/scenes/World";

describe("独立立绘与资源边界", () => {
  it("三个稳定标识映射不同资源，文本和未知标识不借用别人的脸", () => {
    expect(new Set(Object.values(dialoguePortraits).map(p => p.src)).size).toBe(3);
    for (const id of ["sign", "rune", "cat", "unknown", "__proto__", "constructor", "小满", ""])
      expect(dialoguePortraitFor(id)).toBeUndefined();
  });
  for (const id of ["healer", "elder", "carpenter"] as const) {
    it(`${id}：运行素材尺寸、透明通道与登记一致`, async () => {
      const path = `public${dialoguePortraits[id].src}`;
      const metadata = await sharp(path).metadata();
      expect([metadata.width, metadata.height, metadata.hasAlpha]).toEqual([768, 1152, true]);
      const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const alpha = Array.from({ length: info.width * info.height }, (_, i) => data[i * 4 + 3]);
      expect(Math.min(...alpha.slice(0, info.width))).toBe(0);
      expect(alpha.slice(0, info.width).every(a => a === 0)).toBe(true);
      expect(alpha.filter(a => a === 0).length / alpha.length).toBeGreaterThan(0.15);
      expect(alpha.filter(a => a > 250).length / alpha.length).toBeGreaterThan(0.3);
      const manifest = JSON.parse(await readFile("public/assets/manifest.json", "utf8"));
      expect(manifest.资源.find((p: any) => p.ID === `dialogue-${id}-neutral`)).toMatchObject({
        文件: `portraits/${id}-neutral.webp`, 尺寸: [768, 1152], 透明通道: true,
        动画: null, 是否临时: true,
      });
    });
  }
  it("三个世界图集保持修改前字节", async () => {
    const hashes = {
      healer: "1f127613b13a02650e85d21eff1f1bfb9d41f7520a79e32b066230f9396c8bb2",
      elder: "dfb05b012f699dbdee89c24db54a517aab47d3ed54aceef89c4592a651b902cb",
      carpenter: "77098adee26a33ca92c2792861e275fb6ee6108499408cd6d9c7ef5d7cbc2921",
    };
    for (const [id, expected] of Object.entries(hashes))
      expect(createHash("sha256").update(await readFile(`public/assets/${id}.png`)).digest("hex")).toBe(expected);
  });
});

function fixture() {
  return {
    state: initialState(), ui: { dialog: vi.fn(), message: vi.fn() },
    soundFx: { play: vi.fn() }, persist: vi.fn().mockResolvedValue(undefined),
  };
}
function talk(world: ReturnType<typeof fixture>, id: string) {
  interact.call(world as unknown as World, props.find(p => p.id === id)!);
}

describe("立绘展示参数不增加任务副作用", () => {
  it("药师兑换一次，继续交谈材料不足时不重复扣除或奖励", () => {
    const w = fixture();
    w.state.quest = 2;
    add(w.state, "herb", 2); add(w.state, "berry", 1);
    talk(w, "healer");
    expect([count(w.state, "herb"), count(w.state, "berry"), count(w.state, "potion"), w.state.quest]).toEqual([0, 0, 1, 3]);
    expect(w.ui.dialog).toHaveBeenLastCalledWith("药师 · 小满", expect.any(String), "healer");
    const before = structuredClone(w.state);
    talk(w, "healer");
    expect(w.state).toEqual(before);
    expect(w.persist).toHaveBeenCalledTimes(2);
  });
  it("药剂没有空间时保留材料与任务", () => {
    const w = fixture();
    w.state.bag = Array.from({ length: 24 }, () => ({ id: "wood", count: 20 }));
    w.state.bag[0] = { id: "herb", count: 3 };
    w.state.bag[1] = { id: "berry", count: 2 };
    const before = structuredClone(w.state);
    talk(w, "healer");
    expect(w.state).toEqual(before);
  });
  it("长者接受任务及末尾奖励保留原次数，重复交谈不重复发奖", () => {
    const w = fixture();
    talk(w, "elder");
    expect(w.state.quest).toBe(1);
    expect(w.ui.dialog).toHaveBeenLastCalledWith("守风人 · 岚爷爷", expect.any(String), "elder");
    talk(w, "elder");
    expect(w.state.quest).toBe(1);
    w.state.quest = 6;
    const saves = w.persist.mock.calls.length;
    talk(w, "elder");
    expect(w.persist.mock.calls.length - saves).toBe(2); // 保留现有奖励分支与居民通用保存。
    expect([w.state.quest, count(w.state, "potion")]).toEqual([7, 3]);
    talk(w, "elder");
    expect(count(w.state, "potion")).toBe(3);
  });
  it("木匠只扣四份木材并发一次浆果", () => {
    const w = fixture();
    talk(w, "carpenter");
    expect(w.state.side).toBe(1);
    expect(w.ui.dialog).toHaveBeenLastCalledWith("木匠 · 阿禾", expect.any(String), "carpenter");
    add(w.state, "wood", 4);
    talk(w, "carpenter");
    expect([w.state.side, count(w.state, "wood"), count(w.state, "berry")]).toEqual([2, 0, 5]);
    talk(w, "carpenter");
    expect(count(w.state, "berry")).toBe(5);
    expect(w.persist).toHaveBeenCalledTimes(3);
  });
  it("路牌与碑文调用保留无居民来源，状态不变", () => {
    const w = fixture(), before = structuredClone(w.state);
    talk(w, "village-guide");
    expect(w.ui.dialog.mock.calls.at(-1)).toHaveLength(2);
    talk(w, "clue");
    expect(w.ui.dialog).toHaveBeenLastCalledWith("被风磨亮的碑文", expect.any(String), "rune");
    expect(w.state).toEqual(before);
    expect(w.persist).not.toHaveBeenCalled();
  });
});
