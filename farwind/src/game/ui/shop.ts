import { RUNES } from "../../data/runes";
import { runeIcon } from "./runeIcons";
import { items, itemIcon, consumables, type ItemId } from "../../data/content";
import {
  shops,
  salePrices,
  isEquipment,
  type ShopId,
} from "../../data/economy";
import { count } from "../systems/state";
import {
  economySnapshot,
  maxTradeQuantity,
  type EconomyRequest,
} from "../systems/economy";
import type { Interface } from "./interface";
import { DAY_NIGHT } from "../../data/dayNight";
import { phaseAt } from "../systems/worldClock";
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const category = (item: ItemId) =>
  isEquipment(item) ? "装备" : consumables[item] ? "补给" : "材料";
const icon = (item: ItemId, size = 64) =>
  itemIcon(item)
    ? `<img width="${size}" height="${size}" src="${itemIcon(item)}" alt="">`
    : `<span class="shop-placeholder" aria-hidden="true">衣</span>`;
export async function showShop(ui: Interface, id: ShopId) {
  ui.open("shop");
  let flow: "buy" | "sell" | "exchange" | "rest" | "sleep" | "runes" =
    id === "inn" ? "rest" : "buy";
  let filter = "全部",
    selected: ItemId | undefined,
    amount = 1;
  const render = (feedback = "", review = false) => {
    if (ui.mode !== "shop") return;
    const s = ui.state!,
      shop = shops[id];
    const list = (
      flow === "buy"
        ? Object.keys(shop.goods)
        : flow === "sell"
          ? Object.keys(salePrices)
          : []
    ) as ItemId[];
    const visible = list.filter(
      (item) => filter === "全部" || category(item) === filter,
    );
    if (!selected || !visible.includes(selected)) selected = visible[0];
    const trading = flow === "buy" || flow === "sell",
      selling = flow === "sell";
    const price =
      trading && selected
        ? selling
          ? salePrices[selected]!
          : (shop.goods as Partial<Record<ItemId, number>>)[selected]!
        : flow === "rest"
          ? 12
          : flow === "sleep"
            ? DAY_NIGHT.sleepCost
            : 0;
    const max =
      selected && trading ? maxTradeQuantity(s, id, selected, selling) : 1;
    const quantityValid =
      Number.isSafeInteger(amount) && amount >= 1 && amount <= 99;
    const total = price * (trading ? amount : 1);
    const detail =
      flow === "exchange"
        ? "扣除药草×2、浆果×1，获得恢复药剂×1。成品空间不足时不扣材料。"
        : flow === "sleep"
          ? `${DAY_NIGHT.sleepCost}金币，恢复生命与体力，睡到清晨06:00；跳过尚未开始的当夜来袭，不获得战斗奖励。${phaseAt(s.time) === "night" ? "" : "仅19:00—06:00前开放。"}`
          : flow === "rest"
            ? "12金币，生命与体力恢复至100，不推进时间。"
            : selected
              ? items[selected].description
              : "此分类暂无商品。";
    const request: EconomyRequest | undefined =
      flow === "buy" || flow === "sell"
        ? selected
          ? {
              kind: flow,
              shop: id,
              item: selected,
              quantity: amount,
              sequence: s.economyRevision + 1,
            }
          : undefined
        : flow === "runes"
          ? undefined
          : {
              kind: flow,
              shop: id,
              quantity: 1,
              sequence: s.economyRevision + 1,
            };
    let blocked = "";
    if (trading) {
      if (!request) blocked = "请先选择商品。";
      else if (!quantityValid) blocked = "数量必须是1到99的整数。";
      else
        try {
          economySnapshot(s, request);
        } catch (e) {
          blocked = (e as Error).message;
        }
    }
    const tabs = [
      ["buy", "购买"],
      ...(id === "general"
        ? [
            ["sell", "出售材料"],
            ["runes", "符文"],
          ]
        : []),
      ...(id === "healer" ? [["exchange", "调制药剂"]] : []),
      ...(id === "inn"
        ? [
            ["rest", "休息补给"],
            ["sleep", "住一晚"],
          ]
        : []),
    ];
    const name =
      trading && selected
        ? `${items[selected].name}×${amount}`
        : flow === "rest"
          ? "恢复生命与体力"
          : flow === "sleep"
            ? "睡到清晨06:00"
            : "恢复药剂×1";
    const runeBody = `<section class="rune-shop" aria-label="低阶符文商店">${RUNES.filter(
      (r) => r.acquisition.kind === "shop",
    )
      .map(
        (r) =>
          `<button data-rune-buy="${r.id}" ${s.runes.owned.includes(r.id) || s.coins < (r.acquisition.price ?? 0) ? "disabled" : ""}>${runeIcon(r.id, 40)}<span><b>${r.name}</b><small>${s.runes.owned.includes(r.id) ? "已收藏" : r.acquisition.price + "金币"}</small></span></button>`,
      )
      .join(
        "",
      )}</section><p class="muted">符文收藏后在符文页装备，不占行囊格。</p>`;
    const cards = `<section class="shop-goods" aria-label="商品列表">${visible.map((item) => `<button class="shop-card ${selected === item ? "selected" : ""}" data-item="${item}" aria-pressed="${selected === item}">${icon(item)}<span><b>${items[item].name}</b><small>${escape(items[item].description)}</small><span class="shop-card-price">${item==="windScope"&&(count(s,item)>0||s.equipment.head===item)?"已拥有":selling ? "持有 " + count(s, item) : "库存 " + s.shopStock[`${id}:${item}`]} <strong>${selling ? salePrices[item] : (shop.goods as Partial<Record<ItemId, number>>)[item]} 金币</strong></span></span></button>`).join("") || "<p>此分类暂无商品。</p>"}</section>`;
    const controls =
      trading && selected
        ? `<p class="shop-ownership">持有 ${count(s, selected)} · 最多可${selling ? "售" : "买"} ${max}</p><div class="shop-quantity"><button data-quantity="-1" aria-label="减少数量">−</button><label><span class="sr-only">数量</span><input id="shop-quantity" aria-label="数量" type="number" min="1" max="99" step="1" value="${amount}" inputmode="numeric"></label><button data-quantity="1" aria-label="增加数量">＋</button><button id="shop-max" ${max === 0 ? "disabled" : ""}>${selling ? "售出最多" : "买满"}</button></div>`
        : "";
    ui.shell(
      shop.name,
      `<div class="shop-summary"><p>${shop.greeting}</p><span><b>金币 ${s.coins}</b><b>行囊 ${s.bag.filter(Boolean).length} / 24</b></span></div><nav class="shop-tabs" aria-label="商店服务">${tabs.map(([key, label]) => `<button data-flow="${key}" aria-pressed="${key === flow}">${label}</button>`).join("")}</nav>${flow === "runes" ? runeBody : review ? `<section class="trade-review"><h2>确认${name}</h2><p>${detail}</p><p>${selling ? "收到" : "支付"} ${quantityValid ? total : "—"} 金币 · 交易后余额 ${quantityValid ? s.coins + (selling ? total : -total) : "—"}</p><p class="muted">保存成功才完成交易。确认后请等待结果。</p></section>` : `${trading ? `<nav class="shop-filters" aria-label="商品分类">${["全部", "补给", "材料", "装备"].map((value) => `<button data-filter="${value}" aria-pressed="${filter === value}">${value}</button>`).join("")}</nav>` : ""}<div class="shop-layout">${trading ? cards : '<section class="shop-service"><h2>' + name + "</h2><p>" + detail + "</p>" + (flow === "exchange" ? `<p>持有药草 ${count(s, "herb")}、浆果 ${count(s, "berry")}</p>` : "") + "</section>"}<section class="shop-detail">${trading && selected ? `${icon(selected, 140)}<h2>${items[selected].name}</h2><p>${escape(detail)}</p>${controls}<label class="shop-select">物品<select id="shop-item" aria-label="物品">${visible.map((item) => `<option value="${item}" ${selected === item ? "selected" : ""}>${items[item].name}</option>`).join("")}</select></label>` : ""}<div id="shop-total" class="shop-quote"><p>${selling ? "收到" : "支付"} <b>${quantityValid ? total : "—"} 金币</b></p><p>交易后余额 <b>${quantityValid ? s.coins + (selling ? total : -total) : "—"} 金币</b></p></div></section></div>`}<p id="shop-feedback" role="status" aria-live="polite">${escape(feedback || blocked)}</p><footer class="shop-footer"><small>次日补回基础库存 · 保存成功才完成交易</small><div class="row">${flow === "runes" ? "" : review ? `<button id="shop-confirm">确认${selling ? "出售" : flow === "buy" ? "购买" : flow === "exchange" ? "兑换" : flow === "sleep" ? "住宿" : "休息"}</button><button id="shop-back">重新选择</button>` : `<button id="shop-review" ${blocked ? "disabled" : ""}>核对交易</button>`}${s.life.playerSpace === "village" && (id === "general" || id === "smith") && ui.actions.enterShop ? '<button id="shop-enter">进入店内</button>' : ""}<button id="close">离开商店</button></div></footer>`,
    );
    ui.modal.querySelector(".panel")!.classList.add("shop-panel");
    const bind = (selector: string, callback: (b: HTMLButtonElement) => void) =>
      ui.modal.querySelectorAll<HTMLButtonElement>(selector).forEach(
        (b) =>
          (b.onclick = () => {
            if (!ui.economyBusy) callback(b);
          }),
      );
    bind("[data-flow]", (b) => {
      flow = b.dataset.flow as typeof flow;
      amount = 1;
      filter = "全部";
      render();
    });
    bind("[data-filter]", (b) => {
      filter = b.dataset.filter!;
      amount = 1;
      render();
    });
    bind("[data-item]", (b) => {
      selected = b.dataset.item as ItemId;
      amount = 1;
      render();
    });
    bind("[data-quantity]", (b) => {
      amount = Math.min(
        99,
        Math.max(
          1,
          (Number.isSafeInteger(amount) ? amount : 1) +
            Number(b.dataset.quantity),
        ),
      );
      render();
      ui.focusPanel("shop-quantity");
    });
    ui.button("shop-max", () => {
      amount = max;
      render();
    });
    const choose = ui.modal.querySelector<HTMLSelectElement>("#shop-item");
    if (choose)
      choose.onchange = () => {
        selected = choose.value as ItemId;
        amount = 1;
        render();
        ui.focusPanel("shop-item");
      };
    const quantity = ui.modal.querySelector<HTMLInputElement>("#shop-quantity");
    if (quantity)
      quantity.oninput = () => {
        amount = quantity.valueAsNumber;
        const valid =
          Number.isSafeInteger(amount) && amount >= 1 && amount <= 99;
        blocked = valid ? "" : "数量必须是1到99的整数。";
        if (valid && selected && (flow === "buy" || flow === "sell"))
          try {
            economySnapshot(s, {
              kind: flow,
              shop: id,
              item: selected,
              quantity: amount,
              sequence: s.economyRevision + 1,
            });
          } catch (e) {
            blocked = (e as Error).message;
          }
        const paragraphs = ui.modal.querySelectorAll("#shop-total p b");
        if (paragraphs[0])
          paragraphs[0].textContent = `${valid ? price * amount : "—"} 金币`;
        if (paragraphs[1])
          paragraphs[1].textContent = `${valid ? s.coins + (selling ? price * amount : -price * amount) : "—"} 金币`;
        ui.modal.querySelector("#shop-feedback")!.textContent = blocked;
        ui.modal.querySelector<HTMLButtonElement>("#shop-review")!.disabled =
          !!blocked;
      };
    ui.button("shop-review", () => {
      if (blocked) return;
      render("", true);
      ui.focusPanel("shop-confirm");
    });
    ui.button("shop-back", () => render());
    ui.button("shop-confirm", () => {
      if (request) void submit(() => ui.actions.trade(request));
    });
    ui.button("shop-enter",()=>ui.actions.enterShop?.(id));
    ui.button("close", () => ui.close());
    ui.modal
      .querySelectorAll<HTMLButtonElement>("[data-rune-buy]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            void submit(
              () =>
                ui.actions.runeChange({
                  kind: "claim",
                  id: b.dataset.runeBuy!,
                  shop: "general",
                }),
              "符文已购入收藏并保存，不占行囊。",
            )),
      );
  };
  const submit = async (
    action: () => Promise<void>,
    success = "交易已完成并保存。",
  ) => {
    if (ui.economyBusy) return;
    ui.economyBusy = true;
    ui.modal
      .querySelectorAll<
        HTMLButtonElement | HTMLInputElement | HTMLSelectElement
      >("button,input,select")
      .forEach((b) => (b.disabled = true));
    ui.modal.querySelector("#shop-feedback")!.textContent = "正在保存交易……";
    let feedback = "";
    try {
      await action();
      feedback = success;
    } catch (e) {
      feedback = `未完成交易：${(e as Error).message}`;
    } finally {
      ui.economyBusy = false;
    }
    render(feedback);
    ui.focusPanel("shop-review");
  };
  render();
  if (Math.floor(ui.state!.time / 1440) > ui.state!.shopStockDay)
    await submit(
      () =>
        ui.actions.trade({
          kind: "restock",
          sequence: ui.state!.economyRevision + 1,
        }),
      "今日基础库存已补齐并保存。",
    );
  ui.focusPanel("shop-review");
}
