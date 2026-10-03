import { RUNES } from "../../data/runes";
import { runeIcon } from "./runeIcons";
import { items, itemIcon, consumables, type ItemId } from "../../data/content";
import {
  shops,
  salePrices,
  isEquipment,
  shoeSpeedBonus,
  equipment,
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
  `<img width="${size}" height="${size}" src="${itemIcon(item)}" alt="">`;
const summary = (item: ItemId) => {
  if(isEquipment(item)&&equipment[item].slot==="feet")return `行走与奔跑速度 +${Math.round(shoeSpeedBonus(item)*100)}%`;
  const supply = consumables[item];
  if (supply)
    return [
      supply.hp && `生命 +${supply.hp}`,
      supply.stamina && `体力 +${supply.stamina}`,
    ]
      .filter(Boolean)
      .join(" · ");
  return (
    (
      {
        ironSword: "每次命中伤害 +4",
        leatherCoat: "受击减伤 3 · 至少受到 1 点",
        windScope: "剑风自动瞄准辅助",
        windBoots: "行走与奔跑速度 +25%",
      } as Partial<Record<ItemId, string>>
    )[item] ?? items[item].description
  );
};
const shopSubtitle: Record<ShopId, string> = {
  smith: "装备采购 · 好装备，陪你走更远的路。",
  general: "旅途补给 · 为下一程，备好行囊。",
  healer: "药草与清茶 · 照顾旅途中的你。",
  inn: "歇脚补给 · 在这里，等一阵归家的风。",
  carpenter: "修缮材料 · 让旧路通向新的远方。",
};
export async function showShop(ui: Interface, id: ShopId) {
  ui.open("shop");
  let flow: "buy" | "sell" | "exchange" | "rest" | "sleep" | "runes" =
    id === "inn" ? "rest" : "buy";
  let filter = "全部",
    selected: ItemId | undefined,
    amount = 1;
  let catalogueScroll = 0;
  const render = (feedback = "", review = false) => {
    if (ui.mode !== "shop") return;
    const panelScroll =
      ui.modal.querySelector<HTMLElement>(".shop-panel")?.scrollTop ?? 0;
    const previousGoods = ui.modal.querySelector<HTMLElement>(".shop-goods");
    if (previousGoods) catalogueScroll = previousGoods.scrollTop;
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
    const runeBody = `<section class="rune-shop" aria-label="符文商店">${RUNES.filter(
      (r) => r.acquisition.kind === "shop" && r.acquisition.key === id,
    )
      .map(
        (r) =>
          `<button data-rune-buy="${r.id}" ${s.runes.owned.includes(r.id) || s.coins < (r.acquisition.price ?? 0) ? "disabled" : ""}>${runeIcon(r.id, 40)}<span><b>${r.name}</b><small>${escape(r.description)}</small><strong>${s.runes.owned.includes(r.id) ? "已收藏" : r.acquisition.price + " 金币 · 购买"}</strong></span></button>`,
      )
      .join(
        "",
      )}</section><p class="muted">符文收藏后在符文页装备，不占行囊格。</p>`;
    const filters = ["全部", ...new Set(list.map(category))];
    const catalogue = `<section class="shop-catalogue" aria-label="商品目录">
      ${tabs.length > 1 ? `<nav class="shop-tabs" aria-label="商店服务">${tabs.map(([key, label]) => `<button data-flow="${key}" aria-pressed="${key === flow}">${label}</button>`).join("")}</nav>` : ""}
      ${
        trading
          ? `<div class="shop-catalogue-tools">${filters.length > 2 ? `<nav class="shop-filters" aria-label="商品分类">${filters.map((value) => `<button data-filter="${value}" aria-pressed="${filter === value}">${value}</button>`).join("")}</nav>` : `<span>${selling ? "可出售材料" : category(visible[0] ?? "ironSword") + "目录"}</span>`}<small>共 ${visible.length} 件 · 滚动浏览</small></div>
      <section class="shop-goods" aria-label="商品列表" tabindex="0">${
        visible
          .map(
            (
              item,
            ) => `<button class="shop-card ${selected === item ? "selected" : ""}" data-item="${item}" aria-pressed="${selected === item}">
        ${icon(item, 88)}<span class="shop-card-copy"><b>${items[item].name}</b><small>${escape(summary(item))}</small></span>
        <span class="shop-card-price"><strong><img src="/assets/commission/coin.webp" width="20" height="20" alt="">${selling ? salePrices[item] : (shop.goods as Partial<Record<ItemId, number>>)[item]} <span>金币</span></strong><small>${item === "windScope" && (count(s, item) > 0 || s.equipment.head === item) ? "已拥有" : selling ? "持有 " + count(s, item) : "库存 " + s.shopStock[`${id}:${item}`]}</small></span>
      </button>`,
          )
          .join("") || '<p class="shop-empty">此分类暂无商品。</p>'
      }</section>
      <label class="shop-select">快速选品<select id="shop-item" aria-label="物品">${visible.map((item) => `<option value="${item}" ${selected === item ? "selected" : ""}>${items[item].name}</option>`).join("")}</select></label>`
          : flow === "runes"
            ? runeBody
            : `<section class="shop-service"><h2>${name}</h2><p>${detail}</p>${flow === "exchange" ? `<p>持有药草 ${count(s, "herb")}、浆果 ${count(s, "berry")}</p>` : ""}<p class="muted">${shop.greeting}</p></section>`
      }
    </section>`;
    const controls =
      trading && selected
        ? `<p class="shop-ownership">持有 ${count(s, selected)} · 最多可${selling ? "售" : "买"} ${max}</p><div class="shop-quantity"><button data-quantity="-1" aria-label="减少数量">−</button><label><input id="shop-quantity" aria-label="数量" type="number" min="1" max="99" step="1" value="${amount}" inputmode="numeric"></label><button data-quantity="1" aria-label="增加数量">＋</button><button id="shop-max" ${max === 0 ? "disabled" : ""}>${selling ? "售出最多" : "买满"}</button></div>`
        : "";
    const quoteValid = quantityValid && !blocked;
    const quote = `<div id="shop-total" class="shop-quote"><p>${selling ? "收到" : "支付"}<b>${quoteValid ? total : "—"} 金币</b></p><p>交易后余额<b>${quoteValid ? s.coins + (selling ? total : -total) : "—"} 金币</b></p></div>`;
    const action =
      flow === "runes"
        ? ""
        : review
          ? `<button id="shop-confirm">确认${selling ? "出售" : flow === "buy" ? "购买" : flow === "exchange" ? "兑换" : flow === "sleep" ? "住宿" : "休息"}</button><button id="shop-back">重新选择</button>`
          : `<button id="shop-review" ${blocked ? "disabled" : ""}>核对交易</button>`;
    const detailBody = review
      ? `<section class="trade-review"><small>交易核对</small><h2>确认${escape(name)}</h2><p>${escape(detail)}</p><p class="muted">保存成功才完成交易。确认后请等待结果。</p></section>`
      : trading && selected
        ? `<div class="shop-detail-content">${icon(selected, 220)}<div class="shop-detail-heading"><h2>${items[selected].name}</h2><small>${category(selected)}</small></div><p>${escape(detail)}</p></div>`
        : `<div class="shop-detail-content"><h2>${flow === "runes" ? "风的收藏" : name}</h2><p>${flow === "runes" ? "收藏符文后，在符文页选择装备。符文不占行囊格。" : escape(detail)}</p></div>`;
    ui.shell(
      shop.name,
      `<div class="shop-book">
      <div class="shop-page-left">${catalogue}</div>
      <div class="shop-page-right"><div class="shop-wallet" aria-label="旅途资产"><span><img src="/assets/commission/coin.webp" width="27" height="27" alt=""><b>${s.coins}</b> 金币</span><span>行囊 <b>${s.bag.filter(Boolean).length} / 24</b></span></div>
        <section class="shop-detail" aria-label="商品详情">${detailBody}<div class="shop-checkout">${review || flow === "runes" ? "" : controls}${flow === "runes" ? "" : quote}<div class="shop-trade-actions">${action}</div><p id="shop-feedback" role="status" aria-live="polite">${escape(feedback || blocked)}</p></div></section>
      </div>
      <footer class="shop-footer"><small>次日补回基础库存 · 保存成功才完成交易</small><div class="shop-exit-actions">${s.life.playerSpace === "village" && (id === "general" || id === "smith") && ui.actions.enterShop ? '<button id="shop-enter">进入店内</button>' : ""}<button id="close">离开商店</button></div></footer>
    </div>`,
    );
    const panel = ui.modal.querySelector<HTMLElement>(".panel")!;
    panel.classList.add("shop-panel");
    const header = panel.querySelector("header")!;
    header.innerHTML = `<h1 id="panel-title">${shop.name}</h1><p>${shopSubtitle[id]}</p>`;
    panel.querySelector(".shop-page-left")!.prepend(header);
    const goods = panel.querySelector<HTMLElement>(".shop-goods");
    if (goods) goods.scrollTop = catalogueScroll;
    panel.scrollTop = panelScroll;
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
      catalogueScroll = 0;
      ui.modal.querySelector<HTMLElement>(".shop-goods")?.scrollTo(0, 0);
      render();
    });
    bind("[data-filter]", (b) => {
      filter = b.dataset.filter!;
      catalogueScroll = 0;
      ui.modal.querySelector<HTMLElement>(".shop-goods")?.scrollTo(0, 0);
      amount = 1;
      render();
    });
    bind("[data-item]", (b) => {
      selected = b.dataset.item as ItemId;
      amount = 1;
      render();
      ui.modal
        .querySelector<HTMLButtonElement>(`[data-item="${selected}"]`)
        ?.focus({ preventScroll: true });
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
        ui.modal
          .querySelector(`[data-item="${selected}"]`)
          ?.scrollIntoView({ block: "nearest" });
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
          paragraphs[0].textContent = `${valid && !blocked ? price * amount : "—"} 金币`;
        if (paragraphs[1])
          paragraphs[1].textContent = `${valid && !blocked ? s.coins + (selling ? price * amount : -price * amount) : "—"} 金币`;
        ui.modal.querySelector("#shop-feedback")!.textContent = blocked;
        ui.modal.querySelector<HTMLButtonElement>("#shop-review")!.disabled =
          !!blocked;
      };
    ui.button("shop-review", () => {
      if (blocked) return;
      render("", true);
      ui.focusPanel("shop-confirm");
      ui.modal
        .querySelector("#shop-confirm")
        ?.scrollIntoView({ block: "nearest" });
    });
    ui.button("shop-back", () => render());
    ui.button("shop-confirm", () => {
      if (request) void submit(() => ui.actions.trade(request));
    });
    ui.button("shop-enter", () => ui.actions.enterShop?.(id));
    ui.button("close", () => ui.close());
    ui.modal.querySelectorAll<HTMLButtonElement>("[data-rune-buy]").forEach(
      (b) =>
        (b.onclick = () =>
          void submit(
            () =>
              ui.actions.runeChange({
                kind: "claim",
                id: b.dataset.runeBuy!,
                shop: id,
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
