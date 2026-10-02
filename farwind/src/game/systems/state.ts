import {initialWindMemory,validateWindMemory,type WindMemoryState} from './windMemory';
import {initialWindGifts,validateWindGifts,type WindGiftState} from './windGifts';
import {initialXiaobaoLife} from './xiaobaoLifeState';
import {initialCatBond,migrateCatBond,validateCatBond,type CatBondState} from './catBond';
import {initialWindLegacy,validateWindLegacy,type WindLegacyState} from './windLegacyState';
import {migrateInteriorPosition} from '../../data/villageInteriors';
import {initialRunes,migrateBuildRunes,validateRunes,type RuneState} from './runeState';
import {initialSouthEvents,validateSouthEvents,type SouthEventState} from './southEvents';
import {initialEncounters,validateEncounters,unitState,settleEncounterDeath,migrateCampBosses,type EncounterState} from "./encounterState";
import {ENCOUNTERS} from '../../data/maps/windbell/encounters';
import {initialDemonKing,validateDemonKing,demonMalice,type DemonKingState} from './demonKingState';
import {initialFieldQuests,validateFieldQuests,type FieldQuestState} from "./fieldQuestState";
import {SHORTCUT_IDS,type ShortcutId} from "../../data/maps/windbell/shortcuts";
import {WORLD_PLAYABLE as B,CURRENT_MAP_VERSION} from "../../data/maps/windbell/bounds";
import {initialSkills,validateSkills,migrateLegacySkills} from './skills';
import {initialXiaobao,validateXiaobao,type XiaobaoState} from './xiaobaoState';
import type {SkillState} from '../../data/windLessons';
import {initialLife,validateLife,type LifeState} from './npcLifeState';
import {
  STARTER_COINS,
  MAX_COINS,
  initialStock,
  stackLimit,
  isEquipment,
  equipment,
  RETURN_WIND_ORB,
  type EquipmentId,
  type EquipmentSlot,
} from "../../data/economy";
import { props, enemyDefs, WORLD } from "../../data/world";
import { items, type ItemId } from "../../data/content";
import { initialDefense, migrateEastDefense, validateDefense, type DefenseState } from "./defenseState";
import {initialNight,migratedNight,validateNight,type NightState} from "./nightDirector";
import { JOURNEY_MAX_DISTANCE, playerVitals } from './journeyTraining';
export type Slot = { id: ItemId; count: number } | null;
export type State = {
  content_version: 2;
  windGifts: WindGiftState;
  windMemory: WindMemoryState;
  runes: RuneState;
  skills: SkillState;
  windLegacy:WindLegacyState;
  schema_version: 21;
  catBond: CatBondState;
  physique: { runDistance: number };
  demonKing:DemonKingState;
  encounters:EncounterState;
  southEvents:SouthEventState;
  fieldQuests:FieldQuestState;
  mapProgress: {westRoad:"unknown"|"surveyed"|"open";shortcuts:ShortcutId[]};
  xiaobao: XiaobaoState;
  life: LifeState;
  night: NightState;
  defense: DefenseState;
  coins: number;
  equipment: Record<EquipmentSlot, EquipmentId | null>;
  shopStock: Record<string, number>;
  shopStockDay: number;
  economyRevision: number;
  map_version?: 2 | 3 | 4 | 5 | 6 | 7 | 8;
  player: { x: number; y: number; hp: number; stamina: number };
  bag: Slot[];
  hotbar: (ItemId | null)[];
  quest: number;
  side: number;
  collected: Record<string, number>;
  chests: string[];
  killed: string[];
  pendingDrops: { enemyId: string; item: ItemId; x: number; y: number }[];
  dashCooldownRemaining: number;
  stones: number[];
  shortcut: boolean;
  time: number;
  reward: boolean;
  crafted: boolean;
};
export const initialState = (): State => ({
  content_version: 2,
  windGifts: initialWindGifts(),
  windMemory: initialWindMemory(),
  runes: initialRunes(),
  skills: initialSkills(),
  windLegacy:initialWindLegacy(),
  schema_version: 21,
  catBond: initialCatBond(),
  physique: { runDistance: 0 },
  demonKing:initialDemonKing(),
  encounters:initialEncounters(),
  southEvents:initialSouthEvents(),
  fieldQuests:initialFieldQuests(),
  mapProgress: {westRoad:"unknown",shortcuts:[]},
  xiaobao: initialXiaobao(),
  life: initialLife(),
  night: initialNight(),
  defense: initialDefense(),
  coins: STARTER_COINS,
  equipment: { weapon: null, armor: null, head: null, feet: null },
  shopStock: initialStock(),
  shopStockDay: 0,
  economyRevision: 0,
  map_version: CURRENT_MAP_VERSION,
  player: { ...RETURN_WIND_ORB.respawn, hp: 100, stamina: 100 },
  bag: Array(24).fill(null),
  hotbar: ["potion", "berry", null, null, null, null, null, null],
  quest: 0,
  side: 0,
  collected: {},
  chests: [],
  killed: [],
  pendingDrops: [],
  dashCooldownRemaining: 0,
  stones: [],
  shortcut: false,
  time: 8 * 60,
  reward: false,
  crafted: false,
});
export function count(s: State, id: ItemId) {
  return s.bag.reduce((n, a) => n + (a?.id === id ? a.count : 0), 0);
}
export function add(s: State, id: ItemId, n: number) {
  if (!Object.hasOwn(items, id) || !Number.isSafeInteger(n) || n < 1 || n > 480)
    return false;
  const limit = stackLimit(id);
  const copy = structuredClone(s.bag);
  for (let i = 0; i < 24 && n; i++) {
    const a = copy[i];
    if (a?.id === id && a.count < limit) {
      const k = Math.min(n, limit - a.count);
      a.count += k;
      n -= k;
    }
  }
  for (let i = 0; i < 24 && n; i++)
    if (!copy[i]) {
      const k = Math.min(limit, n);
      copy[i] = { id, count: k };
      n -= k;
    }
  if (n) return false;
  s.bag = copy;
  return true;
}
export function remove(s: State, id: ItemId, n: number) {
  if (!Object.hasOwn(items, id) || !Number.isSafeInteger(n) || n < 1 || n > 480)
    return false;
  if (count(s, id) < n) return false;
  for (let i = 0; i < 24 && n; i++) {
    const a = s.bag[i];
    if (a?.id === id) {
      const k = Math.min(a.count, n);
      a.count -= k;
      n -= k;
      if (!a.count) s.bag[i] = null;
    }
  }
  return true;
}
export function craft(s: State) {
  const next = structuredClone(s);
  if (
    !remove(next, "herb", 2) ||
    !remove(next, "berry", 1) ||
    !add(next, "potion", 1)
  )
    return false;
  s.bag = next.bag;
  s.crafted = true;
  if (s.quest === 2) s.quest = 3;
  return true;
}
export function reward(s: State) {
  if (s.reward || s.quest !== 6) return false;
  if (!add(s, "potion", 3)) return false;
  s.reward = true;
  s.quest = 7;
  return true;
}
export function validate(raw: unknown): State {
  const s = structuredClone(raw) as State;
  const version = (s as { schema_version?: number })?.schema_version;
  if (s && version === 1) {
    s.pendingDrops ??= [];
    s.dashCooldownRemaining ??= 0;
    (s as {schema_version:number}).schema_version = 2;
    s.coins = STARTER_COINS;
    s.equipment = { weapon: null, armor: null, head: null, feet: null };
    s.shopStock = initialStock();
    s.economyRevision = 0;
  }
  if (s && (s as {schema_version:number}).schema_version === 2) {
    (s as {schema_version:number}).schema_version = 4;
    s.defense = initialDefense();
  }
  if (s && version === 3) { s.defense = migrateEastDefense(s.defense); (s as {schema_version:number}).schema_version = 4; }
  if(s&&(s as {schema_version:number}).schema_version===4){s.night=migratedNight(s.time);(s as {schema_version:number}).schema_version=5;}
  if(s&&(s as {schema_version:number}).schema_version===5){s.life=initialLife(s.time);(s as {schema_version:number}).schema_version=6;}
  if(s&&(s as {schema_version:number}).schema_version===6){s.skills=migrateLegacySkills(s.skills);(s as {schema_version:number}).schema_version=7;}
  if(s&&(s as {schema_version:number}).schema_version===7){s.xiaobao=initialXiaobao();(s as {schema_version:number}).schema_version=8;}
  if(s&&(s as {schema_version:number}).schema_version===8){
    s.mapProgress={westRoad:"unknown",shortcuts:[]};
    // 只补 M1 阶段尚不存在的西门岗位；已有九名卫兵的伤亡原样保留。
    if(s.defense?.guards?.length===9){s.defense.guards.push(...initialDefense().guards.slice(9));const added=initialLife(s.time).people.filter(p=>p.id.startsWith('west-'));s.life.people.push(...added);}
    (s as {schema_version:number}).schema_version=9;
  }
  if(s&&(s as {schema_version:number}).schema_version===9){if(s.mapProgress)s.mapProgress.shortcuts=[];(s as {schema_version:number}).schema_version=10;}
  if(s&&(s as {schema_version:number}).schema_version===10){s.encounters=initialEncounters();s.fieldQuests=initialFieldQuests();(s as {schema_version:number}).schema_version=11;}
  if(s&&(s as {schema_version:number}).schema_version===11){
    // M3开发存档只补新增固定槽位，原有三组清剿、奖励及伤势不重置。
    const fresh=initialEncounters();
    if(!["south-reed-patrol","south-herb-patrol","south-spore-camp"].every(id=>s.encounters?.groups?.[id]))throw Error("M3遭遇记录缺失，不能重建为未清剿状态。");
    if(s.encounters?.groups){for(const [id,g] of Object.entries(fresh.groups)){
      if(!s.encounters.groups[id])s.encounters.groups[id]=g;
      else for(const u of s.encounters.groups[id].members??[])Object.assign(u,{face:{x:0,y:1},guardOpen:0});
    }}
    (s as {schema_version:number}).schema_version=12;
  }
  if(s&&(s as {schema_version:number}).schema_version===12){
    // 结构12的九组仍须完整；只补后来加入的遭遇槽位与可选字段。
    const existing=['south-reed-patrol','south-herb-patrol','south-spore-camp','south-orchard-burrows','west-track-pack','north-stone-watch','west-wolf-den','north-boar-camp','east-thorn-camp'];
    if(!s.encounters?.groups||existing.some(id=>!s.encounters.groups[id]))throw Error('旧据点记录缺失，不能覆盖清剿进度。');
    s.encounters.broken??=[];const fresh=initialEncounters();
    for(const d of ENCOUNTERS){s.encounters.groups[d.id]??=fresh.groups[d.id];s.encounters.groups[d.id].warning??=null;}
    migrateCampBosses(s.encounters);
    for(const d of ENCOUNTERS){
      // 旧固定成员的死亡保持死亡；原有掉落留在旧列表，避免生成第二份。
      d.members.forEach(m=>{if(s.killed?.includes(m.id)){s.encounters.groups[d.id].activated=true;settleEncounterDeath(s.encounters,m.id,false);}});
    }
    for(const d of ENCOUNTERS.filter(d=>d.kind==='camp')){const g=s.encounters.groups[d.id];if(d.members.every((m,i)=>m.boss||g.members[i].defeated))g.cleared=true;}
    s.demonKing=initialDemonKing(s.encounters);(s as {schema_version:number}).schema_version=13;
  }
  if(s&&(s as {schema_version:number}).schema_version===13){s.encounters=migrateCampBosses(s.encounters);(s as {schema_version:number}).schema_version=14;}
  if(s&&(s as {schema_version:number}).schema_version===14){
    if(s.skills){s.skills.meleeFinisher??=false;s.skills.buildLessons??=[];}
    s.runes=migrateBuildRunes(s.runes);(s as {schema_version:number}).schema_version=15;
  }
  if(s&&(s as {schema_version:number}).schema_version===15){s.skills=validateSkills(s.skills);s.runes=migrateBuildRunes(s.runes);}
  // 商店子版本迁移：只补新增商品，旧库存与余额不重置。
  if (s && (s as {schema_version:number}).schema_version === 15 && s.shopStockDay === undefined) {
    const legacy = ["general:wood", "general:stone", "general:herb", "general:berry", "general:potion", "healer:potion", "smith:ironSword", "smith:leatherCoat"];
    if (!s.shopStock || legacy.some(key => !Object.hasOwn(s.shopStock, key))) throw Error("旧商店库存缺失，不能重置交易记录。");
    for (const [key, stock] of Object.entries(initialStock())) s.shopStock[key] ??= stock;
    s.shopStockDay = Math.floor(s.time / 1440);
    if(s.life&&s.player)migrateInteriorPosition(s.life.playerSpace,s.player);
    if(Array.isArray(s.life?.people))for(const n of s.life.people)if(n.body)migrateInteriorPosition(n.body.space,n.body);
  }
  if(s && (s as {schema_version:number}).schema_version===15){
    if(!s.equipment || !s.shopStock)throw Error("旧装备或商店记录缺失，请使用备份。");
    s.equipment.head=null;s.shopStock["smith:windScope"]=1;(s as {schema_version:number}).schema_version=16;
  }
  if(s&&(s as {schema_version:number}).schema_version===16){s.windLegacy=initialWindLegacy();s.runes=migrateBuildRunes(s.runes);const fresh=initialEncounters();for(const id of Object.keys(fresh.groups).filter(id=>id.startsWith('legacy-')))s.encounters.groups[id]??=fresh.groups[id];(s as {schema_version:number}).schema_version=17;}
  if(s&&(s as {schema_version:number}).schema_version===17){
    // 仅新增空鞋槽与鞋子库存，不赠送装备，不重置原有金币和交易。
    if(!s.equipment||!s.shopStock)throw Error("旧装备或商店记录缺失，请使用备份。");
    s.equipment.feet=null;s.shopStock["smith:windBoots"]=initialStock()["smith:windBoots"];(s as {schema_version:number}).schema_version=18;
  }
  if(s&&(s as {schema_version:number}).schema_version===18){
    // 历史奔跑没有可信记录，只补零里程；不改变已有旅途状态。
    s.physique={runDistance:0};(s as {schema_version:number}).schema_version=19;
  }
  if(s&&(s as {schema_version:number}).schema_version===19){s.catBond=migrateCatBond(s);(s as {schema_version:number}).schema_version=20;}
  if(s&&(s as {schema_version:number}).schema_version===20){
    s.xiaobao.space='village';s.xiaobao.life=initialXiaobaoLife();s.xiaobao.autoSupport=true;
    (s as {schema_version:number}).schema_version=21;
  }
  // 仅内部历史结构校验兼容；正式读取及导入在调用前拒绝旧内容版本。
  if(s&&(s as {schema_version:number}).schema_version===21&&(s as {content_version:number}).content_version!==2){s.windGifts=initialWindGifts();s.windMemory=initialWindMemory();s.content_version=2;}
  if(s&&s.schema_version===21){s.windGifts=validateWindGifts(s.windGifts);s.windMemory=validateWindMemory(s.windMemory);s.skills=validateSkills(s.skills);s.runes=validateRunes(s.runes);s.windLegacy=validateWindLegacy(s.windLegacy);}
  const num = (n: unknown, min: number, max: number) =>
    typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
  const strarr = (a: unknown) =>
    Array.isArray(a) &&
    a.length < 300 &&
    a.every((x) => typeof x === "string" && x.length < 80);
  if (!s?.physique || !num(s.physique.runDistance, 0, JOURNEY_MAX_DISTANCE))
    throw Error("锻炼里程无效，请使用有效存档或备份。");
  const vitals = playerVitals(s);
  if (
    !s ||
    s.schema_version !== 21 || s.content_version !== 2 ||
    !s.mapProgress || !["unknown","surveyed","open"].includes(s.mapProgress.westRoad) ||
    !Array.isArray(s.mapProgress.shortcuts) || s.mapProgress.shortcuts.length>3 || new Set(s.mapProgress.shortcuts).size!==s.mapProgress.shortcuts.length || !s.mapProgress.shortcuts.every(id=>SHORTCUT_IDS.includes(id)) ||
    (s.map_version !== undefined &&
      s.map_version !== 2 &&
      s.map_version !== 3 &&
      s.map_version !== 4 &&
      s.map_version !== 5 &&
      s.map_version !== 6 &&
      s.map_version !== 7 && s.map_version !== CURRENT_MAP_VERSION) ||
    !s.player ||
    !num(
      s.player.x,
      s.map_version === CURRENT_MAP_VERSION ? B.left : 25,
      s.map_version === CURRENT_MAP_VERSION ? B.right : s.map_version !== undefined ? 4175 : 3575,
    ) ||
    !num(s.player.y, s.map_version === CURRENT_MAP_VERSION ? B.top : 25, s.map_version === CURRENT_MAP_VERSION ? B.bottom : 2175) ||
    !num(s.player.hp, 1, vitals.maxHp) ||
    !num(s.player.stamina, 0, vitals.maxStamina) ||
    !Array.isArray(s.bag) ||
    s.bag.length !== 24 ||
    !s.bag.every(
      (a) =>
        a === null ||
        (a &&
          Object.hasOwn(items, a.id) &&
          Number.isInteger(a.count) &&
          num(a.count, 1, stackLimit(a.id))),
    ) ||
    !Array.isArray(s.hotbar) ||
    s.hotbar.length !== 8 ||
    !s.hotbar.every((a) => a === null || Object.hasOwn(items, a)) ||
    !Number.isInteger(s.quest) ||
    !num(s.quest, 0, 7) ||
    !num(s.side, 0, 2) ||
    !strarr(s.chests) ||
    !strarr(s.killed) ||
    !Array.isArray(s.pendingDrops) ||
    s.pendingDrops.length > enemyDefs.length ||
    !s.pendingDrops.every(
      (d) =>
        d &&
        typeof d.enemyId === "string" &&
        Object.hasOwn(items, d.item) &&
        num(d.x, s.map_version === CURRENT_MAP_VERSION ? B.left : 30, s.map_version === CURRENT_MAP_VERSION ? B.right : s.map_version !== undefined ? 4170 : 3570) &&
        num(d.y,s.map_version === CURRENT_MAP_VERSION ? B.top : 80,s.map_version === CURRENT_MAP_VERSION ? B.bottom : 2170),
    ) ||
    !num(s.dashCooldownRemaining, 0, 650) ||
    !Array.isArray(s.stones) ||
    s.stones.length > 3 ||
    !s.stones.every((n) => Number.isInteger(n) && num(n, 0, 2)) ||
    typeof s.shortcut !== "boolean" ||
    typeof s.reward !== "boolean" ||
    typeof s.crafted !== "boolean" ||
    !num(s.time, 0, 1e8) ||
    !s.collected ||
    typeof s.collected !== "object" ||
    Object.entries(s.collected).length > 300 ||
    !Object.entries(s.collected).every(
      ([k, v]) => k.length < 80 && num(v, 0, 1e8),
    )
  )
    throw Error("存档损坏或版本不兼容，请导入有效的外部备份。");
  if (
    !Number.isSafeInteger(s.coins) ||
    !num(s.coins, 0, MAX_COINS) ||
    !Number.isSafeInteger(s.economyRevision) ||
    !num(s.economyRevision, 0, 1e9) ||
    !Number.isSafeInteger(s.shopStockDay) ||
    !num(s.shopStockDay, 0, Math.floor(s.time / 1440)) ||
    !s.equipment ||
    !(["weapon", "armor", "head", "feet"] as const).every((slot) => {
      const id = s.equipment[slot];
      return id === null || (isEquipment(id) && equipment[id].slot === slot);
    }) ||
    (count(s,"windScope")+(s.equipment.head==="windScope"?1:0)>1) ||
    !s.shopStock ||
    typeof s.shopStock !== "object" ||
    Object.keys(s.shopStock).length !== Object.keys(initialStock()).length ||
    !Object.keys(initialStock()).every(
      (key) =>
        Number.isSafeInteger(s.shopStock[key]) &&
        num(s.shopStock[key], 0, 9999),
    )
  )
    throw Error("存档交易或装备状态无效，请使用有效备份。");
  if(s.runes.growth.r32.advanced!==(s.windLegacy.wind>=3)||s.runes.growth.r12.advanced!==(s.windLegacy.blade>=3))throw Error('传承与符文进阶记录不一致。');
  s.encounters=validateEncounters(s.encounters);s.southEvents=validateSouthEvents(s.southEvents,s.encounters);s.fieldQuests=validateFieldQuests(s.fieldQuests);
  s.demonKing=validateDemonKing(s);
  for(const key of ['wind','blade'] as const){const phase=s.windLegacy[key];if(phase>=3&&!s.encounters.groups[key==='wind'?'legacy-wind-device':'legacy-blade-post'].cleared||phase===4&&!s.encounters.groups[key==='wind'?'legacy-wind-passage':'legacy-blade-road'].cleared)throw Error('传承节点与战斗记录不一致。');}
  if(s.windLegacy.ending&&(!s.encounters.groups['east-thorn-camp'].cleared||!s.mapProgress.shortcuts.includes('east-corridor')))throw Error('传承归途与据点或回廊记录不一致。');
  if(s.fieldQuests["south-supply"]==="complete"&&!s.encounters.groups["south-spore-camp"].cleared)throw Error("南部委托与据点进度不一致。");
  s.defense = validateDefense(s.defense);
  if((s.defense.raid?.order?.malice??0)>demonMalice(s.encounters))throw Error('在途魔王派遣与清剿进度不一致。');
  s.xiaobao=validateXiaobao(s.xiaobao,s.killed,s.defense.raid?.members.map(m=>m.id)??[],s.windMemory.active?.encounters??s.encounters);
  s.night=validateNight(s);
  s.life=validateLife(s.life,s.time);
  if(s.xiaobao.life.day>Math.floor(s.time/1440)||s.xiaobao.life.journal.some(e=>e.time>s.time))throw Error('小宝的经历时间不能晚于世界时间。');
  s.catBond=validateCatBond(s.catBond,s.time,vitals.maxHp);
  const validIds = (ids: string[], kind: string) =>
    new Set(ids).size === ids.length &&
    ids.every((id) => props.some((p) => p.id === id && p.kind === kind));
  if (
    !validIds(s.chests, "chest") ||
    !s.killed.every((id) => enemyDefs.some((e) => e.id === id)) ||
    !s.pendingDrops.every(
      (d) =>
        s.killed.includes(d.enemyId) &&
        enemyDefs.some(
          (e) =>
            e.id === d.enemyId &&
            d.item === (e.type === "leaf" ? "crystal" : "berry"),
        ),
    ) ||
    new Set(s.pendingDrops.map((d) => d.enemyId)).size !==
      s.pendingDrops.length ||
    !Object.keys(s.collected).every((id) =>
      props.some((p) => p.id === id && p.kind === "resource"),
    ) ||
    !s.stones.every((n, i) => n === i) ||
    !Number.isInteger(s.side) ||
    (s.shortcut && (s.stones.length !== 3 || s.quest < 6)) ||
    s.reward !== (s.quest === 7)
  )
    throw Error("存档世界状态不一致，请使用有效备份。");
  // 旧地图只平移森林与遗迹；稳定交互编号及背包、任务全部保留。
  if (s.map_version === undefined) {
    if (s.player.x >= 1450) s.player.x += 600;
    s.pendingDrops.forEach((d) => {
      if (d.x >= 1450) d.x += 600;
    });
    s.map_version = 2;
  }
  // 村界版本3不平移世界；进入场景时按真实碰撞修复不合法站位。
  if (s.map_version === 2) s.map_version = 3;
  // 生活建筑版本4不平移世界；场景根据正式碰撞就近恢复旧站位。
  if (s.map_version === 3) s.map_version = 4;
  // 东门塔基版本5不平移世界，不重复执行旧地图迁移。
  if (s.map_version === 4) s.map_version = 5;
  // 三门塔基版本6无坐标平移；旧档碰撞由场景就近修复。
  if (s.map_version === 5) s.map_version = 6;
  // M1建筑归位只改变地图布局，主结构仍为8；正式入口不接收旧地图存档。
  if (s.map_version === 6) s.map_version = 7;
  if(s.map_version===7)s.map_version=CURRENT_MAP_VERSION;
  return structuredClone(Object.fromEntries(Object.keys(initialState()).map(key=>[key,s[key as keyof State]]))) as State;
}
export const MAX_SAVE_BYTES = 2_000_000;
export function parseSave(text: string) {
  if (new TextEncoder().encode(text).byteLength > MAX_SAVE_BYTES) throw Error("存档超过 2 MB 限制");
  const raw = JSON.parse(text);
  if(raw?.content_version!==2||raw?.schema_version!==21)throw Error('此备份属于旧战斗版本，请从全新旅途开始；旧备份未改动。');
  if(raw?.map_version !== CURRENT_MAP_VERSION)throw Error('第一张地图从全新旅途开始，此文件属于旧地图；原存档文件未改动。');
  return validate(raw);
}

// 关键任务材料不可丢弃，避免有限敌人掉落耗尽后无法完成主线。
export function discard(s: State, id: ItemId) {
  if (id === "crystal") return false;
  return remove(s, id, 1);
}
