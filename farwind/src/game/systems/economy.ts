import {
  equipment,
  isEquipment,
  shops,
  salePrices,
  MAX_COINS,
  type ShopId,
  type EquipmentSlot,
} from "../../data/economy";
import { items, type ItemId } from "../../data/content";
import { add, remove, craft, validate, type State } from "./state";
export type EconomyRequest = { sequence: number } & (
  | { kind: "buy" | "sell"; shop: ShopId; item: ItemId; quantity: number }
  | { kind: "exchange"; shop: ShopId; quantity: number }
  | { kind: "rest"; shop: ShopId; quantity: number }
  | { kind: "equip"; slot: EquipmentSlot; item: ItemId | null }
);
function fail(message: string): never {
  throw Error(message);
}
export function economySnapshot(state: State, request: EconomyRequest): State {
  if (
    !Number.isSafeInteger(request.sequence) ||
    request.sequence !== state.economyRevision + 1 ||
    request.sequence > 1e9
  )
    fail("交易已处理或已过期，请重新选择。");
  if (!["buy", "sell", "exchange", "rest", "equip"].includes(request.kind))
    fail("交易类型无效。");
  const next = validate(state);
  if (request.kind === "equip") {
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
