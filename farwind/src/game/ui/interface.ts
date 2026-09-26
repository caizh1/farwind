import {
  WORLD,
  BRIDGES,
  POND,
  roads,
  villageAreas,
  showLayoutLabels,
  villageRoutes,
  routeSeconds,
} from "../../data/world";
import { TRAINING, type TrainingDummy } from "../systems/training";
import { items, objectives, type ItemId } from "../../data/content";
import {
  MAP_REGIONS,
  VILLAGE_WALLS,
  VILLAGE_PORTALS,
  RESERVED_PARCELS,
} from "../../data/village";
import { count, craft, discard, parseSave, type State } from "../systems/state";
import { region } from "../../data/world";
import type { PracticeMode } from "../systems/parryTraining";
import { dialoguePortraitFor } from "../../data/dialoguePortraits";
export type Actions = {
  start: (continued: boolean) => void;
  save: () => Promise<void>;
  import: (s: State) => Promise<void>;
  use: (id: ItemId) => void;
  pause: () => void;
  volume: (v: number) => void;
  getVolume: () => number;
  title: () => void;
  practice: (mode: PracticeMode) => void;
};
export class Interface {
  root = document.querySelector<HTMLDivElement>("#ui")!;
  mode = "title";
  available = false;
  selected: ItemId | null = null;
  hudPreferences = this.readPreferences();
  returnTo: "" | "pause" | "title" = "";
  returnFocus: HTMLElement | null = null;
  pauseFocus = "";
  lastQuest?: number;
  usedSlotTimer?: ReturnType<typeof setTimeout>;
  state?: State;
  combatStatus = "L 风步 · 就绪";
  actions!: Actions;
  modal!: HTMLElement;
  hud!: HTMLElement;
  toastEl!: HTMLElement;
  constructor() {
    this.root.innerHTML = `<div id="hud" hidden>
      <div class="top"><div class="vitals-stack"><section class="vitals"><img class="portrait" src="/assets/portrait.png" alt="旅行者"><div><b>旅人 <small>与小黑同行</small></b><div class="meter health"><i></i><span></span></div><div class="meter stamina"><i></i><span></span></div></div></section>
      <span id="combat-status">L 风步 · 就绪</span>
      <section id="training-panel" hidden><b>木桩练习</b><small>J / 左键：攻击；连按接三连；L：风步</small><span id="training-stats"></span><button data-practice-menu="true">迎风架剑练习</button><span id="parry-feedback" hidden></span></section></div>
      <div class="hud-info"><section class="location"><button id="minimap-toggle" class="hud-summary" aria-expanded="false" aria-controls="minimap-details" aria-label="展开小地图"><b id="region">风铃村</b><span>·</span><span id="clock"></span><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Zm6-2v16m6-14v16"/></svg><span class="chevron" aria-hidden="true">▾</span></button><div id="minimap-details" class="hud-details map-details" hidden><small id="day"></small><canvas id="minimap" width="192" height="101" aria-label="位置小地图"></canvas><button class="text-button" data-panel="map">M 完整地图</button></div></section>
      <section class="quest-tracker"><button id="quest-toggle" class="hud-summary" aria-expanded="false" aria-controls="quest-details"><span id="objective-summary" class="ellipsis"></span><span class="chevron" aria-hidden="true">▾</span></button><div id="quest-details" class="hud-details quest-details" hidden><small>主线 · 失落的风</small><p id="objective"></p><button class="text-button" data-panel="quest">Q 旅途手记</button></div></section></div></div>
      <div id="prompt"></div><div id="menu-hint" role="status" hidden>Esc 打开菜单 / 查看操作</div><div class="bottom"><span id="hotbar-info" role="tooltip" hidden></span><div id="hotbar" role="group" aria-label="快捷道具栏，1 至 8"></div></div></div><div id="toast" role="status"></div><div id="modal"></div>`;
    this.modal = this.root.querySelector("#modal")!;
    this.hud = this.root.querySelector("#hud")!;
    this.toastEl = this.root.querySelector("#toast")!;
    this.root.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
      if (b?.dataset.panel) this.open(b.dataset.panel);
      if (b?.dataset.practiceMenu) this.open("practice");
      if (b?.dataset.use) this.useSlot(Number(b.dataset.hotbarSlot));
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
    this.root.addEventListener("pointerdown", (e) => {
      if ((e.target as Element).closest("button, .hud-details, #modal"))
        e.stopPropagation();
    });
    this.root.addEventListener("focusin", (e) => {
      if ((e.target as Element).closest("#hud button, #hud input, #hud select"))
        this.actions?.pause();
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
      minimap: false,
      quest: false,
      menuHintSeen: false,
    };
    try {
      const p = JSON.parse(localStorage.getItem("farwind-hud-v1") ?? "null");
      if (p?.version === 1)
        for (const key of ["minimap", "quest", "menuHintSeen"] as const)
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
      this.drawMap(this.root.querySelector("#minimap")!, this.state, "minimap");
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
      !!(document.activeElement as Element)?.closest("button, input, select")
    );
  }
  focusGame() {
    if (this.hud.contains(document.activeElement))
      (document.activeElement as HTMLElement).blur();
  }
  handleKey(e: KeyboardEvent) {
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
  practiceFeedback(feedback: string, mode: PracticeMode) {
    const text = this.root.querySelector<HTMLElement>("#parry-feedback");
    if (text) {
      text.hidden = mode === "off";
      text.textContent = feedback;
    }
  }
  training(s: ReturnType<TrainingDummy["snapshot"]>, near: boolean) {
    const panel = this.root.querySelector<HTMLElement>("#training-panel")!;
    panel.hidden = !near && !s.visible;
    const stats = this.root.querySelector<HTMLElement>("#training-stats")!;
    stats.textContent = s.visible
      ? `第${s.lastStage}段 · ${s.lastDamage}伤害；本组命中${s.stages.length}/3；累计${s.damage}${s.complete ? " · 三连完成" : ""}`
      : "";
    stats.style.opacity = String(
      Math.max(0, Math.min(1, (TRAINING.linger - s.age) / TRAINING.fade)),
    );
  }
  get paused() {
    return this.mode !== "";
  }
  message(s: string) {
    this.toastEl.textContent = s;
    this.toastEl.classList.add("show");
    setTimeout(() => {
      if (this.toastEl.textContent === s) this.toastEl.classList.remove("show");
    }, 3500);
  }
  shell(title: string, body: string) {
    this.root.classList.remove("dialog-open");
    this.hud.inert = true;
    this.modal.classList.remove("story-modal");
    this.modal.hidden = false;
    this.modal.innerHTML = `<section class="panel${this.mode === "pause" ? " pause-panel" : ""}" role="dialog" aria-modal="true" aria-labelledby="panel-title"><header><small>远 风 之 地</small><h1 id="panel-title">${title}</h1></header>${body}</section>`;
    this.actions?.pause();
  }
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
    this.modal.classList.remove("story-modal");
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
  }
  open(mode: string) {
    if (!this.state && mode !== "settings") return;
    if (this.mode !== mode) {
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
    if (mode === "practice") {
      this.shell(
        "迎风架剑练习",
        `<p>K／画布右键架剑；接触成功后主动 J／左键反击，可继续二、三刀。来招风纹持续收拢，锁向后绕背可令其挥空。练习不扣生命、不掉落、不推进任务。</p><div class="practice-options"><button data-practice="slow">慢速教学 · 900毫秒</button><button data-practice="slime">史莱姆节奏 · 450毫秒</button><button data-practice="leaf">叶灵节奏 · 650毫秒</button><button data-practice="chain">轻击收手 → 弹反 → 三连</button><button data-practice="off">结束弹反练习</button></div><button id="close">返回木桩练习</button>`,
      );
      this.modal.querySelectorAll<HTMLButtonElement>("[data-practice]").forEach(
        (b) =>
          (b.onclick = () => {
            this.actions.practice(b.dataset.practice as PracticeMode);
            this.close();
          }),
      );
    }
    if (mode === "bag" && s) {
      this.shell(
        "旅人的行囊",
        `<p class="muted">24 格 · 每格最多 20 件 · 选择物品查看说明并绑定快捷栏</p><div class="bag">${s.bag.map((a, i) => `<button class="slot" data-slot="${i}">${a ? `<img class="item-icon" src="/assets/icon-${a.id}.png" alt="">${items[a.id].name}<strong>×${a.count}</strong>` : "·"}</button>`).join("")}</div><p id="item-info">恢复药剂：药草 ×2 + 浆果 ×1，恢复 50 生命。</p><div class="row"><button id="craft">制作恢复药剂</button><button id="consume">使用选中物品</button><button id="discard">丢弃一件</button><select id="bind" aria-label="快捷栏位置">${Array.from({ length: 8 }, (_, i) => `<option value="${i}">快捷栏 ${i + 1}</option>`).join("")}</select><button id="bind-button">绑定</button></div><button id="close">收好行囊</button>`,
      );
      this.modal.querySelectorAll<HTMLButtonElement>("[data-slot]").forEach(
        (b) =>
          (b.onclick = () => {
            this.selected = s.bag[Number(b.dataset.slot)]?.id ?? null;
            this.modal.querySelector("#item-info")!.textContent = this.selected
              ? items[this.selected].description
              : "空格";
            this.modal
              .querySelectorAll(".slot")
              .forEach((a) => a.classList.remove("selected"));
            b.classList.add("selected");
          }),
      );
      this.button("craft", () => {
        if (craft(s)) {
          this.message("制作成功：恢复药剂 ×1");
          this.open("bag");
        } else
          this.message(
            "制作失败：需要药草 ×2、浆果 ×1，并有成品空间；未扣材料。",
          );
      });
      this.button("consume", () => {
        if (this.selected) {
          this.actions.use(this.selected);
          this.open("bag");
        }
      });
      this.button("discard", () => {
        if (
          this.selected &&
          confirm("确定丢弃一件" + items[this.selected].name + "？")
        ) {
          if (!discard(s, this.selected))
            this.message("风之结晶是重要任务材料，不能丢弃。");
          this.open("bag");
        }
      });
      this.button("bind-button", () => {
        if (this.selected) {
          s.hotbar[
            Number(
              (this.modal.querySelector("#bind") as HTMLSelectElement).value,
            )
          ] = this.selected;
          this.message("快捷栏已绑定");
        }
      });
    }
    if (mode === "quest" && s)
      this.shell(
        "旅途手记",
        `<h2>主线 · 失落的风</h2><p>${objectives[s.quest]}</p><ol class="journal">${objectives
          .slice(0, 7)
          .map(
            (q, i) =>
              `<li class="${i < s.quest ? "done" : ""}">${i < s.quest ? "✓ " : ""}${q}</li>`,
          )
          .join(
            "",
          )}</ol><h2>支线 · 木匠的托付</h2><p>${["与西南方的木匠阿禾交谈", "为阿禾收集 4 份木材", "已交付，收到浆果与谢意"][s.side]}</p><button id="close">合上手记</button>`,
      );
    if (mode === "map" && s) {
      this.shell(
        "风的足迹",
        `<p>风铃村 → 翡翠森林 → 风之遗迹</p><canvas id="world-map" width="840" height="440"></canvas><div class="map-guide">${villageAreas.map((a) => `<p><b>${showLayoutLabels(import.meta.env.DEV, window.location.search) ? `${a.id} ` : ""}${a.name}</b> · ${a.detail}</p>`).join("")}</div><div class="map-routes">${villageRoutes.map((r) => `<p><b>${r.name}</b> · 约 ${routeSeconds(r.points)} 秒（步行、不含停留）</p>`).join("")}</div><p class="muted">世界 4200 × 2200 · 金点是你的位置。临水木桥可步行，池水不可通行；遗迹南侧的归乡风径修复后开放。</p><button id="close">收起地图</button>`,
      );
      this.drawMap(this.modal.querySelector("canvas")!, s, "world-map");
    }
    if (mode === "pause") {
      this.shell(
        "在风中歇一会儿",
        `<p class="pause-note">世界与时间已暂停。</p><button id="close" class="resume">继续旅途 <kbd>Esc</kbd></button><div class="pause-grid"><button id="pause-bag" data-panel="bag">行囊 <kbd>Tab</kbd></button><button id="pause-map" data-panel="map">完整地图 <kbd>M</kbd></button><button id="pause-quest" data-panel="quest">旅途手记 <kbd>Q</kbd></button><button id="pause-help" data-panel="help">操作说明 <span>查看操作</span></button></div><h2>存档与设置</h2><div class="pause-grid"><button id="save">保存旅途</button><button id="export">导出备份</button><button id="import">导入存档</button><button id="settings">设置</button><button id="title" class="wide">保存并返回标题</button></div><p class="backup-note">备份需下载到站点之外；清理站点数据会删除本地存档。</p>`,
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
        `<dl class="controls-guide"><dt>移动</dt><dd>WASD / 方向键</dd><dt>奔跑</dt><dd>按住空格并移动，消耗体力</dd><dt>交互 / 继续对话</dt><dd>E</dd><dt>攻击 / 三连斩</dt><dd>J / 游戏画布左键；连按衔接</dd><dt>迎风架剑 / 弹反</dt><dd>K / 游戏画布右键</dd><dt>风步</dt><dd>L</dd><dt>使用快捷道具</dt><dd>1–8 / 点击对应格子</dd><dt>行囊 / 完整地图 / 手记</dt><dd>Tab / M / Q（游戏中）</dd><dt>暂停 / 返回</dt><dd>Esc；子页面先返回菜单</dd><dt>菜单焦点与操作</dt><dd>Tab / Shift + Tab 切换；Enter / 空格确认</dd></dl><button id="close">返回暂停菜单</button>`,
      );
    if (mode === "settings") {
      this.shell(
        "旅途设置",
        `<label>音效音量 <input id="volume" type="range" min="0" max="100" value="${Math.round(this.actions.getVolume() * 100)}"></label><p class="muted">使用程序合成音效，暂无背景音乐。</p><button id="fullscreen">切换全屏</button><button id="back">返回</button>`,
      );
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
    this.button("close", () => this.close());
    this.focusPanel();
  }
  dialog(name: string, text: string, source: string = "sign") {
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
    this.modal.classList.add("story-modal");
    this.root.classList.add("dialog-open");
    this.hud.inert = true;
    this.modal.innerHTML = `<section class="dialog-panel${portrait ? " dialog-panel--portrait" : ""}" role="dialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby="dialog-text">${portrait ? '<div class="dialogue-portrait"><img></div>' : ""}<div class="dialog-copy"><header><small id="dialog-context"></small><h1 id="dialog-title"></h1></header><p id="dialog-text" class="dialog-text" tabindex="0" aria-label="对话正文，可滚动阅读"></p></div><button id="close" class="dialog-continue" aria-label="继续 · E"><kbd aria-hidden="true">E</kbd><span>继续</span></button></section>`;
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
      `${this.state ? region(this.state.player.x, this.state.player.y) : "远风之地"} · ${category}`;
    this.modal.querySelector("#dialog-title")!.textContent = name;
    this.modal.querySelector("#dialog-text")!.textContent = text;
    this.button("close", () => this.close());
    this.modal
      .querySelector<HTMLButtonElement>("#close")!
      .focus({ preventScroll: true });
    this.actions.pause();
  }
  export() {
    if (!this.state) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob([JSON.stringify(this.state, null, 2)], {
        type: "application/json",
      }),
    );
    a.download = "farwind-save.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  import() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async () => {
      try {
        const f = input.files?.[0];
        if (!f) return;
        if (f.size > 200000) throw Error("存档超过 200 KB");
        const s = parseSave(await f.text());
        if (!confirm("导入将覆盖当前本地存档。是否继续？")) return;
        await this.actions.import(s);
      } catch (e) {
        this.message((e as Error).message);
      }
    };
    input.click();
  }
  update(s: State, prompt: string) {
    this.state = s;
    this.root
      .querySelector(".health i")!
      .setAttribute("style", `width:${s.player.hp}%`);
    this.root.querySelector(".health span")!.textContent =
      `生命 ${Math.ceil(s.player.hp)} / 100`;
    this.root
      .querySelector(".stamina i")!
      .setAttribute("style", `width:${s.player.stamina}%`);
    this.root.querySelector(".stamina span")!.textContent =
      `体力 ${Math.ceil(s.player.stamina)} / 100`;
    this.root.querySelector("#region")!.textContent = region(
      s.player.x,
      s.player.y,
    );
    const time = `${String(Math.floor(s.time / 60) % 24).padStart(2, "0")}:${String(Math.floor(s.time % 60)).padStart(2, "0")}`;
    this.root.querySelector("#clock")!.textContent = time;
    this.root.querySelector("#day")!.textContent =
      `第 ${Math.floor(s.time / 1440) + 1} 日 · ${region(s.player.x, s.player.y)}`;
    this.root.querySelector("#objective")!.textContent = objectives[s.quest];
    this.root.querySelector("#objective-summary")!.textContent =
      `任务 · ${objectives[s.quest]}`;
    const questToggle = this.root.querySelector("#quest-toggle")!;
    questToggle.setAttribute(
      "aria-label",
      `${this.hudPreferences.quest ? "收起" : "展开"}任务详情：${objectives[s.quest]}`,
    );
    questToggle.setAttribute("title", objectives[s.quest]);
    if (this.lastQuest !== undefined && this.lastQuest !== s.quest)
      this.message("目标已更新");
    this.lastQuest = s.quest;
    this.root.querySelector("#prompt")!.textContent = prompt;
    this.root.querySelector("#combat-status")!.textContent = this.combatStatus;
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
        const src = `/assets/icon-${item}.png`;
        if (icon.getAttribute("src") !== src) icon.src = src;
      } else delete button.dataset.use;
      icon.hidden = !item;
      button.querySelector<HTMLElement>("span")!.hidden = !!item;
      button.querySelector("strong")!.textContent = String(amount);
      if (document.activeElement === button || button.matches(":hover"))
        this.root.querySelector("#hotbar-info")!.textContent = name;
    });
    if (this.hudPreferences.minimap)
      this.drawMap(this.root.querySelector("#minimap")!, s, "minimap");
  }
  drawMap(c: HTMLCanvasElement, s: State, mode: "minimap" | "world-map") {
    const mini = mode === "minimap";
    const w = mini ? 192 : 840,
      h = mini ? 101 : 440;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    const ctx = c.getContext("2d")!;
    ctx.setTransform(c.width / w, 0, 0, c.height / h, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = 1;
    const sx = w / WORLD.width,
      sy = h / WORLD.height;
    ctx.fillStyle = "#9cb67e";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#477d66";
    ctx.fillRect(WORLD.forest * sx, 0, (WORLD.ruins - WORLD.forest) * sx, h);
    ctx.fillStyle = "#aaa78a";
    ctx.fillRect(WORLD.ruins * sx, 0, w - WORLD.ruins * sx, h);
    for (const r of MAP_REGIONS.filter(
      (r) => r.id === "north" || r.id === "south",
    )) {
      ctx.beginPath();
      r.polygon.forEach((p, i) =>
        i ? ctx.lineTo(p.x * sx, p.y * sy) : ctx.moveTo(p.x * sx, p.y * sy),
      );
      ctx.closePath();
      ctx.fillStyle = "#b3a176";
      ctx.fill();
    }
    // 地形合成完成后统一降低底层alpha，避免重叠区域累计成实色。
    if (mini) {
      ctx.globalCompositeOperation = "destination-in";
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.strokeStyle = "#e6ce9b";
    ctx.lineWidth = mini ? 2 : 5;
    roads.forEach((path) => {
      ctx.beginPath();
      path.forEach(([x, y], i) =>
        i ? ctx.lineTo(x * sx, y * sy) : ctx.moveTo(x * sx, y * sy),
      );
      ctx.stroke();
    });
    ctx.fillStyle = "#4c9bad";
    ctx.beginPath();
    ctx.ellipse(
      POND.x * sx,
      POND.y * sy,
      POND.rx * sx,
      POND.ry * sy,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.fillStyle = "#c49a62";
    BRIDGES.forEach((b) =>
      ctx.fillRect(b.x * sx, b.y * sy, b.w * sx, b.h * sy),
    );
    if (!mini) {
      ctx.strokeStyle = "#805634";
      ctx.lineWidth = 3;
      VILLAGE_WALLS.forEach(({ a, b }) => {
        ctx.beginPath();
        ctx.moveTo(a.x * sx, a.y * sy);
        ctx.lineTo(b.x * sx, b.y * sy);
        ctx.stroke();
      });
      ctx.font = "12px serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#284b3b";
      VILLAGE_PORTALS.forEach((p) =>
        ctx.fillText(
          p.open ? p.name : "西门（封闭）",
          p.x * sx + (p.axis === "x" ? -22 : 0),
          p.y * sy - 12,
        ),
      );
      ctx.strokeStyle = "#637347";
      ctx.setLineDash([4, 3]);
      RESERVED_PARCELS.forEach((p) =>
        ctx.strokeRect(p.x * sx, p.y * sy, p.w * sx, p.h * sy),
      );
      ctx.setLineDash([]);
      ctx.font = "bold 14px serif";
      ctx.textAlign = "center";
      if (showLayoutLabels(import.meta.env.DEV, window.location.search))
        villageAreas.forEach((a) => {
          ctx.fillStyle = "#284b3b";
          ctx.fillRect(a.x * sx - 10, a.y * sy - 11, 20, 22);
          ctx.fillStyle = "#fff4cf";
          ctx.fillText(a.id, a.x * sx, a.y * sy + 5);
        });
      ctx.font = "18px serif";
      ctx.fillStyle = "#fff4cf";
      ctx.fillText("风铃村", 200, h * 0.16);
      ctx.fillText("翡翠森林", w * 0.64, h * 0.7);
      ctx.fillText("风之遗迹", w * 0.88, h * 0.18);
      ctx.textAlign = "start";
    }
    ctx.fillStyle = "#fff6ca";
    ctx.beginPath();
    ctx.arc(
      (s.player.x / WORLD.width) * w,
      (s.player.y / WORLD.height) * h,
      mini ? 3 : 6,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.strokeStyle = "#8d512e";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}
