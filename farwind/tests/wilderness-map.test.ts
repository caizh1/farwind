import {localPath} from "../src/game/systems/enemy";
import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {SHORTCUTS,SHORTCUT_IDS} from "../src/data/maps/windbell/shortcuts";
import {StateCommit} from "../src/game/systems/stateCommit";
import { makeNightPlan } from "../src/game/systems/nightDirector";
import { afterEach, describe, it, expect } from "vitest";
import {
  WORLD_BOUNDS as B,
  WORLD_PLAYABLE as P,
  CURRENT_MAP_VERSION,
} from "../src/data/maps/windbell/bounds";
import {
  WILDERNESS_PROPS,
  WILDERNESS_ROADS,
  WILDERNESS_POIS,
  WILD_WATERS,
  WILD_BRIDGES,
} from "../src/data/maps/windbell/wilderness";
import {
  props,
  terrainBlocked,
  syncMapGeometry,
  mapGeometryRevision,
} from "../src/data/world";
import { regionAt } from "../src/data/village";
import { GUARD_DEFS, RAID_GATES, TOWERS } from "../src/data/defense";
import {
  FACILITIES,
  PRIVATE_STORAGE,
  GUARD_LANDINGS,
  HOMES,
} from "../src/data/npcLife";
import {
  motionBlocked,
  clearMotionLine,
  shotLineImpact,
} from "../src/game/systems/obstacles";
import { roomBlocked, spaceClear } from "../src/game/systems/npcNavigation";
import {
  initialState,
  validate,
  parseSave,
  add,
  count,
} from "../src/game/systems/state";
import { repairShortcutSnapshot, westRoadSnapshot } from "../src/game/systems/mapTravel";
import { groundChunks } from "../src/game/systems/terrainChunks";
import { spawnLegal } from "../src/game/systems/defense";
afterEach(() => syncMapGeometry(false));
describe("四向地图与西侧旧道", () => {
  it("荒野物件引用已登记的真实素材，不显示丢失纹理占位块",()=>{
    const manifest=JSON.parse(readFileSync("public/assets/manifest.json","utf8"));const ids=new Set(manifest.资源.map((v:{ID:string})=>v.ID));
    expect(WILDERNESS_PROPS.filter(p=>!ids.has(p.art)).map(p=>[p.id,p.art])).toEqual([]);
  });
  it("全图、区域、负坐标及区块使用一致边界", () => {
    expect(B.width * B.height).toBe(6400 * 4800);
    for (const p of WILDERNESS_POIS) {
      expect(regionAt(p).id, p.id).toBe(p.region);
      expect(terrainBlocked(p.x, p.y), p.id).toBe(false);
    }
    for (const p of [
      { x: -1800, y: 900 },
      { x: 500, y: -900 },
      { x: 900, y: 3100 },
      { x: 4000, y: 1500 },
    ]) {
      const s = initialState();
      Object.assign(s.player, p);
      Object.assign(s.xiaobao, p);
      expect(parseSave(JSON.stringify(s)).player).toEqual(s.player);
      const chunks = groundChunks(
        {
          left: p.x - 640,
          right: p.x + 640,
          top: p.y - 360,
          bottom: p.y + 360,
        },
        B.width,
        B.height,
        1,
        { x: B.left, y: B.top },
      );
      expect(chunks.length).toBeLessThanOrEqual(30);
      expect(
        chunks.some(
          (c) => p.x >= c.x && p.x < c.x + 600 && p.y >= c.y && p.y < c.y + 550,
        ),
      ).toBe(true);
    }
    const waiting=initialState();waiting.xiaobao.wait={x:-500,y:1000,region:"west"};
    expect(validate(waiting).xiaobao.wait).toEqual(waiting.xiaobao.wait);
    const s = initialState();
    s.player.x = P.left - 1;
    expect(() => validate(s)).toThrow();
    expect(
      shotLineImpact(
        { x: P.left + 10, y: 1000 },
        { x: P.left - 20, y: 1000 },
        undefined,
        [],
      )?.id,
    ).toBe("world-edge");
  });
  it("24处内容预留点都能从村庄经真实地面到达，西门关闭也可绕行", () => {
    const step = 40,
      cols = B.width / step,
      rows = B.height / step;
    const key = (x: number, y: number) =>
      Math.round((y - B.top) / step) * cols + Math.round((x - B.left) / step);
    const point = (n: number) => ({
      x: B.left + (n % cols) * step,
      y: B.top + Math.floor(n / cols) * step,
    });
    const start = key(670, 720),
      queue = [start],
      seen = new Set([start]);
    for (let i = 0; i < queue.length; i++) {
      const n = queue[i],
        a = point(n);
      for (const delta of [-1, 1, -cols, cols]) {
        const k = n + delta,
          b = point(k);
        if (
          k < 0 ||
          k >= cols * rows ||
          Math.hypot(b.x - a.x, b.y - a.y) > step + 1 ||
          seen.has(k) ||
          motionBlocked(b.x, b.y) ||
          !clearMotionLine(a, b)
        )
          continue;
        seen.add(k);
        queue.push(k);
      }
    }
    for (const p of [
      ...WILDERNESS_POIS,
      { id: "旧道路口调查位", x: -390, y: 1120 },
    ])
      expect(
        queue.some((n) => {
          const q = point(n);
          return (
            Math.hypot(p.x - q.x, p.y - q.y) <= 70 && clearMotionLine(p, q)
          );
        }),
        p.id,
      ).toBe(true);
  });
  it("所有主路中线使用实际碰撞检查，不把水面画成可走路", () => {
    syncMapGeometry(true,SHORTCUT_IDS);
    const conflicts: string[] = [];
    for (const r of WILDERNESS_ROADS)
      for (let i = 1; i < r.points.length; i++) {
        const a = r.points[i - 1],
          b = r.points[i],
          n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 16);
        for (let j = 0; j <= n; j++) {
          const x = a[0] + ((b[0] - a[0]) * j) / n,
            y = a[1] + ((b[1] - a[1]) * j) / n;
          if (motionBlocked(x, y)) {
            conflicts.push(
              `${r.id} ${Math.round(x)},${Math.round(y)} ${props.filter((p) => p.solid && Math.abs(p.x - x) < p.solid[0] / 2 + 12 && y > p.y - p.solid[1] - 10 && y < p.y + 10).map((p) => p.id)}`,
            );
            break;
          }
        }
      }
    expect(conflicts).toEqual([]);
  });
  it("桥面能过，水面和长线段不能穿越", () => {
    syncMapGeometry(true,SHORTCUT_IDS);
    for (const b of WILD_BRIDGES) {
      expect(terrainBlocked(b.x + b.w / 2, b.y + b.h / 2)).toBe(false);
      expect(
        clearMotionLine(
          b.w>b.h?{x:b.x-15,y:b.y+b.h/2}:{ x: b.x + b.w / 2, y: b.y - 15 },
          b.w>b.h?{x:b.x+b.w+15,y:b.y+b.h/2}:{ x: b.x + b.w / 2, y: b.y + b.h + 15 },
        ),
      ).toBe(true);
    }
    for (const p of WILD_WATERS) {
      const x = p.x + p.rx * 0.6, y=p.id==="east-cliff-pool"?p.y-180:p.y;
      expect(terrainBlocked(x, y)).toBe(true);
      expect(
        clearMotionLine({ x, y: p.y - p.ry - 40 }, { x, y: p.y + p.ry + 40 }),
      ).toBe(false);
    }
  });
  it("西门调查与修复持久化，一次扣料且原守军伤亡保持", () => {
    const s = initialState();
    expect(s.schema_version).toBe(16);
    expect(s.map_version).toBe(CURRENT_MAP_VERSION);
    s.player.x = -390;
    s.player.y = 1120;
    const surveyed = westRoadSnapshot(s, "survey");
    expect(s.mapProgress.westRoad).toBe("unknown");
    expect(parseSave(JSON.stringify(surveyed)).mapProgress.westRoad).toBe(
      "surveyed",
    );
    surveyed.player.x = 180;
    surveyed.player.y = 1540;
    add(surveyed, "wood", 4);
    add(surveyed, "stone", 2);
    surveyed.defense.guards[0].hp = 91;
    const opened = westRoadSnapshot(surveyed, "repair");
    expect(opened.mapProgress.westRoad).toBe("open");
    expect(count(opened, "wood")).toBe(0);
    expect(count(surveyed, "wood")).toBe(4);
    expect(opened.defense.guards[0].hp).toBe(91);
    expect(() => westRoadSnapshot(opened, "repair")).toThrow();
    const saved = parseSave(JSON.stringify(opened));
    syncMapGeometry(false);
    expect(motionBlocked(80, 1430)).toBe(true);
    const revision = mapGeometryRevision;
    syncMapGeometry(saved.mapProgress.westRoad === "open");
    expect(mapGeometryRevision).toBeGreaterThan(revision);
    expect(clearMotionLine({ x: -30, y: 1430 }, { x: 240, y: 1430 })).toBe(
      true,
    );
    syncMapGeometry(false);
    expect(clearMotionLine({ x: -30, y: 1430 }, { x: 240, y: 1430 })).toBe(
      false,
    );
  });
  it("三处捷径修复有真实通行收益，保存失败不扣料，读档不重复奖励",async()=>{
    for(const d of SHORTCUTS){
      let s=initialState();Object.assign(s.player,d.approach);add(s,"wood",8);add(s,"stone",8);
      const before=structuredClone(s);syncMapGeometry(false);
      expect(motionBlocked(d.barrier.x,d.barrier.y-d.barrier.h/2),d.id).toBe(true);
      await expect(new StateCommit().run(()=>s,v=>repairShortcutSnapshot(v,d.id),async()=>{throw Error("保存失败样本");},v=>s=v)).rejects.toThrow("保存失败样本");
      expect(s).toEqual(before);
      s=parseSave(JSON.stringify(repairShortcutSnapshot(s,d.id)));
      syncMapGeometry(false,s.mapProgress.shortcuts);
      expect(motionBlocked(d.barrier.x,d.barrier.y-d.barrier.h/2),d.id).toBe(false);
      expect(()=>repairShortcutSnapshot(s,d.id)).toThrow("已经修复");expect(validate(s)).toEqual(s);
      const a=d.id!=="east-corridor"?{x:d.barrier.x,y:d.barrier.y-d.barrier.h-40}:{x:d.barrier.x-60,y:d.barrier.y-d.barrier.h/2};
      const b=d.id!=="east-corridor"?{x:d.barrier.x,y:d.barrier.y+40}:{x:d.barrier.x+60,y:d.barrier.y-d.barrier.h/2};
      expect(clearMotionLine(a,b),d.id).toBe(true);syncMapGeometry(false);expect(clearMotionLine(a,b),d.id).toBe(false);
    }
  });
  it("三条修复捷径分别缩短实际碰撞路径，不只是地图上的连线",()=>{
    const cases=[{id:"north-pass",a:{x:1030,y:-380},b:{x:1030,y:20}},{id:"south-weir",a:{x:1535,y:2380},b:{x:1535,y:2910}},{id:"east-corridor",a:{x:2270,y:555},b:{x:2720,y:555}}] as const;
    const evidence=cases.map(({id,a,b})=>{
      const length=(open:boolean)=>{syncMapGeometry(false,open?[id]:[]);const route=localPath(a,p=>Math.hypot(p.x-b.x,p.y-b.y)<16&&clearMotionLine(p,b),b,()=>true,undefined,{radius:1800,nodes:12000});expect(route.path,id).not.toBeNull();let last:{x:number;y:number}=a,total=0;for(const p of [...route.path!,b]){total+=Math.hypot(p.x-last.x,p.y-last.y);last=p;}return total;};
      const before=length(false),after=length(true);expect(before-after,id).toBeGreaterThan(150);return {捷径:id,修复前像素:Math.round(before),修复后像素:Math.round(after),减少像素:Math.round(before-after)};
    });const evidenceRoot=process.env.FARWIND_MAP_EVIDENCE_ROOT??".first-map-local/checks";mkdirSync(evidenceRoot,{recursive:true});writeFileSync(`${evidenceRoot}/shortcut-distances.json`,JSON.stringify({说明:"正式碰撞下的八向局部导航路径长度；不是玩家盲测耗时。",结果:evidence},null,2));
  });
  it("四方向都能生成安静和待定夜计划，门选择不与安静判定共享取模", () => {
    const s = initialState(),
      seen = new Map(RAID_GATES.map((g) => [g.id, new Set<string>()]));
    for (let seed = 1; seed <= 500; seed++) {
      s.defense.seed = seed;
      const p = makeNightPlan(s, 2);
      seen.get(p.gate)!.add(p.outcome);
    }
    for (const [gate, outcomes] of seen)
      expect([...outcomes].sort(), gate).toEqual(["pending", "quiet"]);
  });
  it("四门、十二人、独立床箱与西门返岗落点完整", () => {
    expect(RAID_GATES).toHaveLength(4);
    expect(GUARD_DEFS).toHaveLength(12);
    expect(new Set(props.map((p) => p.id)).size).toBe(props.length);
    for (const g of GUARD_DEFS) {
      const bed = FACILITIES.find((f) => f.id === `bed:${g.id}`)!,
        box = PRIVATE_STORAGE.find((b) => b.owner === g.id)!;
      expect(bed).toBeTruthy();
      expect(box).toBeTruthy();
      expect(
        roomBlocked("barracks", bed.place.x, bed.place.y),
        g.id + "床边",
      ).toBe(false);
      expect(
        roomBlocked("barracks", box.use.x, box.use.y),
        g.id + "储物箱前",
      ).toBe(false);
      if (g.role === "melee")
        expect(
          motionBlocked(g.post.x, g.post.y),
          g.id +
            "岗位 " +
            JSON.stringify(
              props
                .filter(
                  (p) =>
                    p.solid &&
                    Math.abs(p.x - g.post.x) < p.solid[0] / 2 + 12 &&
                    g.post.y > p.y - p.solid[1] - 10 &&
                    g.post.y < p.y + 10,
                )
                .map((p) => p.id),
            ),
        ).toBe(false);
    }
    expect(
      new Set(
        FACILITIES.filter(
          (f) => f.kind === "bed" && f.place.space === "barracks",
        ).map((f) => `${f.place.x}:${f.place.y}`),
      ).size,
    ).toBe(12);
    const landing = GUARD_LANDINGS["west-archer"]!;
    expect(
      motionBlocked(landing.x, landing.y),
      JSON.stringify(
        props
          .filter(
            (p) =>
              p.solid &&
              Math.abs(p.x - landing.x) < p.solid[0] / 2 + 12 &&
              landing.y > p.y - p.solid[1] - 10 &&
              landing.y < p.y + 10,
          )
          .map((p) => p.id),
      ),
    ).toBe(false);
    syncMapGeometry(true,SHORTCUT_IDS);
    for (const gate of RAID_GATES)
      expect(
        spawnLegal(gate.id, gate.spawns.slice(0, 3), { x: 670, y: 720 }),
        gate.id,
      ).toBe(true);
  });
});
