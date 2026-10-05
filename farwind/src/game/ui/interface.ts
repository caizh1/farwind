import {roadTracked,roadQuestText} from '../systems/merchantRoadState';
import {guardMemorialJournal} from './guardAftermath';
import { showWorldAtlas } from './worldAtlas';
import { Minimap } from './minimap';
import {showWindMemory} from './windMemory';
import type {WildernessDirection} from '../../data/maps/windbell/encounters';
import {showWindGifts} from './windGifts';
import type {WindGiftId} from '../systems/windGifts';
import {showCatCompanion} from './catCompanion';
import {CAT_STAGES,catStage,type CatCare} from '../systems/catBond';
import {legacyJournal,legacyTracked} from '../systems/windLegacy';
import type {LegacyTrack} from '../systems/windLegacyState';
import {showRunes,updateRuneHud} from './runes';
import {CAMP_BOSSES,type CampBossKind} from '../../data/maps/windbell/campBosses';
import {RUNES,type RuneDefinition} from '../../data/runes';
import type {RuneRequest} from '../systems/runeState';
import type {RuneTier,Ability} from '../../data/runes';
import {updateCampBossHud} from './campBossHud';
import {southQuestObjective} from "../systems/fieldQuest";
import {DEMON_KING,demonFormation,retaliationSummary} from '../../data/demonKing';
import {demonMalice,demonKingSummary} from '../systems/demonKingState';
import {WIND_NAMES,WIND_EFFECTS,WIND_LESSONS} from '../../data/windLessons';
import {windLearningSource,windLessonStatus} from '../systems/skills';
import { showShop } from "./shop";
import { showEquipment, type EquipmentViewSlot } from "./equipment";
import { showBag, bagTrade } from "./bag";
import { clockLabel } from "../systems/worldClock";
import { type ShopId, type EquipmentSlot } from "../../data/economy";
import type { EconomyRequest } from "../systems/economy";
import { TRAINING, type TrainingDummy } from "../systems/training";
import { items, itemIcon, objectives, type ItemId } from "../../data/content";
import { count, parseSave, MAX_SAVE_BYTES, type State } from "../systems/state";
import { region } from "../../data/world";
import {CITY_MAIN_HINTS,CITY_QUESTS,CITY_CITIZENS,cityBuilding,isCitySpace} from '../../data/cityLayout';
import type { PracticeMode } from "../systems/parryTraining";
import { dialoguePortraitFor } from "../../data/dialoguePortraits";
import { journeyProgress, playerVitals } from '../systems/journeyTraining';
function journeyJournal(state: State) {
  const progress=journeyProgress(state);
  const next=(distance:number|null)=>distance===null?'锻炼已满':`距下次上限 +1 还需 ${Math.ceil(distance).toLocaleString('zh-CN')} 米`;
  const city=state.city.progress;
  const notes=state.city.visited?`<section aria-label="风语城行记"><h2>风语城 · 风塔异响</h2><p>${CITY_MAIN_HINTS[city.main]}。城防：${city.alarm==='battle'?'警报，居民避难':city.alarm==='recover'?'恢复日程':'正常轮值'}。</p>${CITY_QUESTS.map(d=>{const q=city.quests.find(q=>q.id===d.id)!;return `<p><b>${d.name}</b> · ${q.status==='unaccepted'?'到商旅行会登记':q.status==='complete'?'已完成':q.status==='pending'?'到行会领取奖励':q.steps.length+'/'+d.steps.length}<br>${d.steps.map(step=>(q.steps.includes(step)?'✓ ':'· ')+step).join('；')}</p>`;}).join('')}<details><summary>具名市民与当前场所</summary>${CITY_CITIZENS.map(c=>{const r=city.residents.find(r=>r.id===c.id)!;return `<p>${c.name} · ${r.space==='village'?'城内街道':cityBuilding(r.space)?.name??'街道'} · ${r.activity==='sleep'?'休息':r.activity==='work'?'工作':r.activity==='shelter'?'避难':'外出'}</p>`;}).join('')}</details></section>`:'';
  return `${notes}<section id="journey-training" aria-label="旅途锻炼"><h2>旅途锻炼</h2><p>累计有效奔跑里程：${Math.floor(progress.meters).toLocaleString('zh-CN')} 米</p><p>体力上限 ${progress.maxStamina} / 200 · 永久 +${progress.maxStamina-100}；${next(progress.staminaRemaining)}</p><p>生命上限 ${progress.maxHp} / 200 · 永久 +${progress.maxHp-100}；${next(progress.healthRemaining)}</p><p>正常奔跑自动积累，每次上限 +1，后续所需里程逐次增加。永久生效，不占装备或符文槽。${progress.healthRemaining===null?'两项锻炼已满。':''}</p></section>`;
}
export type DialogueOptions = {
  context: string;
  choices: {id: string; label: string; detail?: string; select: () => void}[];
  note?: string;
  closeLabel?: string;
};
export type Actions = {
  memoryStart?:(direction:WildernessDirection)=>Promise<void>;
  memoryEnd?:()=>Promise<void>;
  giftSaved?:(receipt:string)=>boolean;
  giftChoose?:(receipt:string,id:WindGiftId)=>Promise<void>;
  catCare?:(kind:CatCare)=>Promise<void>;
  catCareReason?:()=>string;
  catStatus?:()=>string;
  enterShop?:(id:ShopId)=>void;
  runeChange:(request:RuneRequest)=>Promise<void>;
  runeLock:()=>string;
  runeA:()=>number;
  xiaobao?:()=>void;
  presentation?:(numbers:boolean,shake:boolean)=>void;
  canMutate: ()=>boolean;
  trade: (request: EconomyRequest) => Promise<void>;
  start: (continued: boolean) => void;
  save: () => Promise<void>;
  import: (s: State) => Promise<void>;
  use: (id: ItemId) => void | Promise<void>;
  pause: () => void;
  volume: (v: number) => void;
  getVolume: () => number;
  title: () => void;
  practice: (mode: PracticeMode) => void;
  trainBuild?:()=>void;
  indicators: (value:boolean)=>void;
  getIndicators: ()=>boolean;
};
export class Interface {
  minimap = new Minimap();
  mapArea:'all'|'plains'|'road'|'city'='all';
  runeFeedback='';
  victory: {boss:CampBossKind;rewards:string[]}|null=null;
  selectedRune='return-wind';selectedRuneSlot=0;runeTier:RuneTier|''='';runeAbility:Ability|''='';runeOwned='all';previewCleanup?:()=>void;runeHudKey='';
  root = document.querySelector<HTMLDivElement>("#ui")!;
  mode = "title";
  economyBusy = false;
  available = false;
  selected: ItemId | null = null;
  selectedEquipment: EquipmentViewSlot = "orb";
  bagFilter = "all";
  bagSelectedSlot = -1;
  potionQuantity = 1;
  hudPreferences = this.readPreferences();
  returnTo: "" | "pause" | "title" = "";
  returnFocus: HTMLElement | null = null;
  pauseFocus = "";
  lastQuest?: number;
  usedSlotTimer?: ReturnType<typeof setTimeout>;
  state?: State;
  combatStatus = "L 风步 · 就绪";
  dialogClosed?:()=>void;
  actions!: Actions;
  modal!: HTMLElement;
  hud!: HTMLElement;
  toastEl!: HTMLElement;
  constructor() {
    this.root.addEventListener("click",e=>{if(this.actions&&!this.actions.canMutate()){e.preventDefault();e.stopImmediatePropagation();}},true);
    this.root.innerHTML = `<div id="hud" hidden>
      <div class="top"><div class="vitals-stack"><section class="vitals"><div class="hero-vitals"><img class="portrait" src="/assets/portrait.png" alt="旅行者"><div><b>旅人 <small>与小黑同行</small></b><div class="meter health" role="progressbar" aria-label="生命" aria-valuemin="0" aria-valuemax="100"><i></i><span></span></div><div class="meter stamina" role="progressbar" aria-label="体力" aria-valuemin="0" aria-valuemax="100"><i></i><span></span></div></div></div><div class="hud-meta"><span class="hud-coins"><img src="/assets/commission/coin.webp" alt=""><span id="coin-status" aria-label="金币余额">120</span></span><button id="cat-summary" class="cat-summary" data-panel="cat" aria-label="小黑 · 默契与同行能力"><img src="/assets/cat.png" alt=""><span>小黑 · 熟悉</span></button><button id="xiaobao-summary" class="xiaobao-summary" data-xiaobao="true" aria-label="小宝 · 听风小宗师"><img src="/assets/xiaobao/portrait.webp" alt=""><span>小宝 640/640</span></button><button id="demon-king-summary" class="text-button" data-panel="quest" hidden></button><button id="hud-details-toggle" class="text-button" data-hud-fold="hud-status-details" aria-expanded="false" aria-controls="hud-status-details">详情</button></div></section>
      <div class="combat-status-row"><span id="combat-status">L 风步 · 就绪</span><span id="parry-status" role="status">K 架剑就绪</span><small id="wind-aim-status" hidden></small></div>
      <section id="training-panel" hidden><div class="training-actions"><button id="training-details-toggle" data-hud-fold="training-details" aria-expanded="false" aria-controls="training-details"><img src="/assets/icon-sword.png" alt="">木桩练习</button><button data-practice-menu="true" aria-label="迎风架剑练习">迎风架剑</button><button data-build-training="true" aria-label="本领与构筑训练">构筑训练</button></div><span id="training-stats" hidden></span><div id="training-details" class="training-details" hidden><small>J / 左键：攻击；连按接三／四连；I／中键：剑风；L：风步</small><span id="training-stats-detail"></span><span id="parry-feedback" hidden></span></div></section>
      <section id="hud-status-details" class="hud-status-details" hidden><b>操作与本领</b><small id="sword-wind-status" hidden></small><span id="combat-status-detail">L 风步 · 就绪</span><span id="parry-status-detail">K 架剑就绪</span><span id="wind-aim-detail" hidden></span><span id="demon-king-detail" hidden></span><small>J / 左键：连斩；K / 右键：架剑；L：风步；I / 中键：剑风。</small></section></div>
      <div class="hud-info"><section class="location"><button id="minimap-toggle" class="hud-summary" aria-expanded="false" aria-controls="minimap-details" aria-label="展开小地图"><b id="region">风铃村</b><span>·</span><span id="clock"></span><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Zm6-2v16m6-14v16"/></svg><span class="chevron" aria-hidden="true">▾</span></button><div id="minimap-details" class="hud-details map-details" hidden><div class="minimap-heading"><img class="minimap-rule" src="/assets/minimap/painted/rule.webp" alt=""><span id="minimap-note">周边地形</span><img class="minimap-rule" src="/assets/minimap/painted/rule.webp" alt=""><span class="minimap-north" aria-label="上方为北">N<img src="/assets/minimap/painted/player.webp" alt=""></span></div><canvas id="minimap" width="320" height="160" aria-label="周边地形小地图"></canvas><small id="day" hidden></small><div class="minimap-footer"><span class="minimap-legend"><span><img src="/assets/minimap/painted/player.webp" alt="">主角</span><span title="青色服务地标，红色挑战，绿色已完成"><img src="/assets/minimap/painted/landmark.webp" alt="">地标</span></span><button class="text-button" data-panel="map" aria-label="M 完整地图">完整地图 <kbd>M</kbd></button></div></div></section>
      <section class="quest-tracker"><button id="quest-toggle" class="hud-summary" aria-expanded="false" aria-controls="quest-details"><span id="objective-summary" class="ellipsis"></span><span class="chevron" aria-hidden="true">▾</span></button><div id="quest-details" class="hud-details quest-details" hidden><small>主线 · 失落的风</small><p id="objective"></p><button class="text-button" data-panel="quest">Q 旅途手记</button></div></section></div></div>
      <div id="prompt"></div><div id="menu-hint" role="status" hidden>Esc 打开菜单 / 查看操作</div><div class="bottom"><span id="hotbar-info" role="tooltip" hidden></span><div id="hotbar" role="group" aria-label="快捷道具栏，1 至 8"></div></div></div><div id="toast" role="status"></div><div id="modal"></div>`;
    this.modal = this.root.querySelector("#modal")!;
    this.hud = this.root.querySelector("#hud")!;
    this.toastEl = this.root.querySelector("#toast")!;
    this.root.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button, summary");
      if (b?.dataset.panel) this.open(b.dataset.panel);
      if(b?.dataset.buildTraining)this.actions.trainBuild?.();
      if (b?.dataset.practiceMenu) this.open("practice");
      if (b?.dataset.use) this.useSlot(Number(b.dataset.hotbarSlot));
      if(b?.dataset.xiaobao)this.actions.xiaobao?.();
      if (b?.dataset.hudFold) {
        const details = this.root.querySelector<HTMLElement>(`#${b.dataset.hudFold}`)!;
        details.hidden = !details.hidden;
        b.setAttribute("aria-expanded", String(!details.hidden));
      }
      // 鼠标操作完成后交还游戏焦点；键盘激活仍保留按钮焦点供导航。
      if (e.detail > 0 && b && this.hud.contains(b)) {
        if(b.dataset.panel)this.returnFocus=null;
        this.focusGame();
      }
    });
    for (const name of ["minimap", "quest"] as const) {
      this.root
        .querySelector(`#${name}-toggle`)!
        .addEventListener("click", () => {
          this.hudPreferences[name] = !this.hudPreferences[name];
          this.syncFolds();
          this.savePreferences();
        });
    }
    this.syncFolds();
    const boss=document.createElement('section');boss.id='camp-boss-status';boss.className='camp-boss-status';boss.hidden=true;boss.setAttribute('aria-label','据点首领战');boss.innerHTML='<div class="boss-title"><b></b><span data-boss-health></span></div><progress max="1" value="1"></progress><span data-boss-state role="status"></span>';this.root.querySelector('.hud-info')!.before(boss);
    this.root.addEventListener("pointerdown", (e) => {
      if ((e.target as Element).closest("button, summary, .rune-hud-panel, .hud-details, #modal"))
        e.stopPropagation();
    });
    this.root.addEventListener("focusin", (e) => {
      if ((e.target as Element).closest("#hud button, #hud summary, #hud input, #hud select"))
        this.actions?.pause();
    this.giftJournalBind();
    });
    const hotbar = this.root.querySelector<HTMLElement>("#hotbar")!;
    for (const type of ["pointerover", "focusin"])
      hotbar.addEventListener(type, (e) => {
        const b = (e.target as Element).closest<HTMLButtonElement>(
          "[data-hotbar-slot]",
        );
        if (!b) return;
        const info = this.root.querySelector<HTMLElement>("#hotbar-info")!;
        info.textContent = b.title;
        info.hidden = false;
      });
    for (const type of ["pointerleave", "focusout"])
      hotbar.addEventListener(type, () => {
        this.root.querySelector<HTMLElement>("#hotbar-info")!.hidden = true;
      });
  }
  readPreferences() {
    const defaults = {
      version: 1,
      nightVisibility: 0.5,
      cycleTarget: 'v',
      combatNumbers: true,
      combatShake: true,
      minimap: false,
      quest: false,
      menuHintSeen: false,
    };
    try {
      const p = JSON.parse(localStorage.getItem("farwind-hud-v1") ?? "null");
      if(['v','b','c'].includes(p?.cycleTarget))defaults.cycleTarget=p.cycleTarget;
      if(Number.isFinite(p?.nightVisibility)&&p.nightVisibility>=0&&p.nightVisibility<=1)defaults.nightVisibility=p.nightVisibility;
      if (p?.version === 1)
        for (const key of ["minimap", "quest", "menuHintSeen","combatNumbers","combatShake"] as const)
          if (typeof p[key] === "boolean") defaults[key] = p[key];
    } catch {
      /* 本地配置不可用时仍可操作，本轮选择保留在内存。 */
    }
    return defaults;
  }
  savePreferences() {
    try {
      localStorage.setItem(
        "farwind-hud-v1",
        JSON.stringify(this.hudPreferences),
      );
    } catch {
      /* 存储受限时不影响玩法。 */
    }
  }
  syncFolds() {
    for (const name of ["minimap", "quest"] as const) {
      const button = this.root.querySelector<HTMLButtonElement>(
        `#${name}-toggle`,
      )!;
      const details = this.root.querySelector<HTMLElement>(`#${name}-details`)!;
      const expanded = this.hudPreferences[name];
      if (!expanded && details.contains(document.activeElement))
        button.focus({ preventScroll: true });
      details.hidden = !expanded;
      button.setAttribute("aria-expanded", String(expanded));
      button.querySelector(".chevron")!.textContent = expanded ? "▴" : "▾";
      if (name === "minimap")
        button.setAttribute(
          "aria-label",
          expanded ? "收起小地图" : "展开小地图",
        );
    }
    if (this.hudPreferences.minimap && this.state)
      this.minimap.draw(this.root.querySelector("#minimap")!, this.state);
  }
  intro() {
    if (this.hudPreferences.menuHintSeen) return;
    const hint = this.root.querySelector<HTMLElement>("#menu-hint")!;
    hint.hidden = false;
    setTimeout(() => {
      hint.hidden = true;
    }, 4000);
    this.hudPreferences.menuHintSeen = true;
    this.savePreferences();
  }
  useSlot(index: number) {
    const item = this.state?.hotbar[index];
    if (!item) return;
    this.actions.use(item);
    this.root
      .querySelectorAll("[data-hotbar-slot]")
      .forEach((b) => b.classList.remove("just-used"));
    this.root
      .querySelector(`[data-hotbar-slot="${index}"]`)
      ?.classList.add("just-used");
    clearTimeout(this.usedSlotTimer);
    this.usedSlotTimer = setTimeout(
      () =>
        this.root
          .querySelectorAll(".just-used")
          .forEach((b) => b.classList.remove("just-used")),
      450,
    );
    if (this.state)
      this.update(
        this.state,
        this.root.querySelector("#prompt")!.textContent ?? "",
      );
  }
  get controlFocused() {
    return (
      this.hud.contains(document.activeElement) &&
      !!(document.activeElement as Element)?.closest("button, summary, input, select")
    );
  }
  focusGame() {
    if (this.hud.contains(document.activeElement))
      (document.activeElement as HTMLElement).blur();
  }
  handleKey(e: KeyboardEvent) {
    if(this.actions&&!this.actions.canMutate())return;
    const k = e.key.toLowerCase();
    if (this.paused) {
      if (k === "escape") {
        e.preventDefault();
        if (!e.repeat && this.mode !== "title") this.close();
      } else if (this.mode === "dialog" && k === "e") {
        e.preventDefault();
        if (!e.repeat) this.close();
      } else if (
        (this.mode === "map" && k === "m") ||
        (this.mode === "quest" && k === "q")
      ) {
        if (!e.repeat) this.close();
      } else if (k === "tab") {
        const controls = [
          ...this.modal.querySelectorAll<HTMLElement>(
            "button:not(:disabled), input, select, [tabindex='0']",
          ),
        ].filter((b) => !b.hidden);
        const index = controls.indexOf(document.activeElement as HTMLElement);
        if (
          controls.length &&
          (index < 0 ||
            (e.shiftKey ? index === 0 : index === controls.length - 1))
        ) {
          e.preventDefault();
          controls[e.shiftKey ? controls.length - 1 : 0].focus();
        }
      }
      return true;
    }
    if (
      this.controlFocused &&
      [
        "tab",
        "enter",
        " ",
        "arrowup",
        "arrowdown",
        "arrowleft",
        "arrowright",
      ].includes(k)
    )
      return true;
    return false;
  }
  parryStatus(text:string) {
    const status = this.root.querySelector<HTMLElement>("#parry-status")!;
    status.textContent = text.split('；')[0];
    status.title = text;
    this.root.querySelector("#parry-status-detail")!.textContent = text;
  }
  windAimStatus(text: string, compact: string, visible: boolean) {
    const status = this.root.querySelector<HTMLElement>("#wind-aim-status")!;
    status.hidden = !visible;
    status.textContent = compact;
    status.title = text;
    const detail = this.root.querySelector<HTMLElement>("#wind-aim-detail")!;
    detail.hidden = !visible;
    detail.textContent = text;
  }
  xiaobaoStatus(text: string) {
    const status = this.root.querySelector<HTMLButtonElement>("#xiaobao-summary")!;
    const parts = text.split(' · ');
    status.querySelector('span')!.textContent = `小宝 ${parts[2] ?? ''}${parts.length > 3 ? ` · ${parts.slice(3).join(' · ')}` : ''}`;
    status.title = text;
    status.setAttribute('aria-label', text);
  }
  practiceFeedback(feedback: string, mode: PracticeMode) {
    const text = this.root.querySelector<HTMLElement>("#parry-feedback");
    if (text) {
      if (mode !== "off" && text.hidden) {
        this.root.querySelector<HTMLElement>("#training-details")!.hidden = false;
        this.root.querySelector("#training-details-toggle")!.setAttribute("aria-expanded", "true");
      }
      text.hidden = mode === "off";
      text.textContent = feedback;
    }
  }
  training(s: ReturnType<TrainingDummy["snapshot"]>, near: boolean) {
    const panel = this.root.querySelector<HTMLElement>("#training-panel")!;
    panel.hidden = this.state?.life.playerSpace !== "village" || (!near && !s.visible);
    const stats = this.root.querySelector<HTMLElement>("#training-stats")!;
    const targetNames: Record<string, string> = {'training-dummy': '训练稻草人', 'field-dummy-west': '西侧木桩', 'field-dummy-east': '东侧木桩', 'field-dummy-south': '南侧木桩'};
    const detail = s.visible
      ? `${s.lastStage?`第${s.lastStage}段 · ${Math.round(s.lastDamage*10)/10}伤害；本组命中${s.stages.length}/${this.state?.skills.meleeFinisher?4:3}；累计${Math.round(s.damage*10)/10}${[1,2,3,4].every(n=>s.stages.includes(n))?" · 四连完成":s.complete&&!this.state?.skills.meleeFinisher ? " · 三连完成" : ""}`:''}${s.swordWind?` · 剑风 ${Math.round(s.swordWind.damage*10)/10}伤害 · 首靶 ${targetNames[s.swordWind.firstTarget] ?? '练习木桩'}`:''}`
      : "";
    stats.hidden = !s.visible;
    stats.textContent = s.visible ? [s.lastStage ? `第${s.lastStage}段 ${Math.round(s.lastDamage*10)/10}伤害 · 累计${Math.round(s.damage*10)/10}` : '', s.swordWind ? `剑风 ${Math.round(s.swordWind.damage*10)/10}伤害` : ''].filter(Boolean).join(' · ') : '';
    stats.title = detail;
    this.root.querySelector('#training-stats-detail')!.textContent = detail;
    stats.style.opacity = String(
      Math.max(0, Math.min(1, (TRAINING.linger - s.age) / TRAINING.fade)),
    );
  }
  get paused() {
    return this.mode !== "";
  }
  swordWind(source:string,name="剑风",trial=false){const badge=this.root.querySelector<HTMLElement>('#sword-wind-status')!;badge.hidden=source==='未学习'&&!trial;badge.textContent=`${name}：${trial?'教学试用':source}`;}
  message(s: string) {
    const feedback=this.mode==='dialog'?this.modal.querySelector<HTMLElement>('.dialog-feedback'):null;
    if(feedback){feedback.textContent=s;feedback.hidden=false;return;}
    const host = this.hud.hidden ? this.root : this.root.querySelector<HTMLElement>(".hud-info")!;
    if (this.toastEl.parentElement !== host) host.append(this.toastEl);
    this.toastEl.textContent = s;
    this.toastEl.classList.add("show");
    setTimeout(() => {
      if (this.toastEl.textContent === s) this.toastEl.classList.remove("show");
    }, 3500);
  }
  saveFailed(error: unknown) {
    let warning=this.root.querySelector<HTMLElement>('#save-warning');
    if(!warning){
      warning=document.createElement('aside');warning.id='save-warning';warning.className='save-warning';
      warning.setAttribute('role','alert');
      warning.innerHTML='<strong>本次进度未保存</strong><p></p><small>上一份有效存档仍保留；刷新或退出可能丢失本次进度。</small><div><button type="button" id="save-retry">重试保存</button><button type="button" id="save-backup">导出当前进度</button></div>';
      this.root.append(warning);
      warning.querySelector<HTMLButtonElement>('#save-retry')!.onclick=()=>void this.actions.save().catch(()=>{});
      warning.querySelector<HTMLButtonElement>('#save-backup')!.onclick=()=>this.export();
    }
    warning.querySelector('p')!.textContent=error instanceof Error?error.message:String(error);
    warning.hidden=false;
    const status=this.modal.querySelector<HTMLElement>('#boss-save-status');
    if(status)status.textContent='本次击杀与奖励尚未保存。请重试保存，或先导出当前进度。';
  }
  saved(snapshot: State) {
    const warning=this.root.querySelector<HTMLElement>('#save-warning');if(warning)warning.hidden=true;
    const receipt=this.victory,status=this.modal.querySelector<HTMLElement>('#boss-save-status');
    if(receipt&&status&&snapshot.encounters.groups[CAMP_BOSSES[receipt.boss].camp]?.boss?.stage==='defeated'&&receipt.rewards.every(id=>snapshot.runes.owned.includes(id)))status.textContent='击杀与符文收藏已保存。';
  }
  bossVictory(boss: CampBossKind, earned: RuneDefinition[]) {
    const definition=CAMP_BOSSES[boss];
    const rewards=earned.length?earned:RUNES.filter(r=>r.acquisition.kind==='boss'&&r.acquisition.key===definition.camp&&this.state?.runes.owned.includes(r.id));
    this.victory={boss,rewards:rewards.map(r=>r.id)};
    this.mode='victory';this.returnTo='';
    this.shell('首领已击败',`<div class="boss-victory"><h2>${definition.name}</h2><p>据点已清理，当地巡游与当地来源来袭停止。</p><div class="victory-rewards">${rewards.map(r=>`<article><small>传说符文 · ${earned.some(e=>e.id===r.id)?'新获得':'已收藏'}</small><h3>${r.name}</h3><p>${r.description}</p><strong>${this.state?.runes.slots.includes(r.id)?'已装备':'已收藏 · 未装备'}</strong></article>`).join('')}</div><p class="muted">收藏不会自动装备。继续旅途，脱战八秒后按 R，在自由槽中装备；交战、守村、试炼或剧情锁定期间不能更换。</p><p id="boss-save-status" role="status">正在保存击杀与奖励……</p><div class="victory-actions"><button type="button" id="victory-runes">查看符文与装备条件</button><button type="button" id="victory-continue">确认 · 继续旅途</button></div></div>`);
    this.modal.querySelector('.panel')!.classList.add('victory-panel');
    this.button('victory-continue',()=>this.close(true));
    this.button('victory-runes',()=>{this.selectedRune=rewards.find(r=>r.acquisition.kind==='boss')?.id??rewards[0]?.id??'return-wind';this.runeOwned='owned';this.runeTier='';this.runeAbility='';this.close(true);this.open('runes');});
    this.modal.querySelector<HTMLButtonElement>('#victory-continue')!.focus({preventScroll:true});
  }
  shell(title: string, body: string) {
    this.previewCleanup?.();this.previewCleanup=undefined;
    this.root.classList.remove("dialog-open");
    this.hud.inert = true;
    this.modal.classList.remove("story-modal", "equipment-modal", "bag-modal", "rune-modal");
    this.modal.hidden = false;
    this.modal.innerHTML = `<section class="panel${this.mode === "pause" ? " pause-panel" : ""}" role="dialog" aria-modal="true" aria-labelledby="panel-title"><header><small>远 风 之 地</small><h1 id="panel-title">${title}</h1></header>${body}</section>`;
    this.actions?.pause();
    this.giftJournalBind();
  }
  giftJournalBind(){this.button('journal-wind-gifts',()=>this.open('wind-gifts'));this.button('journal-wind-memory',()=>this.open('wind-memory'));}
  button(id: string, fn: () => void) {
    this.modal.querySelector("#" + id)?.addEventListener("click", fn);
  }
  title(error = "") {
    this.mode = "title";
    this.returnTo = "";
    this.hud.hidden = true;
    this.shell(
      "远风之地",
      `<p class="subtitle">沿着风，遇见属于你的故事。</p><p class="eyebrow">第一章 · 风铃村的来信</p><div class="menu"><button id="new">启程 · 新游戏</button><button id="continue" ${!this.available ? "disabled" : ""}>继续旅途</button><button id="settings">设置</button></div><p class="muted">${error || "本地存档可能随站点数据清理而丢失，请定期导出备份。"}</p><button id="import">导入存档</button>`,
    );
    this.button("new", () => {
      if (this.available) {
        this.shell(
          "开始新的旅途？",
          '<p>新游戏会覆盖当前本地存档。请先导出备份。</p><button id="export">导出当前存档</button><button id="yes">确认新游戏</button><button id="no">取消</button>',
        );
        this.button("export", () => this.export());
        this.button("yes", () => this.actions.start(false));
        this.button("no", () => this.title());
      } else this.actions.start(false);
    });
    this.button("continue", () => this.actions.start(true));
    this.button("settings", () => this.open("settings"));
    this.button("import", () => this.import());
    this.focusPanel();
  }
  focusPanel(id = "") {
    this.modal
      .querySelector<HTMLElement>(
        id ? `#${id}` : "button:not(:disabled), input, select",
      )
      ?.focus({ preventScroll: true });
  }
  close(toGame = false) {
    if (this.economyBusy) return;
    if(this.mode==='victory'&&!toGame)return;
    if(toGame)this.victory=null;
    this.previewCleanup?.();this.previewCleanup=undefined;
    const dialogClosed=this.mode==='dialog'?this.dialogClosed:undefined;
    this.dialogClosed=undefined;
    if (!toGame && this.returnTo === "pause" && this.mode !== "pause") {
      this.open("pause");
      this.focusPanel(this.pauseFocus);
      return;
    }
    if (!toGame && (this.returnTo === "title" || this.mode === "title")) {
      this.title();
      return;
    }
    this.returnTo = "";
    this.mode = "";
    this.modal.hidden = true;
    this.modal.classList.remove("story-modal", "equipment-modal", "bag-modal");
    this.root.classList.remove("dialog-open");
    this.hud.inert = false;
    if (this.modal.contains(document.activeElement))
      (document.activeElement as HTMLElement).blur();
    this.hud.hidden = false;
    this.actions.pause();
    if (this.state) this.update(this.state, "");
    if (this.returnFocus?.isConnected && !this.returnFocus.closest("[hidden]"))
      this.returnFocus.focus({ preventScroll: true });
    this.returnFocus = null;
    dialogClosed?.();
  }
  shop(id: ShopId) {
    showShop(this, id);
  }
  async changeEquipment(slot: EquipmentSlot, item: ItemId | null, page = "bag") {
    if (this.economyBusy || !this.state) return;
    this.economyBusy = true;
    this.modal.querySelectorAll<HTMLButtonElement | HTMLSelectElement>("button,select").forEach(button => { button.disabled = true; });
    try {
      await this.actions.trade({ sequence: this.state.economyRevision + 1, kind: "equip", slot, item });
      this.message("装备已更新并保存");
    } catch (error) {
      this.message(`装备未更改：${(error as Error).message}`);
    } finally {
      this.economyBusy = false;
    }
    this.open(page);
    if (page === "equipment") this.modal.querySelector<HTMLButtonElement>(`[data-equipment-slot="${this.selectedEquipment}"]`)?.focus({ preventScroll: true });
  }
  async makePotion() {
    if (!this.state) return;
    await bagTrade(this, { sequence: this.state.economyRevision + 1, kind: "craft", quantity: this.potionQuantity }, `制作成功：恢复药剂 ×${this.potionQuantity}，已保存。`, "craft");
  }
  open(mode: string, bagFeedback = "") {
    if (this.economyBusy) return;
    if(mode==='wind-gifts'){showWindGifts(this,bagFeedback);return;}
    if(mode==='wind-memory'){showWindMemory(this,bagFeedback);return;}
    if(this.mode==='victory')return;
    if (!this.state && mode !== "settings") return;
    if (this.mode !== mode) {
      if(mode==='runes')this.runeFeedback='';
      if (mode === "equipment") this.selectedEquipment = "orb";
      if (this.mode === "pause" && mode !== "pause") {
        this.returnTo = "pause";
        this.pauseFocus = (document.activeElement as HTMLElement)?.id ?? "";
      } else if (this.mode === "title") this.returnTo = "title";
      else if (this.mode === "") {
        this.returnTo = "";
        this.returnFocus = this.controlFocused
          ? (document.activeElement as HTMLElement)
          : null;
      }
      if (mode === "pause") this.returnTo = "";
    }
    this.mode = mode;
    const s = this.state;
    if (mode === "equipment" && s) showEquipment(this);
    if(mode==='runes'&&s)showRunes(this);
    if(mode==='cat'&&s)showCatCompanion(this,bagFeedback);
    if (mode === "practice") {
      this.shell(
        "迎风架剑练习",
        `<p>K／画布右键架剑；成功自动反斩；远程弹反自动发出剑气。J／左键接第二刀，再按接第三刀。收拢外圈进入宽容区可普通弹反，中心菱形与双线表示精准时机。投影与正式怪物共用攻击动作，锁向后不追踪绕背。练习不扣生命、不掉落、不推进任务。</p><label class="practice-toggle"><input id="parry-indicators" type="checkbox" ${this.actions.getIndicators()?"checked":""}>显示来招指示器（关闭后只看怪物动作）</label><div class="practice-options"><button data-practice="slow">慢速教学 · 900毫秒</button><button data-practice="slime">史莱姆节奏 · 450毫秒</button><button data-practice="leaf">裂枝镰灵 · 650毫秒</button><button data-practice="spore">灰冠孢卫 · 孢子喷射</button><button data-practice="boar">棘甲林豕 · 直线冲锋</button><button data-practice="raven">暮羽鸦妖 · 跃扑</button><button data-practice="chain">轻击收手 → 弹反 → 自动反斩 → 连击</button><button data-practice="off">结束弹反练习</button></div><button id="close">返回木桩练习</button>`,
      );
      this.modal.querySelector<HTMLInputElement>("#parry-indicators")!.onchange=e=>this.actions.indicators((e.target as HTMLInputElement).checked);
      this.modal.querySelectorAll<HTMLButtonElement>("[data-practice]").forEach(
        (b) =>
          (b.onclick = () => {
            this.actions.practice(b.dataset.practice as PracticeMode);
            this.close();
          }),
      );
    }
    if (mode === "bag" && s) showBag(this, bagFeedback);
    if (mode === "quest" && s)
      this.shell(
        "旅途手记",
        `<p><button id="journal-wind-gifts">风赐：已持有 ${s.windGifts.held.length} 种 · 待选 ${s.windGifts.pending.length} 场</button></p><button id="journal-wind-memory">四方向进度与风忆远征</button>${journeyJournal(s)}${guardMemorialJournal(s)}<h2>远处的黑焰 · ${DEMON_KING.name}</h2><p>${demonKingSummary(s)}</p><p>${demonMalice(s.encounters)?'每完整清剿一处据点，恶意增加 1；同一据点只计一次。当地巡游与当地来袭来源停止；魔王会为每处陷落据点，从地图边缘派出一波 10 只精英裂枝镰灵向村庄总攻。第一波一阶，第二波二阶，此后每波升一阶；每只生命依次为94、115、137、158，伤害依次为22、26、30、34。已有战斗时依次接续，读档不会重复刷出。':'魔物最初为了果腹而捕猎，远处的存在尚未将人类视为敌人。清剿保护村庄，也会改变它对人类的判断。'}</p><p>恶意 1～9：原编队增加 5 只，单次 6～8 只；每逢 10 点升档，逐步加入更高阶精英，编队最多 10 只。常规骚扰首夜安静，恶意 0～4 的单夜来袭概率依次为 50%、60%、70%、80%、90%；单夜至多一次，仍受冷却与防线状态限制。报复总攻不受首夜、时段或常规冷却限制；已出发的编队保持原恶意档位。</p>${demonMalice(s.encounters)?`<p>当前新派遣：${demonFormation(demonMalice(s.encounters),1).count}～${demonFormation(demonMalice(s.encounters),3).count}只。${s.defense.raid?.order?.source==='demon-king'?`${s.defense.raid.order.retaliationCamp?`在途报复：${retaliationSummary(s.defense.raid.order)}`:`在途派遣按恶意 ${s.defense.raid.order.malice} 编队，共 ${s.defense.raid.members.length} 只`}；不会因清剿而临时升阶。`:''}</p>`:''}<h2>重开商路</h2><p>${roadQuestText(s)}</p><p>西门外与守城将军岚铎交谈；裂牙巢穴在桥前密林北侧短支路。清剿只需三场守巢战斗，与六处普通遭遇独立。开通后主路有守军，支路保留冒险。${s.merchantRoad.parcel?'商旅包裹待交付，独立保管，不占行囊。':''}${s.merchantRoad.escort?'当前支路护送：'+roadTracked(s)?.name+'。':''}</p><h2>南路补给</h2><p>${southQuestObjective(s)}</p><p>从南门沿路过芦苇桥，药草洼地在西南岸，孢根巢地在洼地东南方。药师与公共委托簿均可办理。</p><h2>主线 · 失落的风</h2><p>${objectives[s.quest]}</p><ol class="journal">${objectives
          .slice(0, 7)
          .map(
            (q, i) =>
              `<li class="${i < s.quest ? "done" : ""}">${i < s.quest ? "✓ " : ""}${q}</li>`,
          )
          .join(
            "",
          )}</ol><h2>支线 · 木匠的托付</h2><p>${["与西南方的木匠阿禾交谈", "为阿禾收集 4 份木材", "已交付，收到浆果与谢意"][s.side]}</p>${legacyJournal(s)}${this.skillJournal(s)}<button id="close">合上手记</button>`,
      );
    if(mode==='quest'&&s)this.modal.querySelectorAll<HTMLButtonElement>('[data-legacy-track]').forEach(b=>b.onclick=async()=>{if(this.economyBusy)return;this.economyBusy=true;b.disabled=true;try{await this.actions.runeChange({kind:'track',target:(b.dataset.legacyTrack||null) as LegacyTrack});this.message('目标已追踪，M 查看实际地点。');this.open('quest');}catch(e){this.message((e as Error).message);b.disabled=false;}finally{this.economyBusy=false;}});
    if (mode === "map" && s) this.showMap();
    if (mode === "pause") {
      this.shell(
        "在风中歇一会儿",
        `<p class="pause-note">世界与时间已暂停。</p><button id="close" class="resume" aria-label="继续旅途" aria-keyshortcuts="Escape">继续旅途 <kbd>Esc</kbd></button><div class="pause-grid"><button id="pause-cat" data-panel="cat">小黑 · 默契与能力</button><button id="pause-bag" data-panel="bag">行囊 <kbd>Tab</kbd></button><button id="pause-map" data-panel="map">完整地图 <kbd>M</kbd></button><button id="pause-quest" data-panel="quest">旅途手记 <kbd>Q</kbd></button><button id="pause-runes" data-panel="runes">符文与共鸣 <kbd>R</kbd></button><button id="pause-help" data-panel="help">操作说明 <span>查看操作</span></button></div><h2>存档与设置</h2><div class="pause-grid"><button id="save">保存旅途</button><button id="export">导出备份</button><button id="import">导入存档</button><button id="settings">设置</button><button id="title" class="wide">保存并返回标题</button></div><p class="backup-note">备份需下载到站点之外；清理站点数据会删除本地存档。</p>`,
      );
      this.button("save", () => void this.actions.save().catch(() => {}));
      this.button("export", () => this.export());
      this.button("import", () => this.import());
      this.button("settings", () => this.open("settings"));
      this.button("title", () => this.actions.title());
    }
    if (mode === "help")
      this.shell(
        "操作说明",
        `<dl class="controls-guide"><dt>移动</dt><dd>WASD / 方向键</dd><dt>奔跑</dt><dd>按住空格并移动，消耗体力</dd><dt>交互 / 继续对话</dt><dd>E</dd><dt>攻击 / 连斩</dt><dd>J / 游戏画布左键；连按衔接，教本训练后接近战第四刀；I／中键独立剑风，按住连续施放；可越水，不能穿实体障碍</dd><dt>切换瞄准镜目标</dt><dd>${this.hudPreferences.cycleTarget.toUpperCase()}（按住 I 自动瞄准时）；设置可改键，中键仍手动布局</dd><dt>迎风架剑 / 弹反</dt><dd>K / 游戏画布右键；成功自动反斩；远程弹反发出剑气，J 接第二、第三刀</dd><dt>风步</dt><dd>L</dd><dt>符文 / 归风</dt><dd>R 查看符文；脱战后长按 G 引导归风</dd><dt>使用快捷道具</dt><dd>1–8 / 点击对应格子</dd><dt>行囊 / 完整地图 / 手记</dt><dd>Tab / M / Q（游戏中）</dd><dt>暂停 / 返回</dt><dd>Esc；子页面先返回菜单</dd><dt>菜单焦点与操作</dt><dd>Tab / Shift + Tab 切换；Enter / 空格确认</dd></dl><button id="close">返回暂停菜单</button>`,
      );
    if (mode === "settings") {
      this.shell(
        "旅途设置",
        `<label>切换锁定目标 <select id="cycle-target">${["v","b","c"].map(key=>`<option value="${key}" ${this.hudPreferences.cycleTarget===key?"selected":""}>${key.toUpperCase()}</option>`).join("")}</select></label><label>音效音量 <input id="volume" type="range" min="0" max="100" value="${Math.round(this.actions.getVolume() * 100)}"></label><label>夜间可见度 <input id="night-visibility" type="range" min="0" max="100" value="${Math.round(this.hudPreferences.nightVisibility*100)}"></label><p class="muted">可见度只调整表现。环境音与音效均使用程序合成。</p><button id="fullscreen">切换全屏</button><button id="back">返回</button>`,
      );
      this.modal.querySelector<HTMLSelectElement>('#cycle-target')!.onchange=e=>{this.hudPreferences.cycleTarget=(e.target as HTMLSelectElement).value;this.savePreferences();};
      this.modal.querySelector<HTMLInputElement>("#night-visibility")!.oninput=(e)=>{this.hudPreferences.nightVisibility=Number((e.target as HTMLInputElement).value)/100;this.savePreferences();};
      const options=document.createElement('div');options.style.cssText='display:grid;gap:8px';options.innerHTML=`<label><input id="combat-numbers-option" type="checkbox" ${this.hudPreferences.combatNumbers?'checked':''}> 显示战斗伤害数字</label><label><input id="combat-shake-option" type="checkbox" ${this.hudPreferences.combatShake?'checked':''}> 轻微击杀与破防震屏</label>`;
      this.modal.querySelector('#night-visibility')!.closest('label')!.after(options);
      if(this.state){const preferences=document.createElement('div');preferences.innerHTML=`<label><input id="rune-simple" type="checkbox" ${this.state.runes.settings.simple?'checked':''}> 简化符文装饰（保留攻击与判定）</label><label><input id="rune-low-flash" type="checkbox" ${this.state.runes.settings.lowFlash?'checked':''}> 降低雷光与凰焰闪光</label>`;options.after(preferences);preferences.onchange=()=>{if(!this.state)return;this.state.runes.settings.simple=preferences.querySelector<HTMLInputElement>('#rune-simple')!.checked;this.state.runes.settings.lowFlash=preferences.querySelector<HTMLInputElement>('#rune-low-flash')!.checked;void this.actions.save().catch(()=>{});};}
      options.onchange=()=>{this.hudPreferences.combatNumbers=options.querySelector<HTMLInputElement>('#combat-numbers-option')!.checked;this.hudPreferences.combatShake=options.querySelector<HTMLInputElement>('#combat-shake-option')!.checked;this.savePreferences();this.actions.presentation?.(this.hudPreferences.combatNumbers,this.hudPreferences.combatShake);};
      this.modal.querySelector<HTMLInputElement>("#volume")!.oninput = (e) =>
        this.actions.volume(Number((e.target as HTMLInputElement).value) / 100);
      this.button("fullscreen", () => {
        const p = document.fullscreenElement
          ? document.exitFullscreen()
          : document.documentElement.requestFullscreen();
        p.catch(() => this.message("浏览器未允许全屏，请使用浏览器全屏菜单。"));
      });
      this.button("back", () => this.close());
    }
    if(mode!=="runes"&&mode!=="map")this.button("close", () => this.close());
    this.focusPanel();
  }
  skillJournal(s:State){
    const skills=s.skills,stage=skills.swordWindStage;
    const pending=WIND_LESSONS.find(l=>skills.completedLessons.includes(l.id)&&l.stage>stage);
    const next=WIND_LESSONS.find(l=>l.stage>stage&&!skills.completedLessons.includes(l.id)&&skills.discoveredLessons.includes(l.id));
    const records=WIND_LESSONS.filter(l=>skills.completedLessons.includes(l.id)).map(l=>`<li>${l.name} · ${l.source}${l.stage>stage?'（经历已保存，等待前置）':''}</li>`).join('');
    return `<section class="skill-journal"><h2>旅人技艺</h2><h3>${WIND_NAMES[stage]}</h3><p>${WIND_EFFECTS[stage]}</p><p>学习来源：${windLearningSource(skills)}</p><p>永久近战：${skills.meleeFinisher?'四连终结':'三连（练习场教本可学四连）'}。J／左键即时连斩；I／中键独立剑风，按住连续施放；剑风可越过水面，实体障碍会截断。</p>${records?`<ul>${records}</ul>`:''}<p>${pending?windLessonStatus(skills,pending.id).replaceAll('\n','<br>'):next?`已发现的线索：${next.name} · ${next.hint}`:stage===5?'五段传承已掌握。能力永久保留，不占技法位置。':'尚未发现新的传承线索，可观察旅途中的教本与风敏装置。'}</p></section>`;
  }
  offerShop(id: ShopId) {
    const button = document.createElement("button");
    button.textContent = "查看药师服务";
    button.onclick = () => this.shop(id);
    this.modal.querySelector(".dialog-copy")?.append(button);
  }
  dialog(name: string, text: string, source: string = "sign", closed?:()=>void, options?:DialogueOptions) {
    this.dialogClosed=closed;
    this.returnTo = "";
    this.returnFocus = null;
    this.mode = "dialog";
    const portrait = dialoguePortraitFor(source);
    const category = portrait
      ? "交谈"
      : source === "rune"
        ? "风之回声"
        : source === "sign"
          ? "路牌"
          : "交谈";
    this.modal.hidden = false;
    this.modal.classList.remove("equipment-modal", "bag-modal", "rune-modal");
    this.modal.classList.add("story-modal");
    this.root.classList.add("dialog-open");
    this.hud.inert = true;
    const closeButton='<button id="close" class="dialog-continue" aria-label="继续 · E"><kbd aria-hidden="true">E</kbd><span>继续</span></button>';
    this.modal.innerHTML = `<section class="dialog-panel${portrait ? " dialog-panel--portrait" : ""}${options ? " dialog-panel--choices" : ""}" role="dialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby="dialog-text">${portrait ? '<div class="dialogue-portrait"><img></div>' : ""}<div class="dialog-copy"><header><small id="dialog-context"></small><h1 id="dialog-title"></h1></header><p id="dialog-text" class="dialog-text" tabindex="0" aria-label="对话正文，可滚动阅读"></p>${options?.note?'<p class="dialog-note" role="status"></p>':''}</div>${options?`<div class="dialog-actions">${options.choices.length?'<p class="dialog-response">你的回应</p><div class="dialog-options"></div>':''}<p class="dialog-feedback" role="status" aria-live="polite" hidden></p>${closeButton}</div>`:closeButton}</section>`;
    const portraitImage = this.modal.querySelector<HTMLImageElement>(
      ".dialogue-portrait img",
    );
    if (portraitImage && portrait) {
      portraitImage.alt = portrait.alt;
      portraitImage.style.objectPosition = portrait.objectPosition;
      // 加载失败只移除本次渲染的图片列，不改变对话或任务；旧请求不会操作新对话。
      portraitImage.addEventListener(
        "error",
        () => {
          const panel = portraitImage.closest(".dialog-panel");
          portraitImage.parentElement?.remove();
          panel?.classList.remove("dialog-panel--portrait");
        },
        { once: true },
      );
      portraitImage.src = portrait.src;
    }
    this.modal.querySelector("#dialog-context")!.textContent =
      options?.context ?? `${this.state ? region(this.state.player.x, this.state.player.y) : "远风之地"} · ${category}`;
    this.modal.querySelector("#dialog-title")!.textContent = name;
    this.modal.querySelector("#dialog-text")!.textContent = text;
    if(options){
      const choices=this.modal.querySelector('.dialog-options');
      options.choices.forEach((choice,i)=>{
        const button=document.createElement('button');button.type='button';button.id=choice.id;button.className='dialog-option';
        button.innerHTML='<span class="dialog-option-mark" aria-hidden="true"></span><span class="dialog-option-copy"><span class="dialog-option-label"></span></span>';
        button.querySelector('.dialog-option-mark')!.textContent=String(i+1).padStart(2,'0');
        button.querySelector('.dialog-option-label')!.textContent=choice.label;
        if(choice.detail){const detail=document.createElement('span');detail.className='dialog-option-detail';detail.textContent=choice.detail;button.querySelector('.dialog-option-copy')!.append(detail);}
        button.setAttribute('aria-label',choice.label+(choice.detail?' · '+choice.detail:''));
        button.addEventListener('click',choice.select);choices?.append(button);
      });
      const close=this.modal.querySelector<HTMLButtonElement>('#close')!;
      close.querySelector('kbd')!.textContent='Esc';close.querySelector('span')!.textContent=options.closeLabel??'先告辞';close.setAttribute('aria-label',(options.closeLabel??'先告辞')+' · Esc');
      if(options.note)this.modal.querySelector('.dialog-note')!.textContent=options.note;
    }
    this.button("close", () => this.close());
    this.modal
      .querySelector<HTMLButtonElement>(options?.choices.length?'.dialog-option':"#close")!
      .focus({ preventScroll: true });
    this.actions.pause();
  }
  export() {
    if (!this.state) return;
    this.download(this.state,'farwind-save.json');
  }
  download(value:unknown,name:string){
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([JSON.stringify(value, null, 2)], {
        type: "application/json",
      }),
    );
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  import() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    // 保持文件控件挂在文档中，选择文件期间不能成为失效的游离节点。
    input.hidden = true;
    document.body.append(input);
    input.oncancel = () => input.remove();
    input.onchange = async () => {
      try {
        const f = input.files?.[0];
        if (!f) return;
        if (f.size > MAX_SAVE_BYTES) throw Error("存档超过 2 MB 限制");
        const s = parseSave(await f.text());
        if (!confirm("导入将覆盖当前本地存档。是否继续？")) return;
        await this.actions.import(s);
      } catch (e) {
        this.message((e as Error).message);
      } finally {
        input.remove();
      }
    };
    input.click();
  }
  update(s: State, prompt: string) {
    const coins = this.root.querySelector<HTMLElement>("#coin-status")!;
    coins.textContent = String(s.coins);
    coins.title = `金币 ${s.coins}`;
    coins.setAttribute('aria-label', `金币余额 ${s.coins}`);
    this.state = s;
    const vitals = playerVitals(s);
    updateRuneHud(this);
    updateCampBossHud(this.root.querySelector<HTMLElement>("#camp-boss-status")!,s);
    const demon=this.root.querySelector<HTMLButtonElement>('#demon-king-summary')!;
    demon.hidden=demonMalice(s.encounters)===0;demon.textContent=`恶意 ${demonMalice(s.encounters)}`;demon.title=`${demonKingSummary(s)}；点击查看黑焰与来袭规则`;
    const demonDetail = this.root.querySelector<HTMLElement>('#demon-king-detail')!;
    demonDetail.hidden = demon.hidden;
    demonDetail.textContent = demonKingSummary(s);
    this.root
      .querySelector(".health i")!
      .setAttribute("style", `width:${s.player.hp / vitals.maxHp * 100}%`);
    this.root.querySelector(".health span")!.textContent =
      `${Math.ceil(s.player.hp)} / ${vitals.maxHp}`;
    this.root.querySelector('.health')!.setAttribute('aria-valuenow', String(Math.ceil(s.player.hp)));
    this.root.querySelector('.health')!.setAttribute('aria-valuemax', String(vitals.maxHp));
    this.root
      .querySelector(".stamina i")!
      .setAttribute("style", `width:${s.player.stamina / vitals.maxStamina * 100}%`);
    this.root.querySelector(".stamina span")!.textContent =
      `${Math.ceil(s.player.stamina)} / ${vitals.maxStamina}`;
    this.root.querySelector('.stamina')!.setAttribute('aria-valuenow', String(Math.ceil(s.player.stamina)));
    this.root.querySelector('.stamina')!.setAttribute('aria-valuemax', String(vitals.maxStamina));
    const cat=this.root.querySelector<HTMLButtonElement>('#cat-summary')!;
    cat.querySelector('span')!.textContent=`小黑 · ${CAT_STAGES[catStage(s.catBond.score)].name}`;
    cat.title=`默契 ${s.catBond.score}/100 · ${this.actions.catStatus?.()??''}`;
    const place=cityBuilding(s.life.playerSpace)?.name??region(s.player.x,s.player.y);
    this.root.querySelector("#region")!.textContent = place;
    const time = `${String(Math.floor(s.time / 60) % 24).padStart(2, "0")}:${String(Math.floor(s.time % 60)).padStart(2, "0")}`;
    this.root.querySelector("#clock")!.textContent = clockLabel(s.time);
    this.root.querySelector("#day")!.textContent =
      `第 ${Math.floor(s.time / 1440) + 1} 日 · ${place}`;
    const tracked=legacyTracked(s),inCity=isCitySpace(s.life.playerSpace)||s.life.playerSpace==='village'&&s.player.x>9690;
    const roadTask=roadTracked(s);
    const objective=roadTask?roadQuestText(s)+(roadTask.name==='清剿裂牙巢穴'?' · 桥前密林北侧支路':' · '+roadTask.name):inCity?`风塔异响：${CITY_MAIN_HINTS[s.city.progress.main]}`:tracked?`${tracked.name}：${tracked.text}`:s.fieldQuests["south-supply"]==="active"?southQuestObjective(s):objectives[s.quest];
    this.root.querySelector("#objective")!.textContent = objective;
    this.root.querySelector("#objective-summary")!.textContent =
      `任务 · ${objective}`;
    const questToggle = this.root.querySelector("#quest-toggle")!;
    questToggle.setAttribute(
      "aria-label",
      `${this.hudPreferences.quest ? "收起" : "展开"}任务详情：${objective}`,
    );
    questToggle.setAttribute("title", objective);
    if (this.lastQuest !== undefined && this.lastQuest !== s.quest)
      this.message("目标已更新");
    this.lastQuest = s.quest;
    this.root.querySelector("#prompt")!.textContent = prompt;
    this.root.querySelector("#combat-status")!.textContent = this.combatStatus;
    this.root.querySelector<HTMLElement>("#combat-status")!.title = this.combatStatus;
    this.root.querySelector("#combat-status-detail")!.textContent = this.combatStatus;
    const hotbar = this.root.querySelector("#hotbar")!;
    if (!hotbar.children.length)
      hotbar.innerHTML = Array.from(
        { length: 8 },
        (_, i) =>
          `<button data-hotbar-slot="${i}" aria-describedby="hotbar-info"><small>${i + 1}</small><img class="item-icon" alt="" hidden><span>—</span><strong></strong></button>`,
      ).join("");
    s.hotbar.forEach((item, i) => {
      const button = hotbar.children[i] as HTMLButtonElement;
      const icon = button.querySelector<HTMLImageElement>("img")!;
      const amount = item ? count(s, item) : "";
      const name = item
        ? `${items[item].name} · 快捷键 ${i + 1} · 数量 ${amount}`
        : `空槽 · 快捷键 ${i + 1} · 在行囊中绑定`;
      button.title = name;
      button.setAttribute("aria-label", name);
      button.classList.toggle("occupied", !!item);
      if (item) {
        button.dataset.use = item;
        const src = itemIcon(item);
        if (src && icon.getAttribute("src") !== src) icon.src = src;
      } else delete button.dataset.use;
      icon.hidden = !item || !itemIcon(item);
      button.querySelector<HTMLElement>("span")!.hidden =
        !!item && !!itemIcon(item);
      if (item && !itemIcon(item))
        button.querySelector<HTMLElement>("span")!.textContent =
          items[item].name;
      button.querySelector("strong")!.textContent = String(amount);
      if (document.activeElement === button || button.matches(":hover"))
        this.root.querySelector("#hotbar-info")!.textContent = name;
    });
    if (this.hudPreferences.minimap)
      this.minimap.draw(this.root.querySelector("#minimap")!, s);
  }
  showMap() {
    showWorldAtlas(this);
  }
}
