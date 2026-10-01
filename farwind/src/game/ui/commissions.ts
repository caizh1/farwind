import {SOUTH_EVENTS,type SouthEventId} from '../systems/southEvents';
import { items, itemIcon, objectives, type ItemId } from "../../data/content";
import { campCleared } from "../systems/encounterState";
import { southQuestSnapshot,southEventRewardSnapshot } from "../systems/fieldQuest";
import { westRoadSnapshot } from "../systems/mapTravel";
import { count } from "../systems/state";
import { save } from "../systems/save";
import type { World } from "../scenes/World";

const icon = (id: ItemId) =>
  `<img src="${itemIcon(id)}" alt="" loading="eager">`;
const item = (id: ItemId, amount: number) =>
  `<span class="commission-item">${icon(id)}<span>${items[id].name} ×${amount}</span></span>`;
const goal = (text: string, done: boolean) =>
  `<li><input type="checkbox" disabled ${done ? "checked" : ""} aria-label="${text}${done ? "，已完成" : "，未完成"}"><span>${text}</span></li>`;

// 委托页面只读取正式状态；领取、交付和修复均复用现有快照与保存锁。
export function openCommissions(world: World) {
  const ui = world.ui;
  if (ui.economyBusy) return;
  ui.open("commission");
  let selected: "south" | "west" = "south";
  let view: "commissions" | "journal" = "commissions";

  const render = (feedback = "", focus = "commission-south") => {
      const s = world.state;
    const phase = s.fieldQuests["south-supply"];
    const cleared = campCleared(s.encounters, "south-spore-camp");
    const herbs = count(s, "herb");
    const southReady = phase === "active" && cleared && herbs >= 2;
    const road = s.mapProgress.westRoad;
    const roadReady =
      road === "surveyed" &&
      count(s, "wood") >= 4 &&
      count(s, "stone") >= 2 &&
      !s.defense.raid;
    const southStatus =
      phase === "complete"
        ? "已完成"
        : phase === "available"
          ? "可领取"
          : southReady
            ? "可交付"
            : "进行中";
    const westStatus =
      road === "open"
        ? "已恢复"
        : road === "unknown"
          ? "待调查"
          : roadReady
            ? "可修复"
            : "待修复";
    const south = selected === "south";
    const complete = south ? phase === "complete" : road === "open";
    const canSubmit = south ? phase === "available" || southReady : roadReady;
    const action = south
      ? phase === "available"
        ? "领取委托与启程补给"
        : phase === "complete"
          ? "委托已完成"
          : "交付药草并领取奖励"
      : road === "open"
        ? "旧道已恢复"
        : road === "unknown"
          ? "先调查旧道路口"
          : "交付材料并修复旧道";

    const eventContent=`<section class="commission-goals"><h3>南线采集事件</h3>${(Object.keys(SOUTH_EVENTS) as SouthEventId[]).map(id=>{
      const d=SOUTH_EVENTS[id],done=s.southEvents[id]===0,claimed=s.southEvents.claimed.includes(id);
      return `<p>${d.name}：${done?claimed?'已领取谢礼':'采集已恢复，谢礼待领取':d.hint}</p>${done&&!claimed?`<button id="commission-event-${id}">领取${d.name}谢礼 · 铜币×12、药剂×1</button>`:''}`;
    }).join('')}</section>`;
    const content =
      view === "journal"
        ? `<div class="commission-journal"><section><small>主线 · 失落的风</small><h2>风的足迹</h2><p>${objectives[s.quest]}</p><ol>${objectives
            .slice(0, 7)
            .map(
              (text, i) =>
                `<li class="${i < s.quest ? "done" : i === s.quest ? "current" : ""}">${text}${i < s.quest ? " · 已完成" : ""}</li>`,
            )
            .join(
              "",
            )}</ol></section><section><small>支线 · 木匠的托付</small><h2>阿禾的托付</h2><p>${["与西南方的木匠阿禾交谈", "为阿禾收集 4 份木材", "已交付，收到浆果与谢意"][s.side]}</p>${ui.skillJournal(s)}</section></div>`
        : `<nav class="commission-index" aria-label="选择村庄委托"><button id="commission-south" aria-pressed="${south}">${icon("herb")}<span>南路补给</span><small>${southStatus}</small></button><button id="commission-west" aria-pressed="${!south}">${icon("wood")}<span>恢复西侧旧道</span><small>${westStatus}</small></button></nav><div class="commission-detail"><div class="commission-copy"><header class="commission-heading"><div class="commission-title">${icon(south ? "herb" : "wood")}<h2>${south ? "南路补给" : "恢复西侧旧道"}</h2><span class="commission-status ${complete ? "complete" : ""}">${south ? southStatus : westStatus}</span></div><p>${south ? "委托人 · 药师小满" : "风铃村 · 旧道修复"}</p></header><p class="commission-story">${south ? (phase === "complete" ? "药草已送回，南侧采集恢复。孢根巢地保持清空，你仍可在湿地采集与探索。" : "小满的药草供应断在了南边。请沿南门石路过芦苇桥，恢复药草洼地的采集。") : road === "open" ? "西侧旧道已恢复，西门可以直接通往旧农庄与外围环线。" : "西门的断栅与门轴需要修补。先到旧道路口确认路况，再带材料回村施工。"}</p><section class="commission-goals"><h3>委托目标</h3><ul>${south ? goal("清理驻守并击败孢心巢母", cleared) + goal(`交付药草 ×2${phase === "active" ? ` · 持有 ${herbs}/2` : ""}`, phase === "complete") : goal("调查西侧旧道路口", road !== "unknown") + goal("交付木材 ×4、石材 ×2", road === "open")}</ul></section><section class="commission-route-copy"><h3>路线说明</h3><p>${south ? "从南门沿石路过芦苇桥，药草洼地在西南岸，孢根巢地在洼地东南方。" : "从北门或南门沿村外环线绕到西侧，再向西北走到旧道路口。调查后可在西门或本簿交付材料。"}</p></section><div class="commission-rewards">${south ? `<section><h3>启程补给</h3>${item("potion", 2)}${phase !== "available" ? "<small>已领取</small>" : ""}</section><section><h3>完成奖励</h3><div class="commission-item-group">${item("potion", 2)}<span class="commission-item"><img src="/assets/commission/coin.webp" alt=""><span>铜币 ×24</span></span></div>${phase === "complete" ? "<small>已领取</small>" : ""}</section>` : `<section><h3>施工材料</h3><div class="commission-item-group">${item("wood", 4)}${item("stone", 2)}</div><small>${road === "open" ? "已交付" : `持有木材 ${count(s, "wood")}、石材 ${count(s, "stone")}`}</small></section><section><h3>修复结果</h3><p>永久开放西门<br>直接通往西侧旧道</p></section>`}</div>${!canSubmit && !complete ? `<p class="commission-hint">${south ? (!cleared ? "先清理驻守并击败孢心巢母，再带药草回村交付。" : "还需要药草两份，采集后回村交付。") : road === "unknown" ? "路况调查登记后，才能交付施工材料。" : s.defense.raid ? "当前来袭结束后再施工。" : "修复需要木材四份、石材两份。"}</p>` : ""}${south?eventContent:""}</div><figure class="commission-art">${south ? `<img class="commission-route-image" src="/assets/commission/south-route.webp" alt="南门石路经芦苇桥通往西南岸药草洼地，孢根巢地位于其东南方"><figcaption><span>南门</span><span>芦苇桥</span><span>药草洼地</span><span>孢根巢地</span></figcaption>` : `<img class="commission-ledger-image" src="/assets/commission/ledger-prop.webp" alt="木匣公共委托簿"><figcaption>调查路况，修复门轴与断栅。</figcaption>`}</figure></div>`;

    ui.shell(
      "公共委托簿",
      `<nav class="commission-tabs" aria-label="委托簿页面"><button id="commission-view" aria-pressed="${view === "commissions"}">村庄委托</button><button id="commission-journal" aria-pressed="${view === "journal"}">旅途手记</button><small>风铃村 · 公共委托簿</small></nav><div class="commission-scroll">${content}</div><footer class="commission-footer"><p id="commission-feedback" role="status" aria-live="polite" hidden></p><div class="commission-actions">${view === "commissions" ? `<button id="commission-submit" class="commission-primary" ${canSubmit ? "" : "disabled"}>${action}</button>` : ""}<button id="close">合上委托簿 <kbd>Esc</kbd></button></div></footer>`,
    );
    ui.modal.querySelector(".panel")!.classList.add("commission-panel");
    ui.modal
      .querySelector("#commission-south")
      ?.setAttribute("aria-label", "委托 · 南路补给");
    ui.modal
      .querySelector("#commission-west")
      ?.setAttribute("aria-label", "委托 · 恢复西侧旧道");
    const status = ui.modal.querySelector<HTMLElement>("#commission-feedback")!;
    status.hidden = !feedback;
    status.textContent = feedback;
    ui.button("close", () => ui.close());
    ui.button("commission-view", () => {
      view = "commissions";
      render("", "commission-view");
    });
    ui.button("commission-journal", () => {
      view = "journal";
      render("", "commission-journal");
    });
    ui.button("commission-south", () => {
      selected = "south";
      render();
    });
    ui.button("commission-west", () => {
      selected = "west";
      render("", "commission-west");
    });
    for(const id of Object.keys(SOUTH_EVENTS) as SouthEventId[])ui.button('commission-event-'+id,async()=>{
      if(world.economy.busy||world.defenseSaving||ui.economyBusy)return;
      world.defenseSaving=true;ui.economyBusy=true;ui.modal.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.disabled=true);let message='';
      try{await world.economy.run(()=>world.state,current=>southEventRewardSnapshot(current,id),save,next=>world.publishState(next));message=`${SOUTH_EVENTS[id].name}谢礼已保存并领取。`;}
      catch(error){message=`未领取谢礼：${(error as Error).message}`;}finally{world.defenseSaving=false;ui.economyBusy=false;}
      render(message);
    });
    ui.button("commission-submit", async () => {
      if (
        world.economy.busy ||
        world.defenseSaving ||
        ui.economyBusy ||
        !canSubmit
      )
        return;
      world.defenseSaving = true;
      ui.economyBusy = true;
      ui.modal
        .querySelectorAll<HTMLButtonElement>("button")
        .forEach((b) => (b.disabled = true));
      status.hidden = false;
      status.textContent = "正在办理，请稍候……";
      let result: string;
      try {
        await world.economy.run(
          () => world.state,
          (current) =>
            south
              ? southQuestSnapshot(
                  current,
                  phase === "available" ? "accept" : "complete",
                )
              : westRoadSnapshot(current, "repair"),
          save,
          (next) => world.publishState(next),
        );
        result = south
          ? phase === "available"
            ? "委托已领取，获得启程补给：恢复药剂 ×2。"
            : "委托已完成，获得恢复药剂 ×2、铜币 ×24。"
          : "施工完成，西门与旧道已经接通。";
      } catch (error) {
        result = `未完成办理：${(error as Error).message}`;
      } finally {
        world.defenseSaving = false;
        ui.economyBusy = false;
      }
      render(result, south ? "commission-south" : "commission-west");
    });
    ui.focusPanel(focus);
  };
  render();
}
