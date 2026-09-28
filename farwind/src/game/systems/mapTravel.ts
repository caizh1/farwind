import {SHORTCUTS,type ShortcutId} from "../../data/maps/windbell/shortcuts";
import {items,type ItemId} from "../../data/content";
import { remove, validate, type State } from "./state";
import { save } from "./save";
import type { World } from "../scenes/World";

export function westRoadSnapshot(state: State, action: "survey" | "repair") {
  const s = validate(state),
    p = s.player;
  if (s.life.playerSpace !== "village")
    throw Error("请到旧道路口或村内委托处办理。");
  if (action === "survey") {
    if (Math.hypot(p.x + 390, p.y - 1120) > 100)
      throw Error("先从北门或南门沿环线走到旧道路口。");
    if (s.mapProgress.westRoad !== "unknown")
      throw Error("旧道已经调查，无需重复登记。");
    s.mapProgress.westRoad = "surveyed";
  } else {
    if (
      Math.min(
        Math.hypot(p.x - 180, p.y - 1540),
        Math.hypot(p.x - 560, p.y - 810),
      ) > 130
    )
      throw Error("请到西门路牌或公共委托簿交付材料。");
    if (s.mapProgress.westRoad !== "surveyed")
      throw Error(
        s.mapProgress.westRoad === "open"
          ? "旧道已恢复，不会重复扣除材料。"
          : "尚未调查旧道路口。",
      );
    if (s.defense.raid) throw Error("当前来袭结束后再施工。");
    if (!remove(s, "wood", 4) || !remove(s, "stone", 2))
      throw Error("修复需要木材×4、石材×2；材料不足，未扣除。");
    s.mapProgress.westRoad = "open";
  }
  return s;
}
async function commitRoad(world: World, action: "survey" | "repair") {
  if (world.economy.busy || world.defenseSaving) return;
  world.defenseSaving = true;
  world.ui.economyBusy = true;
  world.ui.modal.querySelectorAll("button").forEach((b) => (b.disabled = true));
  try {
    await world.economy.run(
      () => world.state,
      (s) => westRoadSnapshot(s, action),
      save,
      (next) => world.publishState(next),
    );
    world.ui.economyBusy = false;
    world.ui.dialog(
      "恢复西侧旧道",
      action === "survey"
        ? "旧路通到村墙，断栅和松脱的门轴需要修补。调查已登记，回西门或公共委托簿交付木材×4、石材×2即可施工。附近旧农庄有可拾取的枯枝。"
        : "西门与旧道已经接通。禾岩、鹿宁和远翎继续驻守，北、南门的人员不调离。现在可以沿旧道直接回村。",
    );
  } catch (e) {
    world.ui.economyBusy = false;
    openWestRoad(world);
    world.ui.message((e as Error).message);
  } finally {
    world.defenseSaving = false;
  }
}
export function openWestRoad(world: World) {
  const stage = world.state.mapProgress.westRoad;
  world.ui.dialog(
    "恢复西侧旧道",
    stage === "unknown"
      ? "西门暂时封闭。先从北门或南门沿村外环线绕到西侧，再向西北走到旧道路口调查路况。恢复后可以直接回村。"
      : stage === "surveyed"
        ? "旧道已确认可用，门轴与断栅需要木材×4、石材×2。施工完成将永久开放西门。"
        : "西侧旧道已恢复，西门可以直接通往旧农庄与外围环线。",
  );
  if (stage === "surveyed") {
    const button = document.createElement("button");
    button.textContent = "交付木材×4、石材×2并修复";
    button.onclick = () => void commitRoad(world, "repair");
    world.ui.modal.append(button);
  }
}
export function surveyWestRoad(world: World) {
  if (world.state.mapProgress.westRoad === "unknown")
    void commitRoad(world, "survey");
  else
    world.ui.dialog(
      "旧道路口",
      world.state.mapProgress.westRoad === "open"
        ? "沿东侧旧路即可穿过西门回村。"
        : "路况已经登记，回村交付修复材料即可开放西门。",
    );
}
export function appendRoadCommission(world: World) {
  const button = document.createElement("button");
  button.textContent =
    world.state.mapProgress.westRoad === "open"
      ? "西侧旧道 · 已恢复"
      : "委托 · 恢复西侧旧道";
  button.onclick = () => openWestRoad(world);
  world.ui.modal.append(button);
}

export function repairShortcutSnapshot(state:State,id:ShortcutId){
  const s=validate(state),d=SHORTCUTS.find(v=>v.id===id);
  if(!d)throw Error("这条捷径不存在。");
  if(s.life.playerSpace!=="village"||Math.hypot(s.player.x-d.approach.x,s.player.y-d.approach.y)>110)throw Error("请到捷径旁的修复工作位施工。");
  if(s.mapProgress.shortcuts.includes(id))throw Error("此处已经修复，不会重复扣料。");
  if(s.defense.raid)throw Error("当前来袭结束后再施工。");
  for(const [item,n] of Object.entries(d.cost))if(!remove(s,item as ItemId,n))throw Error("修复材料不足，未扣除任何材料。");
  s.mapProgress.shortcuts.push(id);return s;
}
export function openShortcut(world:World,id:ShortcutId){
  const d=SHORTCUTS.find(s=>s.id===id)!;
  const cost=Object.entries(d.cost).map(([id,n])=>`${items[id as ItemId].name}×${n}`).join("、");
  world.ui.dialog(d.name,world.state.mapProgress.shortcuts.includes(id)?`这里已经修复。${d.detail}`:`${d.detail}\n需要${cost}，修复结果会立即保存。`);
  if(world.state.mapProgress.shortcuts.includes(id))return;
  const b=document.createElement("button");b.textContent=`交付${cost}并修复`;world.ui.modal.append(b);
  b.onclick=async()=>{
    if(world.economy.busy||world.defenseSaving)return;
    world.defenseSaving=true;world.ui.economyBusy=true;b.disabled=true;
    try{
      await world.economy.run(()=>world.state,s=>repairShortcutSnapshot(s,id),save,s=>world.publishState(s));
      world.ui.economyBusy=false;openShortcut(world,id);world.ui.message(`${d.name}已恢复，可以步行通过。`);
    }catch(e){world.ui.economyBusy=false;openShortcut(world,id);world.ui.message((e as Error).message);}
    finally{world.defenseSaving=false;}
  };
}
