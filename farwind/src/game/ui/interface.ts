import { items, objectives, type ItemId } from "../../data/content";
import { count, craft, discard, parseSave, type State } from "../systems/state";
import { region } from "../../data/world";
export type Actions = {
  start: (continued: boolean) => void;
  save: () => Promise<void>;
  import: (s: State) => Promise<void>;
  use: (id: ItemId) => void;
  pause: () => void;
  volume: (v: number) => void;
  getVolume: () => number;
  title: () => void;
};
export class Interface {
  root = document.querySelector<HTMLDivElement>("#ui")!;
  mode = "title";
  available = false;
  selected: ItemId | null = null;
  hotbarMarkup = "";
  state?: State;
  actions!: Actions;
  modal!: HTMLElement;
  hud!: HTMLElement;
  toastEl!: HTMLElement;
  constructor() {
    this.root.innerHTML = `<div id="hud" hidden><div class="top"><section class="vitals"><img class="portrait" src="/assets/portrait.png" alt="旅行者"><div><b>旅人 <small>与小黑同行</small></b><div class="meter health"><i></i><span></span></div><div class="meter stamina"><i></i><span></span></div></div></section><section class="location"><b id="region">风铃村</b><span id="clock"></span><canvas id="minimap" width="150" height="88" aria-label="位置小地图"></canvas></section></div><div class="quest-tracker"><small>风从这里开始</small><span id="objective"></span><button data-panel="quest">Q 旅途手记</button></div><div id="prompt"></div><div class="bottom"><span class="help">WASD 移动 · Shift 奔跑 · E 交互 · J 攻击</span><div id="hotbar"></div><div class="toolbar"><button data-panel="bag">Tab 行囊</button><button data-panel="map">M 地图</button><button data-panel="pause">Esc 暂停</button></div></div></div><div id="toast" role="status"></div><div id="modal"></div>`;
    this.modal = this.root.querySelector("#modal")!;
    this.hud = this.root.querySelector("#hud")!;
    this.toastEl = this.root.querySelector("#toast")!;
    this.root.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
      if (b?.dataset.panel) this.open(b.dataset.panel);
      if (b?.dataset.use) this.actions.use(b.dataset.use as ItemId);
    });
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
    this.modal.hidden = false;
    this.modal.innerHTML = `<section class="panel"><header><small>远 风 之 地</small><h1>${title}</h1></header>${body}</section>`;
    this.actions?.pause();
  }
  button(id: string, fn: () => void) {
    this.modal.querySelector("#" + id)?.addEventListener("click", fn);
  }
  title(error = "") {
    this.mode = "title";
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
  }
  close() {
    this.mode = "";
    this.modal.hidden = true;
    this.hud.hidden = false;
    this.actions.pause();
    if (this.state) this.update(this.state, "");
  }
  open(mode: string) {
    if (!this.state && mode !== "settings") return;
    this.mode = mode;
    const s = this.state;
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
        `<p>风铃村 → 翡翠森林 → 风之遗迹</p><canvas id="world-map" width="720" height="400"></canvas><p class="muted">金点是你的位置。石路连接三个可步行区域；遗迹南侧的归乡风径修复后开放。</p><button id="close">收起地图</button>`,
      );
      this.drawMap(this.modal.querySelector("canvas")!, s);
    }
    if (mode === "pause") {
      this.shell(
        "在风中歇一会儿",
        `<p>世界与时间已暂停。</p><div class="menu"><button id="close">继续旅途</button><button id="save">保存旅途</button><button id="export">导出备份</button><button id="import">导入存档</button><button id="settings">设置</button><button id="title">保存并返回标题</button></div><p class="muted">备份需下载到站点之外；清理站点数据会删除本地存档。</p>`,
      );
      this.button("save", () => void this.actions.save().catch(() => {}));
      this.button("export", () => this.export());
      this.button("import", () => this.import());
      this.button("settings", () => this.open("settings"));
      this.button("title", () => this.actions.title());
    }
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
      this.button("back", () =>
        this.hud.hidden ? this.title() : this.open("pause"),
      );
    }
    this.button("close", () => this.close());
  }
  dialog(name: string, text: string) {
    this.mode = "dialog";
    this.shell(
      name,
      `<p class="dialog-text">${text}</p><button id="close">继续 · E</button>`,
    );
    this.button("close", () => this.close());
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
    this.root.querySelector("#region")!.textContent = region(s.player.x);
    this.root.querySelector("#clock")!.textContent =
      `第 ${Math.floor(s.time / 1440) + 1} 日 · ${String(Math.floor(s.time / 60) % 24).padStart(2, "0")}:${String(Math.floor(s.time % 60)).padStart(2, "0")}`;
    this.root.querySelector("#objective")!.textContent = objectives[s.quest];
    this.root.querySelector("#prompt")!.textContent = prompt;
    const hotbarMarkup = s.hotbar
      .map(
        (a, i) =>
          `<button ${a ? `data-use="${a}"` : ""}><small>${i + 1}</small>${a ? `<img class="item-icon" src="/assets/icon-${a}.png" alt="${items[a].name}">` : "<span>—</span>"}<strong>${a ? count(s, a) : ""}</strong></button>`,
      )
      .join("");
    if (hotbarMarkup !== this.hotbarMarkup) {
      this.root.querySelector("#hotbar")!.innerHTML = hotbarMarkup;
      this.hotbarMarkup = hotbarMarkup;
    }
    this.drawMap(this.root.querySelector("#minimap")!, s);
  }
  drawMap(c: HTMLCanvasElement, s: State) {
    const ctx = c.getContext("2d")!,
      w = c.width,
      h = c.height;
    ctx.fillStyle = "#9cb67e";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#477d66";
    ctx.fillRect(w * 0.4, 0, w * 0.35, h);
    ctx.fillStyle = "#aaa78a";
    ctx.fillRect(w * 0.75, 0, w * 0.25, h);
    ctx.strokeStyle = "#e6ce9b";
    ctx.lineWidth = w / 60;
    ctx.beginPath();
    ctx.moveTo(w * 0.18, h * 0.3);
    ctx.lineTo(w * 0.18, h * 0.36);
    ctx.lineTo(w * 0.6, h * 0.5);
    ctx.lineTo(w * 0.88, h * 0.29);
    ctx.stroke();
    if (w > 200) {
      ctx.font = "20px serif";
      ctx.fillStyle = "#f9edca";
      ctx.fillText("风铃村", w * 0.13, h * 0.2);
      ctx.fillText("翡翠森林", w * 0.48, h * 0.7);
      ctx.fillText("风之遗迹", w * 0.76, h * 0.18);
    }
    ctx.fillStyle = "#fff6ca";
    ctx.beginPath();
    ctx.arc(
      (s.player.x / 3600) * w,
      (s.player.y / 2200) * h,
      w > 200 ? 6 : 3,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.strokeStyle = "#8d512e";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}
