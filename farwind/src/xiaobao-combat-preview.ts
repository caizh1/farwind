import Phaser from "phaser";
import {
  XIAOBAO_SKILLS as SKILLS,
  XIAOBAO_BATTLE_CLIPS as CLIPS,
  xiaobaoBattlePose,
  type XiaobaoSkill,
  type XiaobaoBattleClip,
} from "./data/xiaobaoCombat";
import { XiaobaoView } from "./game/entities/xiaobaoView";
import { Actor } from "./game/entities/actor";
import { initialXiaobao } from "./game/systems/xiaobaoState";
import { enemyNavigation, type EnemyBody } from "./game/systems/enemy";
import { resolveReleasedDamage } from "./game/systems/damage";
import type { XiaobaoEnvironment } from "./game/systems/xiaobaoCombat";
import "./xiaobao-preview.css";
const get = <T extends HTMLElement>(id: string) =>
  document.querySelector<T>("#" + id)!;
const skill = get<HTMLSelectElement>("skill"),
  clip = get<HTMLSelectElement>("clip"),
  facing = get<HTMLSelectElement>("facing"),
  mode = get<HTMLSelectElement>("mode"),
  scrub = get<HTMLInputElement>("scrub");
for (const [key, s] of Object.entries(SKILLS)) {
  skill.append(new Option(s.name, key));
  const b = document.createElement("button");
  b.textContent = s.name;
  b.dataset.skill = key;
  get("skills").append(b);
}
for (const [key, count] of CLIPS)
  clip.append(
    new Option(
      (SKILLS as Record<string, { name: string }>)[key]?.name ??
        (
          {
            chase: "风行追赶",
            takeoff: "飞援起飞",
            cruise: "飞援巡航",
            landing: "飞援降落",
            hurt: "柔和受击",
            rest: "护风调息",
            recover: "调息起身",
          } as Record<string, string>
        )[key] +
          " · " +
          count +
          "帧",
      key,
    ),
  );
