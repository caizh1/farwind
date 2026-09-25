import { attack } from "../systems/combat";
import { interact } from "../systems/interactions";
import { makeTerrain } from "../systems/terrain";
import Phaser from "phaser";
import { props, roads, enemyDefs, region, type Prop } from "../../data/world";
import { items, type ItemId } from "../../data/content";
import {
  initialState,
  add,
  remove,
  count,
  reward,
  type State,
} from "../systems/state";
import { save, load } from "../systems/save";
import { Input } from "../systems/input";
import { Sound } from "../systems/audio";
import { Follower } from "../systems/follower";
import { Actor } from "../entities/actor";
import { Interface } from "../ui/interface";
type Enemy = {
  id: string;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  type: string;
  hp: number;
  cool: number;
  windup: number;
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
};
export class World extends Phaser.Scene {
  state: State = initialState();
  keys = new Input();
  soundFx = new Sound();
  ui = new Interface();
  hero!: Actor;
  cat!: Actor;
  propImages = new Map<string, Phaser.GameObjects.Image>();
  enemies: Enemy[] = [];
  active = false;
  sim = 0;
  attackUntil = 0;
  attackSerial = 0;
  cooldown = 0;
  invulnerable = 0;
  target?: Prop;
  follower = new Follower();
  water!: Phaser.GameObjects.Image;
  night!: Phaser.GameObjects.Rectangle;
  hudTimer = 0;
  loaded: State | null = null;
  failed: string[] = [];
  lastRegion = "风铃村";
  fps: number[] = [];
  motionDebug?: Phaser.GameObjects.Text;
  motionRoots?: Phaser.GameObjects.Graphics;
  constructor() {
    super("World");
  }
  preload() {
    this.ui.shell("风正在捎来故事", "<p>正在装载风铃村素材……</p>");
    const names = [
      "arch",
      "house",
      "shop",
      "tower",
      "well",
      "tree",
      "pink",
      "bush",
      "fence",
      "chest",
      "chest-open",
      "rune",
      "sign",
      "herb",
      "berry",
      "wood",
      "rock",
      "grass",
      "road",
      "water",
      "forest",
    ];
    names.forEach((k) => this.load.image(k, `/assets/${k}.png`));
    ["hero", "cat", "elder", "healer", "carpenter", "slime", "leaf"].forEach(
      (k) =>
        this.load.spritesheet(k, `/assets/${k}.png`, {
          frameWidth: 128,
          frameHeight: 128,
        }),
    );
    for (const id of ["hero", "cat"])
      this.load.spritesheet(
        `${id}-motion`,
        `/assets/animation/${id}-motion.png`,
        { frameWidth: 128, frameHeight: 128 },
      );
    this.load.on("loaderror", (file: { key: string }) =>
      this.failed.push(file.key),
    );
  }
  create() {
    if (this.failed.length) {
      this.ui.shell(
        "素材加载失败",
        `<p>缺少资源：${this.failed.join("、")}。请检查本地服务并刷新。</p>`,
      );
      return;
    }
    this.makeTerrain();
    const pond = this.textures.createCanvas("pond", 340, 220)!;
    const pc = pond.context;
    pc.beginPath();
    pc.ellipse(170, 110, 160, 95, 0, 0, Math.PI * 2);
    pc.fillStyle = "#d4cba0";
    pc.fill();
    pc.clip();
    pc.drawImage(
      this.textures.get("water").getSourceImage() as HTMLImageElement,
      0,
      0,
      340,
      220,
    );
    pc.strokeStyle = "#7b9765";
    pc.lineWidth = 12;
    pc.stroke();
    pond.refresh();
    this.water = this.add.image(1240, 890, "pond").setDepth(-10);

    props.forEach((p) => {
      const im = this.add
        .image(p.x, p.y, p.art, 0)
        .setOrigin(0.5, 1)
        .setDisplaySize(p.w, p.h)
        .setDepth(p.y);
      this.propImages.set(p.id, im);
    });
    this.hero = new Actor(this, 670, 720);
    this.cat = new Actor(this, 720, 740, true);
    this.cameras.main
      .setBounds(0, 0, 3600, 2200)
      .startFollow(this.hero.sprite, true, 0.1, 0.1, 0, 150);
    this.cameras.main.setZoom(this.scale.width / 1280);
    this.scale.on("resize", (size: Phaser.Structs.Size) => {
      this.cameras.main.setZoom(size.width / 1280);
      this.night?.setSize(size.width, size.height);
    });
    this.night = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x173c58, 0)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(10000);
    this.ui.actions = {
      start: (c) => void this.start(c).catch(() => {}),
      save: () => this.persist(),
      import: async (s) => {
        await save(s);
        this.loaded = s;
        this.ui.available = true;
        await this.start(true);
      },
      use: (id) => this.use(id),
      pause: () => this.keys.clear(),
      volume: (v) => (this.soundFx.volume = v),
      getVolume: () => this.soundFx.volume,
      title: () => void this.toTitle(),
    };
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown() && !this.ui.paused && this.active)
        this.attack();
    });
    const suspend = () => {
      this.keys.clear();
      if (this.active && !this.ui.paused) this.ui.open("pause");
    };
    window.addEventListener("blur", suspend);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) suspend();
    });
    this.events.once("shutdown", () => {
      window.removeEventListener("blur", suspend);
    });
    Object.defineProperty(window, "__farwind", {
      configurable: true,
      value: () =>
        structuredClone({
          state: this.state,
          attackSerial: this.attackSerial,
          ...(import.meta.env.DEV
            ? {
                animation: {
                  hero: this.hero.debug(),
                  cat: this.cat.debug(),
                  following: this.follower.following,
                  target: this.follower.target,
                },
              }
            : {}),
          companion: {
            x: this.cat.sprite.x,
            y: this.cat.sprite.y,
            blocked: this.blocked(this.cat.sprite.x, this.cat.sprite.y),
          },
          mode: this.ui.mode,
          region: region(this.state.player.x),
          target: this.target?.id,
          enemies: this.enemies.map((e) => ({
            id: e.id,
            x: e.x,
            y: e.y,
            hp: e.hp,
          })),
          fps: this.fps.slice(-600),
          renderer: this.game.renderer?.type,
        }),
    });
    void load()
      .then((s) => {
        this.loaded = s;
        this.ui.state = s ?? undefined;
        this.ui.available = !!s;
        this.ui.title();
      })
      .catch((e) => this.ui.title((e as Error).message));
  }
  async start(continued: boolean) {
    this.state =
      continued && this.loaded ? structuredClone(this.loaded) : initialState();
    if (this.blocked(this.state.player.x, this.state.player.y)) {
      this.state.player.x = 670;
      this.state.player.y = 720;
      this.ui.message("存档位置无法站立，已返回安全广场，其他进度保留。");
    }
    this.ui.state = this.state;
    this.active = true;
    this.sim = 0;
    this.cooldown = 0;
    this.invulnerable = 0;
    this.follower.reset(this.state.player);
    this.cat.place(this.state.player.x - 78, this.state.player.y + 18);
    if (this.blocked(this.cat.sprite.x, this.cat.sprite.y))
      this.cat.place(this.state.player.x, this.state.player.y);
    this.hero.place(this.state.player.x, this.state.player.y);
    this.cameras.main.centerOn(this.state.player.x, this.state.player.y - 150);
    this.refresh();
    this.spawnEnemies();
    this.ui.close();
    this.soundFx.start();
    if (!continued) await this.persist();
    this.ui.message("风铃村欢迎你。向北走几步，按 E 与守风人交谈。");
  }
  async persist() {
    try {
      const snapshot = structuredClone(this.state);
      await save(snapshot);
      this.loaded = snapshot;
      this.ui.available = true;
      this.ui.message("旅途已保存");
    } catch (e) {
      this.ui.message((e as Error).message);
      throw e;
    }
  }
  async toTitle() {
    try {
      await this.persist();
      this.active = false;
      this.ui.title();
    } catch {}
  }
  makeTerrain = makeTerrain;
  blocked(x: number, y: number, ignore?: string) {
    if (y >= 650 && y <= 1580 && !(y >= 1010 && y <= 1180)) {
      const t = (y - 650) / 930;
      const streamX =
        (1 - t) ** 3 * 2020 +
        3 * (1 - t) ** 2 * t * 1940 +
        3 * (1 - t) * t * t * 2100 +
        t ** 3 * 1970;
      if (Math.abs(x - streamX) < 40) return true;
    }
    if (x < 30 || x > 3570 || y < 80 || y > 2170) return true;
    if (((x - 1240) / 160) ** 2 + ((y - 890) / 98) ** 2 < 1) return true;
    return props.some(
      (p) =>
        p.id !== ignore &&
        p.solid &&
        Math.abs(x - p.x) < p.solid[0] / 2 + 12 &&
        y > p.y - p.solid[1] - 10 &&
        y < p.y + 10,
    );
  }
  clearLine(x: number, y: number, tx: number, ty: number, ignore?: string) {
    const steps = Math.ceil(Math.hypot(tx - x, ty - y) / 12);
    for (let i = 1; i <= steps; i++) {
      if (
        this.blocked(
          x + ((tx - x) * i) / steps,
          y + ((ty - y) * i) / steps,
          ignore,
        )
      )
        return false;
    }
    return true;
  }
  refresh() {
    for (const p of props) {
      const im = this.propImages.get(p.id)!;
      if (p.kind === "chest")
        im.setTexture(
          this.state.chests.includes(p.id) ? "chest-open" : "chest",
        ).setDisplaySize(p.w, p.h);
      if (p.kind === "resource")
        im.setAlpha(
          this.state.collected[p.id] !== undefined &&
            this.state.time - this.state.collected[p.id] < 180
            ? 0.3
            : 1,
        );
      if (p.kind === "stone")
        im.setTint(this.state.stones.includes(p.index!) ? 0xbfffff : 0xffffff);
      if (p.id === "waymark")
        im.setTint(this.state.shortcut ? 0xbfffff : 0xffffff);
    }
  }
  spawnEnemies() {
    this.enemies.forEach((e) => {
      e.sprite.destroy();
      e.shadow.destroy();
    });
    this.enemies = enemyDefs
      .filter((d) => !this.state.killed.includes(d.id))
      .map((d) => ({
        id: d.id,
        x: d.x,
        y: d.y,
        homeX: d.x,
        homeY: d.y,
        type: d.type,
        hp: d.type === "slime" ? 48 : 72,
        cool: 0,
        windup: 0,
        sprite: this.add
          .sprite(d.x, d.y, d.type, 0)
          .setOrigin(0.5, 1)
          .setDisplaySize(75, 75),
        shadow: this.add.ellipse(d.x, d.y, 45, 15, 0x18392d, 0.2),
      }));
  }
  use(id: ItemId) {
    if (!this.active || !["potion", "berry"].includes(id)) return;
    if (this.state.player.hp >= 100) {
      this.ui.message("生命充足，暂时不用消耗物品。");
      return;
    }
    if (remove(this.state, id, 1)) {
      this.state.player.hp = Math.min(
        100,
        this.state.player.hp + (id === "potion" ? 50 : 12),
      );
      this.soundFx.play("pick");
      this.ui.message("恢复生命");
    } else this.ui.message("行囊里没有这个物品");
  }
  interact = interact;
  float(x: number, y: number, text: string) {
    const t = this.add
      .text(x, y - 75, text, {
        fontSize: "18px",
        fontFamily: "sans-serif",
        color: "#fff6be",
        stroke: "#355443",
        strokeThickness: 3,
      })
      .setDepth(9000)
      .setOrigin(0.5);
    this.tweens.add({
      targets: t,
      y: y - 120,
      alpha: 0,
      duration: 900,
      onComplete: () => t.destroy(),
    });
  }
  attack = attack;
  update(_time: number, delta: number) {
    if (!this.hero) return;
    if (this.keys.take("escape")) {
      if (this.active) {
        if (this.ui.paused) this.ui.close();
        else this.ui.open("pause");
      }
    }
    if (this.ui.mode === "dialog" && this.keys.take("e")) this.ui.close();
    if (
      (this.ui.mode === "bag" && this.keys.take("tab")) ||
      (this.ui.mode === "map" && this.keys.take("m")) ||
      (this.ui.mode === "quest" && this.keys.take("q"))
    )
      this.ui.close();
    if (!this.active || this.ui.paused) {
      this.tweens.pauseAll();
      return;
    }
    this.tweens.resumeAll();
    for (const [k, panel] of [
      ["tab", "bag"],
      ["m", "map"],
      ["q", "quest"],
    ])
      if (this.keys.take(k)) {
        this.ui.open(panel);
        return;
      }
    const dt = Math.min(delta, 50) / 1000;
    this.sim += dt * 1000;
    this.state.time += dt * 1.5;
    if (delta < 200) this.fps.push(1000 / delta);
    if (this.fps.length > 1200) this.fps.shift();
    const p = this.state.player,
      a = this.keys.axis();
    const length = Math.hypot(a.x, a.y);
    const running = this.keys.held.has("shift") && length > 0 && p.stamina > 1;
    const speed = running ? 235 : 150;
    p.stamina = Phaser.Math.Clamp(
      p.stamina + (running ? -21 : 14) * dt,
      0,
      100,
    );
    const dx = length ? (a.x / length) * speed * dt : 0,
      dy = length ? (a.y / length) * speed * dt : 0;
    const oldX = p.x,
      oldY = p.y;
    if (!this.blocked(p.x + dx, p.y)) p.x += dx;
    if (!this.blocked(p.x, p.y + dy)) p.y += dy;
    this.hero.move(
      p.x,
      p.y,
      p.x - oldX,
      p.y - oldY,
      this.sim,
      this.sim < this.attackUntil,
      dt,
      a.x,
      a.y,
    );
    this.hero.sprite.setAlpha(
      this.sim < this.invulnerable ? 0.6 + Math.sin(this.sim / 45) * 0.3 : 1,
    );
    if (
      import.meta.env.DEV &&
      new URLSearchParams(location.search).has("animationDebug")
    ) {
      this.motionDebug ??= this.add
        .text(18, 120, "", {
          fontSize: "13px",
          color: "#fff8df",
          backgroundColor: "#263c36",
          padding: { x: 8, y: 6 },
        })
        .setScrollFactor(0)
        .setDepth(99999);
      this.motionRoots ??= this.add.graphics().setDepth(99998);
      this.motionDebug.setText(
        [this.hero, this.cat]
          .map((a) => {
            const d = a.debug();
            return `${a.cat ? "黑猫" : "旅人"} ${d.key} 帧${d.frame} 速度${d.speed.toFixed(1)} 翻转${d.flip} 根${d.root.map((n) => n.toFixed(0))} 锚64,124${d.provisional ? " 素材待补" : ""}`;
          })
          .join("\n"),
      );
      this.motionRoots.clear().lineStyle(1, 0xffdf6b);
      for (const a of [this.hero, this.cat]) {
        const x = a.sprite.x,
          y = a.sprite.y;
        this.motionRoots
          .strokeRect(x - 12, y - 10, 24, 20)
          .lineBetween(x - 5, y, x + 5, y)
          .lineBetween(x, y - 5, x, y + 5);
      }
    }
    const cat = this.cat.sprite;
    const next = this.follower.update(
      p,
      { x: cat.x, y: cat.y },
      dt,
      (a, b) => this.clearLine(a.x, a.y, b.x, b.y),
      (x, y) => this.blocked(x, y),
    );
    this.cat.move(
      next.x,
      next.y,
      next.x - cat.x,
      next.y - cat.y,
      this.sim,
      false,
      dt,
    );
    this.target = props
      .filter(
        (o) =>
          o.kind &&
          Math.hypot(o.x - p.x, o.y - p.y) < 95 &&
          this.clearLine(p.x, p.y, o.x, o.y, o.id),
      )
      .sort(
        (a, b) =>
          Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y) ||
          a.id.localeCompare(b.id),
      )[0];
    if (this.keys.take("e") && this.target) this.interact(this.target);
    if (this.keys.take("j")) this.attack();
    for (let i = 0; i < 8; i++)
      if (this.keys.take(String(i + 1)) && this.state.hotbar[i])
        this.use(this.state.hotbar[i]!);
    for (const o of props) {
      const im = this.propImages.get(o.id)!;
      if (o.art === "tree" || o.art === "pink") {
        im.setAlpha(
          p.y < o.y - 15 && p.y > o.y - o.h && Math.abs(p.x - o.x) < o.w * 0.45
            ? 0.42
            : 1,
        );
      }
      if (o.art === "herb" || o.art === "bush")
        im.setRotation(Math.sin(this.sim / 1100 + o.x) * 0.018);
    }
    for (const e of this.enemies) {
      if (e.hp <= 0 || Math.hypot(e.x - p.x, e.y - p.y) > 650) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      e.sprite.clearTint();
      if (e.windup > 0) {
        e.windup -= dt;
        e.sprite.setTint(0xffce84).setFrame(1);
        if (e.windup <= 0) {
          e.cool = this.sim + (e.type === "leaf" ? 1400 : 1100);
          if (
            d < 100 &&
            this.sim > this.invulnerable &&
            this.clearLine(e.x, e.y, p.x, p.y)
          ) {
            p.hp -= e.type === "leaf" ? 18 : 10;
            this.invulnerable = this.sim + 850;
            this.soundFx.play("hit");
            this.float(p.x, p.y, e.type === "leaf" ? "-18" : "-10");
          }
        }
      } else if (d < 80 && this.sim > e.cool && p.x > 1500) {
        e.windup = e.type === "leaf" ? 0.65 : 0.3;
      } else {
        const chase =
          d < 380 &&
          p.x > 1500 &&
          Math.hypot(e.x - e.homeX, e.y - e.homeY) < 420;
        const tx = chase ? p.x : e.homeX,
          ty = chase ? p.y : e.homeY,
          l = Math.hypot(tx - e.x, ty - e.y);
        if (l > 8) {
          const step = (e.type === "leaf" ? 95 : 60) * dt,
            nx = e.x + ((tx - e.x) / l) * step,
            ny = e.y + ((ty - e.y) / l) * step;
          if (!this.blocked(nx, ny)) {
            e.x = nx;
            e.y = ny;
          }
        }
        e.sprite.setFrame(Math.floor(this.sim / 240) % 2);
      }
      e.sprite.setPosition(e.x, e.y).setDepth(e.y);
      e.shadow.setPosition(e.x, e.y - 3).setDepth(e.y - 0.5);
    }
    if (p.hp <= 0) {
      p.hp = 100;
      p.stamina = 100;
      p.x = 670;
      p.y = 720;
      this.follower.reset(this.state.player);
      this.cat.place(592, 738);
      this.hero.place(p.x, p.y);
      this.invulnerable = this.sim + 2000;
      this.ui.message("岚爷爷把你带回广场。行囊与旅途进度都还在。");
      void this.persist().catch(() => {});
    }
    if (this.state.quest === 1 && p.x > 1510) {
      this.state.quest = this.state.crafted ? 3 : 2;
      this.ui.dialog(
        "林间异响",
        "小黑竖起耳朵，望向更深的林间。先采集药草和浆果，在行囊中制作一瓶恢复药剂。",
      );
    }
    if (
      this.state.quest === 3 &&
      this.state.killed.some((id) => id.startsWith("leaf"))
    )
      this.state.quest = 4;
    const r = region(p.x);
    if (r !== this.lastRegion) {
      this.lastRegion = r;
      this.ui.message(`抵达 · ${r}`);
      void this.persist().catch(() => {});
    }
    this.water.setScale(
      1 + Math.sin(this.sim / 1600) * 0.008,
      1 + Math.sin(this.sim / 1900) * 0.008,
    );
    const hour = (this.state.time / 60) % 24;
    this.night.setAlpha(hour > 18 || hour < 6 ? 0.22 : 0);
    this.hudTimer += dt;
    if (this.hudTimer > 0.1) {
      this.hudTimer = 0;
      this.ui.update(this.state, this.target ? `E · ${this.target.label}` : "");
      this.refresh();
    }
  }
}
