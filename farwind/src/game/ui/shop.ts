import { items, itemIcon, type ItemId } from "../../data/content";
import { shops, salePrices, type ShopId } from "../../data/economy";
import { count } from "../systems/state";
import type { EconomyRequest } from "../systems/economy";
import type { Interface } from "./interface";
import {DAY_NIGHT} from "../../data/dayNight";
import {phaseAt} from "../systems/worldClock";
export function showShop(ui: Interface, id: ShopId) {
  ui.open("shop");
  let flow: "buy" | "sell" | "exchange" | "rest" | "sleep" =
    id === "inn" ? "rest" : "buy";
  let selected: ItemId | undefined;
  let amount = 1;
  const render = (feedback = "", review = false) => {
    const s = ui.state!,
      shop = shops[id];
    const list =
      flow === "buy"
        ? (Object.keys(shop.goods) as ItemId[])
        : flow === "sell"
          ? (Object.keys(salePrices) as ItemId[])
          : [];
    if (!selected || !list.includes(selected)) selected = list[0];
    const price =
      flow === "buy"
        ? (shop.goods as Partial<Record<ItemId, number>>)[selected!]!
        : flow === "sell"
          ? salePrices[selected!]!
          : flow === "rest"
            ? 12
            : 0;
    const name =
      flow === "exchange"
        ? "恢复药剂×1"
        : flow === "sleep" ? "住一晚 · 睡到清晨06:00"
        : flow === "rest"
          ? "恢复生命与体力"
          : `${items[selected!].name}×${amount}`;
    const detail =
      flow === "exchange"
        ? "扣除药草×2、浆果×1；成品空间不足时不扣材料。"
        : flow === "sleep" ? `${DAY_NIGHT.sleepCost}铜币，恢复生命与体力；跳过尚未开始的当夜来袭，不获得战斗奖励。${phaseAt(s.time)==="night"?"":"仅19:00—06:00前开放。"}`
        : flow === "rest"
          ? "12枚铜币，恢复至100；不推进时间。"
          : `${flow === "buy" ? "支付" : "收到"}${price * amount}枚铜币（单价${price}）`;
    ui.shell(
      shop.name,
      `<div class="shop-summary"><b>铜币 ${s.coins}</b><span>行囊 ${s.bag.filter(Boolean).length}/24格</span></div><p>${shop.greeting}</p><div class="shop-tabs">${id === "inn" ? '<button data-flow="rest">休息补给</button><button data-flow="sleep">住一晚 · 睡到清晨06:00 · 12铜币</button>' : ""}${id !== "inn" ? '<button data-flow="buy">购买</button>' : ""}${id === "general" ? '<button data-flow="sell">出售材料</button>' : ""}${id === "healer" ? '<button data-flow="exchange">调制药剂</button>' : ""}</div>${review ? `<div class="trade-review"><h2>确认${name}</h2><p>${detail}</p><p class="muted">保存成功才完成交易。确认后请等待结果。</p></div>` : list.length ? `<div class="shop-form"><label>物品<select id="shop-item" aria-label="物品">${list.map((item) => `<option value="${item}" ${item === selected ? "selected" : ""}>${items[item].name} · ${flow === "buy" ? `单价${(shop.goods as Partial<Record<ItemId, number>>)[item]} / 库存${s.shopStock[`${id}:${item}`]}` : `单价${salePrices[item]} / 持有${count(s, item)}`}</option>`).join("")}</select></label><label>数量<input id="shop-quantity" type="number" min="1" max="99" step="1" value="${amount}" inputmode="numeric"></label></div><p id="shop-description">${items[selected!].description}</p><p id="shop-total">${detail}</p>` : `<p>${detail}</p>${flow === "exchange" ? `<p>持有药草${count(s, "herb")}、浆果${count(s, "berry")}</p>` : ""}`}<p id="shop-feedback" role="status" aria-live="polite">${feedback}</p><div class="row">${review ? `<button id="shop-confirm">确认${flow === "buy" ? "购买" : flow === "sell" ? "出售" : flow === "exchange" ? "兑换" : flow === "sleep" ? "住宿" : "休息"}</button><button id="shop-back">重新选择</button>` : '<button id="shop-review">核对交易</button>'}<button id="close">离开商店</button></div>`,
    );
    ui.modal.querySelectorAll<HTMLButtonElement>("[data-flow]").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.flow === flow));
      b.onclick = () => {
        flow = b.dataset.flow as typeof flow;
        amount = 1;
        render();
      };
    });
    const choose = ui.modal.querySelector<HTMLSelectElement>("#shop-item");
    if (choose)
      choose.onchange = () => {
        selected = choose.value as ItemId;
        render();
        ui.focusPanel("shop-item");
      };
    const quantity = ui.modal.querySelector<HTMLInputElement>("#shop-quantity");
    if (quantity)
      quantity.oninput = () => {
        amount = quantity.valueAsNumber;
        ui.modal.querySelector("#shop-total")!.textContent =
          Number.isSafeInteger(amount) && amount >= 1 && amount <= 99
            ? `${flow === "buy" ? "支付" : "收到"}${price * amount}枚铜币（单价${price}）`
            : "数量必须是1到99的整数。";
      };
    ui.button("shop-review", () => {
      if (!Number.isSafeInteger(amount) || amount < 1 || amount > 99) {
        ui.modal.querySelector("#shop-feedback")!.textContent =
          "数量必须是1到99的整数。";
        return;
      }
      render("", true);
      ui.focusPanel("shop-confirm");
    });
    // 序号在核对页固定；双击、过期页面和旧请求不能重复扣款。
    const request: EconomyRequest =
      flow === "buy" || flow === "sell"
        ? {
            sequence: s.economyRevision + 1,
            kind: flow,
            shop: id,
            item: selected!,
            quantity: amount,
          }
        : {
            sequence: s.economyRevision + 1,
            kind: flow,
            shop: id,
            quantity: 1,
          };
    ui.button("shop-confirm", () => void submit(request));
    ui.button("shop-back", () => render());
    ui.button("close", () => ui.close());
  };
  const submit = async (request: EconomyRequest) => {
    if (ui.economyBusy) return;
    ui.economyBusy = true;
    ui.modal
      .querySelectorAll<
        HTMLButtonElement | HTMLInputElement | HTMLSelectElement
      >("button,input,select")
      .forEach((b) => (b.disabled = true));
    ui.modal.querySelector("#shop-feedback")!.textContent = "正在保存交易……";
    let feedback: string;
    try {
      await ui.actions.trade(request);
      feedback = "交易已完成并保存。";
    } catch (e) {
      feedback = `未完成交易：${(e as Error).message}`;
    } finally {
      ui.economyBusy = false;
    }
    render(feedback);
    ui.focusPanel("shop-review");
  };
  render();
  ui.focusPanel("shop-review");
}