class Preview extends Phaser.Scene {
  view!: XiaobaoView;
  ink!: Phaser.GameObjects.Graphics;
  labels: Phaser.GameObjects.Text[] = [];
  env!: XiaobaoEnvironment;
  elapsed = 0;
  duration = 1600;
  paused = false;
  hits: { id: string; damage: number; at: number }[] = [];
  preload() {
    XiaobaoView.preload(this);
    this.load.image("grass", "/assets/grass.png");
  }
  create() {
    this.add.tileSprite(2100, 1100, 4200, 2200, "grass").setAlpha(0.5);
    this.view = new XiaobaoView(this);
    this.ink = this.add.graphics();
    for (let i = 0; i < 5; i++)
      this.labels.push(
        this.add
          .text(0, 0, "", {
            fontSize: "12px",
            color: "#3b4f39",
            stroke: "#fff7dc",
            strokeThickness: 3,
          })
          .setOrigin(0.5),
      );
    for (const control of [skill, clip, facing, mode])
      control.onchange = () => this.reset();
    get<HTMLButtonElement>("restart").onclick = () => this.reset();
    get<HTMLButtonElement>("pause").onclick = () => {
      this.paused = !this.paused;
      this.paint();
    };
    scrub.oninput = () => {
      const t = Number(scrub.value);
      this.reset();
      this.paused = true;
      this.advance(t);
      this.paint();
    };
    for (const button of document.querySelectorAll<HTMLButtonElement>(
      "[data-skill]",
    ))
      button.onclick = () => {
        skill.value = button.dataset.skill!;
        mode.value = "skill";
        this.reset();
      };
    Object.defineProperty(window, "__xiaobaoCombatPreview", {
      configurable: true,
      value: () => ({
        mode: mode.value,
        skill: skill.value,
        clip: clip.value,
        direction: Number(facing.value),
        elapsed: this.elapsed,
        paused: this.paused,
        hits: this.hits,
        targets: this.env.enemies.map((e) => ({
          id: e.id,
          hp: e.hp,
          x: e.x,
          y: e.y,
        })),
        runtime: this.view.controller.snapshot(),
        pose:
          mode.value === "clip"
            ? xiaobaoBattlePose(
                clip.value as XiaobaoBattleClip,
                this.elapsed / this.duration,
                Number(facing.value),
              )
            : this.view.controller.pose,
        objects: this.children.length,
      }),
    });
    this.reset();
  }
  reset() {
    const c = this.view.controller;
    c.reset();
    const state = initialXiaobao();
    state.task = "follow";
    state.wait = { ...state, region: "village" };
    c.bind(state, true);
    c.facing = Number(facing.value);
    this.hits = [];
    this.elapsed = 0;
    const key = skill.value as XiaobaoSkill,
      s = SKILLS[key],
      d = Number(facing.value),
      v =
        d === 0
          ? { x: 0, y: 1 }
          : d === 1
            ? { x: 0, y: -1 }
            : d === 2
              ? { x: -1, y: 0 }
              : { x: 1, y: 0 };
    const distance = ["palm", "triple"].includes(key)
      ? 78
      : key === "rescue"
        ? 130
        : 200;
    const count =
      key === "chain"
        ? 5
        : ["rock", "fire", "unity", "blade", "star"].includes(key)
          ? 3
          : 1;
    const enemies: EnemyBody[] = Array.from({ length: count }, (_, i) => {
      const spread = ["rock", "fire", "unity"].includes(key) ? (i - 1) * 48 : 0,
        along =
          distance +
          i *
            (key === "chain" ? 80 : key === "star" || key === "blade" ? 40 : 0),
        x = c.x + v.x * along - v.y * spread,
        y = c.y + v.y * along + v.x * spread;
      return {
        id: "演武木桩" + (i + 1),
        type: "slime",
        x,
        y,
        hp: 600,
        homeX: x,
        homeY: y,
        cool: 0,
        windup: 0,
        staggerUntil: 0,
        nav: enemyNavigation(),
        ai: "演武样本",
        disabled: false,
        recovered: false,
      };
    });
    const point = { x: 1300, y: 1080 };
    this.env = {
      now: 0,
      minute: 480,
      player: { x: c.x, y: c.y, hp: 100, outside: true, region: "village" },
      enemies,
      allies: [
        {
          id: "player",
          ...(key === "flight" ? point : { x: c.x + 35, y: c.y + 20 }),
          hp: 100,
          maxHP: 100,
          role: "player",
          threatAt: null,
        },
      ],
      recent: null,
      fronts: () =>
        key === "flight"
          ? [
              {
                key: "演武危急样本",
                gate: "east-gate",
                major: true,
                priority: 3,
                point,
                enemies: [],
                injured: false,
              },
            ]
          : [],
      blocked: () => false,
      clear: () => true,
      melee: () => true,
      takeoffClear: () => true,
      message: () => {},
      move: () => 0,
      hit: (e, event, source) => {
        const result = resolveReleasedDamage(event, source, {
          id: e.id,
          hp: e.hp,
          faction: "hostile",
          armor: 0,
        });
        if (result.applied) {
          e.hp = result.hp;
          this.hits.push({ id: e.id, damage: result.damage, at: c.data.clock });
        }
        return result;
      },
    };
    if (mode.value === "skill") {
      if (key === "flight") c.beginFlight(this.env.fronts()[0], this.env);
      else
        c.start(
          key,
          key === "guard" ? null : enemies[0],
          key === "guard" ? { x: c.x, y: c.y } : undefined,
        );
    }
    this.duration =
      mode.value === "clip"
        ? ["rest", "cruise", "chase"].includes(clip.value)
          ? 1200
          : 1000
        : key === "flight"
          ? 1600
          : Math.max(
              s.recovery,
              s.times.at(-1)! + 100,
              ["star", "blade"].includes(key) ? 1800 : 0,
            );
    scrub.max = String(this.duration);
    this.paint();
  }
  advance(ms: number) {
    const c = this.view.controller;
    if (mode.value === "skill") {
      this.env.now += ms;
      c.tick(ms, this.env, { queries: 2 });
    }
    this.elapsed += ms;
  }
  paint() {
    const c = this.view.controller;
    this.view.render(true);
    if (mode.value === "clip") {
      const key = clip.value as XiaobaoBattleClip,
        p = Math.min(1, this.elapsed / this.duration),
        pose = xiaobaoBattlePose(key, p, Number(facing.value));
      this.view.sprite.setTexture(pose.texture, pose.frame);
      Actor.mirror(this.view.sprite, Number(facing.value) === 2);
      const lift =
        key === "takeoff"
          ? p * 88
          : key === "cruise"
            ? 88
            : key === "landing"
              ? (1 - p) * 88
              : 0;
      this.view.sprite.setPosition(c.x, c.y - lift);
      this.view.shadow.setScale(1 - lift / 180);
    }
    this.view.label.setVisible(false);
    this.cameras.main.centerOn(c.x + 100, c.y - 65);
    const g = this.ink.clear();
    g.lineStyle(1, 0x5c8465, 0.6)
      .lineBetween(c.x - 16, c.y, c.x + 16, c.y)
      .lineBetween(c.x, c.y - 8, c.x, c.y + 8);
    for (const [i, e] of this.env.enemies.entries()) {
      if (mode.value === "skill" && skill.value !== "flight") {
        g.fillStyle(e.hp ? 0x8c9461 : 0xc3b69b, 0.95).fillRoundedRect(
          e.x - 12,
          e.y - 40,
          24,
          40,
          6,
        );
        g.fillStyle(0xe9dca7, 0.9).fillEllipse(e.x, e.y - 38, 30, 14);
        g.lineStyle(3, 0x50653e)
          .lineBetween(e.x - 10, e.y - 48, e.x + 10, e.y - 48)
          .lineStyle(3, 0xb5db76)
          .lineBetween(
            e.x - 10,
            e.y - 48,
            e.x - 10 + (20 * e.hp) / 600,
            e.y - 48,
          );
        this.labels[i]
          .setText("木桩 " + Math.ceil(e.hp) + "/600")
          .setPosition(e.x, e.y + 10)
          .setVisible(true);
      } else this.labels[i].setVisible(false);
    }
    for (let i = this.env.enemies.length; i < this.labels.length; i++)
      this.labels[i].setVisible(false);
    const own = this.env.allies[0];
    if (c.data.shields.some((s) => s.id === "player"))
      g.lineStyle(2, 0xbdeadc, 0.8).strokeEllipse(own.x, own.y - 25, 44, 48);
    get("info").textContent =
      Math.round(Math.min(this.elapsed, this.duration)) +
      "／" +
      this.duration +
      "毫秒 · " +
      (mode.value === "skill" ? c.status : "独立主体动作");
    scrub.value = String(this.elapsed);
    get("pause").textContent = this.paused ? "继续播放" : "暂停";
    get("result").textContent =
      mode.value === "skill"
        ? SKILLS[skill.value as XiaobaoSkill].name +
          " · 累计正式伤害 " +
          this.hits.reduce((n, h) => n + h.damage, 0) +
          " · 命中 " +
          this.hits.length +
          " · 真气 " +
          Math.floor(c.data.qi) +
          "/100 · 飞援到场 " +
          (skill.value === "flight" ? (c.data.flight ? "途中" : "已到场") : "—")
        : "逐帧展示不结算伤害。";
    for (const b of document.querySelectorAll<HTMLButtonElement>(
      "[data-skill]",
    ))
      b.setAttribute("aria-pressed", String(b.dataset.skill === skill.value));
  }
  update(_time: number, delta: number) {
    if (this.paused || document.hidden) return;
    this.advance(Math.min(delta, 50));
    if (this.elapsed > this.duration + 900) this.reset();
    this.paint();
  }
}
new Phaser.Game({
  type: Phaser.WEBGL,
  parent: "preview",
  width: 980,
  height: 412,
  scene: [Preview],
  audio: { noAudio: true },
  backgroundColor: "#ebe7d6",
  render: { antialias: true },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
});
