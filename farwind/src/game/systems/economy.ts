import {
  equipment,
  isEquipment,
  shops,
  salePrices,
  MAX_COINS,
  initialStock,
  stackLimit,
  type ShopId,
  type EquipmentSlot,
} from "../../data/economy";
import { items, consumables, type ItemId } from "../../data/content";
import { add, remove, craft, count, validate, type State } from "./state";
import {sleepSnapshot,type SleepSafety} from "./sleep";
export type EconomyRequest = { sequence: number } & (
  | { kind: "craft" }
  | { kind: "restock" }
  | { kind: "consume"; item: ItemId }
  | { kind: "buy" | "sell"; shop: ShopId; item: ItemId; quantity: number }
  | { kind: "exchange"; shop: ShopId; quantity: number }
  | { kind: "rest"; shop: ShopId; quantity: number }
  | { kind: "sleep"; shop: ShopId; quantity: number }
  | { kind: "equip"; slot: EquipmentSlot; item: ItemId | null }
);
function fail(message: string): never {
  throw Error(message);
}
export function economySnapshot(state: State, request: EconomyRequest, safety?:SleepSafety): State {
  if (
    !Number.isSafeInteger(request.sequence) ||
    request.sequence !== state.economyRevision + 1 ||
    request.sequence > 1e9
  )
    fail("交易已处理或已过期，请重新选择。");
  if(request.kind==="sleep"){
    if(request.shop!=="inn"||request.quantity!==1)fail("住宿服务无效。");
    return sleepSnapshot(state,request.sequence,safety!);
  }
  if (!["craft", "buy", "sell", "exchange", "rest", "equip", "restock", "consume"].includes(request.kind))
    fail("交易类型无效。");
  const next = validate(state);
  if (request.kind === "restock") {
    const day = Math.floor(next.time / 1440);
    if (day <= next.shopStockDay) fail("今天的库存已经补齐。");
    for (const [key, stock] of Object.entries(initialStock())) next.shopStock[key] = Math.max(next.shopStock[key], stock);
    next.shopStockDay = day;
  } else if (request.kind === "consume") {
    const effect = consumables[request.item];
    if (!effect) fail("这件物品不能食用或饮用。");
    if ((effect.hp === 0 || next.player.hp >= 100) && (effect.stamina === 0 || next.player.stamina >= 100)) fail("状态充足，暂时不用消耗物品。");
    if (!remove(next, request.item, 1)) fail("行囊里没有这个物品。");
    next.player.hp = Math.min(100, next.player.hp + effect.hp);
    next.player.stamina = Math.min(100, next.player.stamina + effect.stamina);
  } else if (request.kind === "craft") {
    if (count(next, "herb") < 2 || count(next, "berry") < 1)
      fail("需要药草×2、浆果×1；未扣材料。");
    if (!craft(next)) fail("行囊没有成品空间，请腾出一格；未扣材料。");
  } else if (request.kind === "equip") {
    const { item, slot } = request;
    if (slot !== "weapon" && slot !== "armor") fail("装备栏位无效。");
    if (item !== null && (!isEquipment(item) || equipment[item].slot !== slot))
      fail("装备与栏位不匹配。");
    if (next.equipment[slot] === item) fail("已经穿戴这件装备。");
    if (item !== null && !remove(next, item, 1)) fail("行囊里没有这件装备。");
    const old = next.equipment[slot];
    if (old && !add(next, old, 1)) fail("行囊已满，尚未卸下装备。");
    next.equipment[slot] = item;
  } else {
    if (!Object.hasOwn(shops, request.shop)) fail("商店不存在。");
    if (
      !Number.isSafeInteger(request.quantity) ||
      request.quantity < 1 ||
      request.quantity > 99
    )
      fail("数量必须是1到99的整数。");
    if (request.kind === "exchange") {
      if (request.shop !== "healer" || request.quantity !== 1)
        fail("本次只调制一瓶药剂。");
      if (!craft(next)) fail("需要药草×2、浆果×1和成品空间；未扣材料。");
    } else if (request.kind === "rest") {
      if (request.shop !== "inn" || request.quantity !== 1)
        fail("旅馆服务无效。");
      if (next.player.hp === 100 && next.player.stamina === 100)
        fail("生命与体力已满，无需花费。");
      if (next.coins < 12) fail("铜币不足，休息需要12枚。");
      next.coins -= 12;
      next.player.hp = next.player.stamina = 100;
    } else {
      if (!Object.hasOwn(items, request.item)) fail("物品不存在。");
      const key = `${request.shop}:${request.item}`;
      if (request.kind === "buy") {
        const price = (
          shops[request.shop].goods as Partial<Record<ItemId, number>>
        )[request.item];
        if (price === undefined) fail("本店没有这件商品。");
        if (next.shopStock[key] < request.quantity) fail("商店库存不足。");
        if (next.coins < price * request.quantity) fail("铜币不足，未扣款。");
        if (!add(next, request.item, request.quantity))
          fail("行囊空间不足，未扣款。");
        next.coins -= price * request.quantity;
        next.shopStock[key] -= request.quantity;
      } else {
        const price = salePrices[request.item];
        if (request.shop !== "general" || price === undefined)
          fail("本店不收购此物品，任务物品不可出售。");
        if (!remove(next, request.item, request.quantity))
          fail("物品数量不足。");
        if (
          next.coins + price * request.quantity > MAX_COINS ||
          next.shopStock[key] + request.quantity > 9999
        )
          fail("交易超过储存上限，未扣除物品。");
        next.coins += price * request.quantity;
        next.shopStock[key] += request.quantity;
      }
    }
  }
  next.economyRevision = request.sequence;
  return validate(next);
}
// 持久化成功之后才发布快照；失败和并发请求都不能改动原状态。
export class EconomyCommit {
  busy = false;
  async run(
    read: () => State,
    request: EconomyRequest,
    write: (s: State) => Promise<void>,
    publish: (s: State) => void,
  ) {
    if (this.busy) fail("交易正在保存，请稍候。");
    this.busy = true;
    try {
      const next = economySnapshot(read(), request);
      await write(next);
      publish(next);
    } finally {
      this.busy = false;
    }
  }
}
export function outgoingDamage(state: State, base: number) {
  return (
    base +
    (state.equipment.weapon ? equipment[state.equipment.weapon].bonus : 0)
  );
}
export function incomingDamage(state: State, base: number) {
  return Math.max(
    1,
    base - (state.equipment.armor ? equipment[state.equipment.armor].bonus : 0),
  );
}

// 预览上限与事务仍各自验证；交易后再次按权威状态校验，不信任界面数量。
export function maxTradeQuantity(state: State, shop: ShopId, item: ItemId, selling = false) {
  const stock = state.shopStock[`${shop}:${item}`] ?? 0;
  if(selling&&(shop!=="general"||salePrices[item]===undefined))return 0;
  if (selling) return Math.max(0, Math.min(99, count(state, item), 9999 - stock, Math.floor((MAX_COINS - state.coins) / (salePrices[item] ?? MAX_COINS))));
  const price = (shops[shop].goods as Partial<Record<ItemId, number>>)[item];
  if (!price) return 0;
  const limit = stackLimit(item);
  const capacity = state.bag.reduce((sum, slot) => sum + (!slot ? limit : slot.id === item ? limit - slot.count : 0), 0);
  return Math.max(0, Math.min(99, stock, capacity, Math.floor(state.coins / price)));
}
