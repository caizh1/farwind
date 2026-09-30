import { equipment, RETURN_WIND_ORB, type EquipmentSlot } from "../../data/economy";
import { items } from "../../data/content";
import { count, type State } from "../systems/state";
import type { Interface } from "./interface";

export type EquipmentViewSlot = EquipmentSlot | "orb";
const labels = { weapon: "武器", armor: "护甲", orb: "宝珠" } as const;

export function equippedItem(state: State, slot: EquipmentViewSlot) {
  if (slot === "orb") return {
    name: RETURN_WIND_ORB.name,
    icon: RETURN_WIND_ORB.icon,
    summary: "指引你回家的温柔之风。",
    description: RETURN_WIND_ORB.description,
    recovery: RETURN_WIND_ORB.recovery,
    rules: RETURN_WIND_ORB.rules,
    quote: RETURN_WIND_ORB.quote,
    badge: "默认装备",
  };
  const id = state.equipment[slot];
  return {
    name: id ? items[id].name : slot === "weapon" ? "原有佩剑" : "原有衣物",
    icon: slot === "weapon" ? "/assets/icon-sword.png" : "/assets/equipment/traveler-coat.webp",
    summary: id ? slot === "weapon" ? "每次命中增加 4 点伤害。" : "每次受击减少 3 点伤害。" : slot === "weapon" ? "一直陪伴你的可靠佩剑。" : "熟悉而舒适的旅人衣物。",
    description: id ? slot === "weapon" ? "每次命中增加 4 点伤害。" : "每次受击减少 3 点伤害，至少受到 1 点伤害。" : slot === "weapon" ? "陪你走过最初旅途的佩剑。" : "护住身体，也装着一路的风尘。",
    recovery: "",
    rules: id ? "已穿戴 · 换下后放回行囊" : "基础装备 · 随身携带",
    quote: "带上重要的东西，继续前行。",
    badge: id ? "已穿戴" : "基础装备",
  };
}

export function showEquipment(ui: Interface) {
  const state = ui.state;
  if (!state) return;
  const slot = ui.selectedEquipment;
  const selected = equippedItem(state, slot);
  const candidates = slot === "orb" ? [] : (Object.keys(equipment) as (keyof typeof equipment)[])
    .filter(id => equipment[id].slot === slot && count(state, id) > 0);
  const controls = slot === "orb" ? "" : `<div class="equipment-controls">${candidates.length
    ? `<label for="equipment-replacement">从行囊更换${labels[slot]}</label><div class="equipment-change"><select id="equipment-replacement">${candidates.map(id => `<option value="${id}">${items[id].name}</option>`).join("")}</select><button id="equipment-equip">穿戴</button></div>`
    : `<p class="equipment-empty">行囊中还没有可替换的${labels[slot]}。</p>`}${state.equipment[slot] ? `<button id="equipment-unequip">卸下${labels[slot]}</button>` : ""}</div>`;
  ui.shell("旅人装备", `<div class="equipment-layout"><figure class="equipment-traveler"><img src="/assets/equipment/traveler-bust.webp" alt="棕发红围巾的旅人"><figcaption>走过的路，<br>终会成为回家的方向。</figcaption></figure><div class="equipment-slots" role="group" aria-label="已装备的物品">${(["weapon", "armor", "orb"] as const).map(key => {
    const item = equippedItem(state, key);
    return `<button class="equipment-slot" data-equipment-slot="${key}" aria-pressed="${slot === key}" aria-label="${labels[key]}：${item.name}，${item.badge}" aria-controls="equipment-detail"><span class="equipment-icon"><img src="${item.icon}" alt=""></span><span class="equipment-slot-copy"><span class="equipment-label">${labels[key]}</span><span class="equipment-name-line"><strong>${item.name}</strong>${key === "orb" ? `<span class="equipment-badge">默认装备</span>` : ""}</span><span class="equipment-summary">${item.summary}</span></span></button>`;
  }).join("")}</div><section id="equipment-detail" class="equipment-detail" aria-label="${selected.name}详情"><img class="equipment-art" src="${selected.icon}" alt="${selected.name}"><div class="equipment-name-line"><h2>${selected.name}</h2><span class="equipment-badge">${selected.badge}</span></div><p class="equipment-effect">${selected.description}</p>${selected.recovery ? `<p class="equipment-recovery">${selected.recovery}</p>` : ""}<p class="equipment-rules">${selected.rules}</p><p class="equipment-quote">${selected.quote}</p>${controls}<button id="close" class="equipment-return">${ui.returnTo === "pause" ? "返回菜单" : "返回旅途"} <kbd>Esc</kbd></button></section></div>`);
  const panel = ui.modal.querySelector<HTMLElement>(".panel")!;
  panel.classList.add("equipment-panel");
  ui.modal.classList.add("equipment-modal");
  panel.querySelector("header")!.innerHTML = `<div class="equipment-heading"><h1 id="panel-title">旅人装备</h1><p>远风之地 · 行囊与装备，陪你走过每一段旅途。</p></div><nav class="equipment-tabs" aria-label="旅人物品页"><button id="equipment-tab" aria-current="page"><img src="/assets/icon-sword.png" alt="">装备</button><button id="equipment-bag">行囊</button><button data-panel="runes">符文</button></nav>`;
  ui.modal.querySelectorAll<HTMLButtonElement>("[data-equipment-slot]").forEach(button => {
    button.onclick = () => {
      ui.selectedEquipment = button.dataset.equipmentSlot as EquipmentViewSlot;
      ui.open("equipment");
      ui.modal.querySelector<HTMLButtonElement>(`[data-equipment-slot="${ui.selectedEquipment}"]`)?.focus({ preventScroll: true });
    };
  });
  ui.button("equipment-bag", () => ui.open("bag"));
  ui.button("equipment-equip", () => {
    if (slot === "orb") return;
    const chosen = (ui.modal.querySelector("#equipment-replacement") as HTMLSelectElement).value;
    if (candidates.includes(chosen as keyof typeof equipment)) void ui.changeEquipment(slot, chosen as keyof typeof equipment, "equipment");
  });
  ui.button("equipment-unequip", () => { if (slot !== "orb") void ui.changeEquipment(slot, null, "equipment"); });
}
