import {INTERIOR_FURNITURE,INTERIOR_SERVICE} from '../../data/villageInteriors';
import type {ShopId} from '../../data/economy';
import {
  PEOPLE,
  HOMES,
  ROOM,
  PRIVATE_STORAGE,
  person,
  type ResidentId,
  type SpaceId,
} from "../../data/npcLife";
import type { World } from "../scenes/World";
import type { Prop } from "../../data/world";
export function lifeInteract(world: World, p: Prop) {
  if(p.id.startsWith("interior:")){
    const f=INTERIOR_FURNITURE.find(f=>`interior:${f.id}`===p.id&&f.space===world.state.life.playerSpace);
    if(!f) return false;
    if(f.shop) world.ui.shop(f.shop); else world.ui.dialog(f.label,f.description);
    return true;
  }
  if (p.id === "life-exit") {
    leaveRoom(world);
    return true;
  }
  if (p.id.startsWith("life-door:")) {
    const space = p.id.slice(10) as SpaceId;
    if (world.state.life.unavailable.homes[space]) {
      world.ui.dialog(
        HOMES.find((h) => h.id === space)!.name,
        "入口暂不可用。住户会寻找旅馆空床；可按居民笔记寻找最近见到的位置。已在室内的人仍可以从南门离开。",
      );
      return true;
    }
    if (!world.life.visit(space)) {
      world.ui.dialog(
        HOMES.find((h) => h.id === space)!.name,
        "门内传来回应：请稍候，已为你留出半小时的紧急拜访时间。再按 E 可以进入；这不允许取用私人储物。",
      );
      return true;
    }
    const l = world.state.life;
    l.outside = { x: world.state.player.x, y: world.state.player.y };
    l.playerSpace = space;
    Object.assign(world.state.player, ROOM.entry);
    transition(world);
    return true;
  }
  if (p.id.startsWith("locker:")) {
    world.ui.dialog(p.label!, world.life.storageText(p.id));
    return true;
  }
  if (
    p.kind === "npc" &&
    person(p.id) &&
    p.id !== "elder" &&
    p.id !== "healer" &&
    p.id !== "carpenter"
  ) {
    world.ui.dialog(p.label!, world.life.dialogue(p.id as ResidentId), p.id);
    offerHelp(world, p.id as ResidentId);
    return true;
  }
  return false;
}
export function enterShop(world:World,id:ShopId){
  const spaces:Record<ShopId,SpaceId>={general:'general-shop',smith:'smith-shop',healer:'healer-home',inn:'inn',carpenter:'wood-workshop'};
  const h=HOMES.find(h=>h.id===spaces[id]);
  if(!h||world.state.life.playerSpace!=='village'||Math.hypot(world.state.player.x-h.door.x,world.state.player.y-h.door.y)>=95||!world.clearLine(world.state.player.x,world.state.player.y,h.door.x,h.door.y)){
    world.ui.message('请到房屋入口再进入店内。');return;
  }
  world.ui.close(true);
  lifeInteract(world,{id:`life-door:${h.id}`,art:'',w:0,h:0,...h.door,kind:'sign',label:h.name});
}
function transition(world: World) {
  world.catCompanion.transition();world.catView?.clear();
  const companion=world.xiaobao?.controller;
  if(companion?.data.task==='follow'){companion.data.wait=null;companion.data.command=null;if(companion.data.cast&&!companion.data.cast.released)companion.cancel();}
  // 同一帧已切换空间；立刻清掉上一空间的交互提示，保存期间也不显示旧门牌。
  world.target = undefined;
  world.ui.update(world.state, "");
  world.combat.reset(world.combat.dashCooldown);
  world.clearSwordWind();
  world.keys.clear();
  world.battleAxis = { x: 0, y: 0 };
  world.runIntent = false;
  world.practice.reset();
  world.hero.place(world.state.player.x, world.state.player.y);
  world.cat.place(world.state.player.x - 25, world.state.player.y);
  world.follower.reset(world.state.player);
  world.cameras.main.centerOn(world.state.player.x, world.state.player.y - 150);
  void world.persist().catch(() => {});
}
export function leaveRoom(world: World) {
  world.state.life.playerSpace = "village";
  Object.assign(world.state.player, world.state.life.outside);
  transition(world);
}
export function lifeTargets(world: World): Prop[] {
  const l = world.state.life;
  return [
    ...world.life.entities(),
    ...(l.playerSpace === "village"
      ? HOMES.map((h) => ({
          id: `life-door:${h.id}`,
          art: "",
          w: 0,
          h: 0,
          ...h.door,
          kind: "sign" as const,
          label: `${h.name} · 敲门/进入`,
        }))
      : [
          ...INTERIOR_FURNITURE.filter(f=>f.space===l.playerSpace&&!f.ground).map(f=>({id:`interior:${f.id}`,art:"",w:0,h:0,...(f.shop?INTERIOR_SERVICE:{x:f.x,y:f.y+20}),kind:"sign" as const,label:`${f.label} · ${f.shop?"交易":"查看"}`})),
          ...PRIVATE_STORAGE.filter((box) => box.space === l.playerSpace).map(
            (box) => ({
              id: box.id,
              art: "",
              w: 0,
              h: 0,
              x: box.use.x,
              y: box.use.y,
              kind: "sign" as const,
              label: `${box.label} · 查看归属`,
            }),
          ),
          {
            id: "life-exit",
            art: "",
            w: 0,
            h: 0,
            x: ROOM.entry.x,
            y: ROOM.entry.y,
            kind: "sign" as const,
            label: "离开房屋",
          },
        ]),
  ];
}
export function offerHelp(world: World, id: ResidentId) {
  if (
    !world.life.needsTreatment(id) ||
    world.state.defense.guards.find((g) => g.id === id)?.dead
  )
    return;
  const button = document.createElement("button");
  button.textContent = "使用公共药箱帮助照护（1份药）";
  button.onclick = () => {
    const success = world.life.helpPlayer(id);
    world.ui.close(true);
    world.ui.message(
      success
        ? "已到场照护，公共药品减少1份。"
        : "伤情、距离、药品或安全条件已变化。",
    );
    if (success) void world.persist().catch(() => {});
  };
  world.ui.modal.querySelector(".dialog-copy")?.append(button);
}
export function attachLifeUi(world: World) {
  const bar = document.createElement("aside");
  bar.className = "resident-tools";
  bar.hidden = true;
  const notes = document.createElement("button");
  notes.innerHTML = '<img src="/assets/commission/ledger-prop.webp" alt=""><span>笔记 N</span>';
  notes.setAttribute('aria-label', '居民笔记 · N');
  notes.title = '居民笔记 · N';
  notes.onclick = () => showNotes(world);
  bar.append(notes);
  if (
    import.meta.env.DEV &&
    new URLSearchParams(location.search).has("npcDebug")
  ) {
    const toggle = document.createElement("button");
    toggle.textContent = "NPC 调试";
    const panel = document.createElement("div");
    panel.className = "resident-debug";
    panel.hidden = true;
    const select = document.createElement("select");
    select.setAttribute("aria-label", "观察居民");
    for (const p of PEOPLE) {
      const option = document.createElement("option");
      option.value = p.id;
      option.textContent = p.name;
      select.append(option);
    }
    panel.append(select);
    const group = document.createElement("div");
    group.className = "resident-debug-actions";
    panel.append(group);
    const action = (name: string, callback: () => void) => {
      const b = document.createElement("button");
      b.textContent = name;
      b.onclick = callback;
      group.append(b);
    };
    action("推进1小时", () => fastForward(world, 60));
    action("推进至09:00", () =>
      fastForward(world, (540 - (world.state.time % 1440) + 1440) % 1440),
    );
    action("观察人物", () => {
      if (
        world.life.body(select.value)?.space !== world.state.life.playerSpace
      ) {
        world.ui.message("人物在另一空间，请根据居民笔记到住所敲门观察。");
        return;
      }
      const v =
        world.lifeView.residents.get(select.value)?.sprite ??
        world.defenseView.guards.get(select.value)?.sprite;
      if (v) world.cameras.main.startFollow(v, true, 0.1, 0.1, 0, 150);
    });
    action("跟随玩家", () =>
      world.cameras.main.startFollow(world.hero.sprite, true, 0.1, 0.1, 0, 150),
    );
    action("东门来袭演练", () => void world.startDefenseDrill());
    action("调试集结警报", () => {
      world.life.debugAlarmUntil = world.state.life.elapsed + 15000;
      world.ui.message("明确标记的开发警报演练，非自然危机。");
    });
    action("调试伤情", () => {
      world.life.debugInjury(select.value as ResidentId, 70);
      world.ui.message("明确标记的开发调试伤情，非自然验收证据。");
    });
    action("调试木工台损坏", () => {
      world.life.damageFacility("workbench", 50, true);
      world.ui.message("明确标记的开发调试设施损坏。");
    });
    action("调试住所通路开关", () => {
      const space = person(select.value)!.home,
        unavailable = world.state.life.unavailable;
      world.life.debugAccess(select.value as ResidentId);
      world.ui.message(
        `开发通路演练：${HOMES.find((h) => h.id === space)!.name}${unavailable.homes[space] ? "暂不可进入；人物会实际前往备用住处" : "入口已恢复"}。这不是自然灾害。`,
      );
    });
    action("调试床位开关", () => {
      world.life.debugAccess(select.value as ResidentId, true);
      world.ui.message("明确标记的开发床位演练，旅馆空床可用时沿路转移。");
    });
    const pre = document.createElement("pre");
    panel.append(pre);
    toggle.onclick = () => (panel.hidden = !panel.hidden);
    bar.append(toggle, panel);
    const timer = setInterval(() => {
      if (panel.hidden) return;
      const n = world.state.life.people.find((n) => n.id === select.value)!,
        p = world.life.body(n.id)!;
      pre.textContent = `${person(n.id)!.name} · 空间 ${p.space}\n原因：${n.reason}\n行动：${n.action?.label ?? "无"} / ${n.action?.phase ?? "等待"} ${Math.round(n.action?.progress ?? 0)}毫秒\n需求：饥饿 ${Math.round(n.needs.hunger)} 疲劳 ${Math.round(n.needs.fatigue)}\n警报认知 ${n.alarm} · 寻路失败 ${n.pathFailures}\n私人物品：${PRIVATE_STORAGE.find((b) => b.owner === n.id)!.item} / ${n.gear === "carried" ? "随身携带" : "自己的储物箱"}\n包内药品 ${n.supplies.medicine} 木料 ${n.supplies.wood}\n寻路批次 ${world.life.navigation.get(n.id)?.batches ?? 0} / 每批最多 ${world.life.navigation.get(n.id)?.maxExpanded ?? 0} 节点\n预约：${
        world.state.life.reservations
          .filter((r) => r.owner === n.id)
          .map((r) => r.facility)
          .join("、") || "无"
      }\n候选：${(world.life.scores.get(n.id) ?? []).map((c) => `${c.label} ${c.score.toFixed(0)}`).join("；")}\n公共药品 ${world.state.life.stores.medicine} 木料 ${world.state.life.stores.wood}\n近期事件：\n${world.state.life.events
        .slice(-5)
        .map((e) => `${e.debug ? "[调试]" : ""}${e.id} ${e.result}`)
        .join("\n")}`;
    }, 500);
    world.events.once("shutdown", () => clearInterval(timer));
  }
  world.ui.root.querySelector(".bottom")!.append(bar);
  world.events.once("shutdown", () => bar.remove());
}
export function showNotes(world: World) {
  world.ui.dialog(
    "居民笔记",
    PEOPLE.map((p) => {
      const o = world.state.life.observed[p.id],
        home = HOMES.find((h) => h.id === p.home)!;
      return `${p.name} · ${p.job}\n住所：${home.name}。${p.habit}。\n通常：${p.schedule
        .filter((s) => s.activity !== "duty")
        .map(
          (s) =>
            `${Math.floor(s.from / 60)}—${Math.floor(s.to / 60)}时 ${s.label}`,
        )
        .join(
          "；",
        )}。\n${o ? `上次亲眼见到（第${Math.floor(o.time / 1440) + 1}日）：${o.label}。` : "尚未记录最近去向，可先去住处敲门。"}`;
    }).join("\n\n"),
  );
}
function fastForward(world: World, minutes: number) {
  if (
    !world.active ||
    world.ui.paused ||
    world.economy.busy ||
    world.defenseSaving
  )
    return;
  const ms = Math.min(960000, (minutes / 1.5) * 1000);
  world.keys.clear();
  world.battleAxis = { x: 0, y: 0 };
  world.runIntent = false;
  // 整个模拟共同推进：移动、驻防、日程、治疗和生产均按固定100毫秒步长。
  for (let advanced = 0; advanced < ms; advanced += 100) {
    const delta = Math.min(100, ms - advanced),
      contacts: any[] = [],
      budget = { queries: 2 };
    world.advanceBattle(world.sim, world.sim + delta, contacts, budget);
    world.resolveBattle(world.sim, contacts, budget);
    const batch = world.defense.drainNotices();
    world.life.consumeDefense(batch);
  }
  world.ui.message(
    `开发快进已推进 ${Math.round(minutes)} 游戏分钟；移动、驻防与工作同步推进。`,
  );
  void world.persist().catch(() => {});
}
