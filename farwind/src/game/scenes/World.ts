import { WORLD, propBounds, FOOT } from "../../data/world";
import { regionAt, portalAnchor, VILLAGE_PORTALS } from "../../data/village";
import {
  motionBlocked,
  clearMotionLine,
  clearMeleeLine,
  meleeBlocker,
} from "../systems/obstacles";
import {
  updateEnemy,
  validateEnemyPosition,
  repairEnemyPoint,
  enemyNavigation,
  nearestStanding,
  NAV,
  staggerEnemy,
  type EnemyBody,
} from "../systems/enemy";
import { FIELD_TARGETS, TRAINING, TrainingDummy } from "../systems/training";
import { TrainingDummyView } from "../entities/trainingDummy";
import type { Attack } from "../systems/combat";
import { CombatTimeline } from "../systems/timeline";
import { adjudicateContact, orderedContacts } from "../systems/contact";
import type { EnemyContact } from "../systems/enemyAttack";
import { ParryTraining, type PracticeMode } from "../systems/parryTraining";
import { WeaponTrail } from "../systems/weaponTrail";
import { Sprint } from "../systems/sprint";
import { resetSessionTimers } from "../systems/session";
import {
  CombatController,
  COMBAT,
  STRIKES,
  PARRY,
  attackConfig,
  enemyTint,
  facingVector,
  sweepMove,
} from "../systems/combat";
import { interact } from "../systems/interactions";
import { makeTerrain } from "../systems/terrain";
import Phaser from "phaser";
import { props, roads, enemyDefs, region, type Prop } from "../../data/world";
import { items, type ItemId } from "../../data/content";
import {
  COMBAT_ACTION_ART,
  combatVisual,
  weaponSample,
  settleVisual,
  parryVisual,
  parryWeapon,
} from "../../data/animation";
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
type Enemy = EnemyBody & {
  kind: "enemy";
  flashUntil: number;
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
};
type CombatTarget = Enemy | TrainingDummy;
export class World extends Phaser.Scene {
  state: State = initialState();
  keys = new Input();
  soundFx = new Sound();
  weaponTrail = new WeaponTrail();
  ui = new Interface();
  hero!: Actor;
  cat!: Actor;
  propImages = new Map<string, Phaser.GameObjects.Image>();
  enemies: Enemy[] = [];
  training = new TrainingDummy();
  trainingView!: TrainingDummyView;
  fieldTargets = FIELD_TARGETS.map((t) => new TrainingDummy(t.id, t.x, t.y));
  fieldViews: TrainingDummyView[] = [];
  active = false;
  sim = 0;
  attackUntil = 0;
  attackSerial = 0;
  cooldown = 0;
  invulnerable = 0;
  respawnInvulnerable = 0;
  combat = new CombatController();
  timeline = new CombatTimeline();
  practice = new ParryTraining();
  battleAxis = {x:0,y:0};
  runIntent = false;
  contactHistory: {at:number;id:string;result:string;parryAge:number|null;stamina:number;hp:number}[] = [];
  parryEffects: {at:number;x:number;y:number;perfect:boolean}[]=[];
  parryInk?: Phaser.GameObjects.Graphics;
  warningInk?: Phaser.GameObjects.Graphics;
  pointerAttack = false;
  gatherUntil = 0;
  target?: Prop;
  follower = new Follower();
  sprint = new Sprint();
  night!: Phaser.GameObjects.Rectangle;
  hudTimer = 0;
  loaded: State | null = null;
  failed: string[] = [];
  lastRegion = "风铃村";
  fps: number[] = [];
  obstacleDebug?: Phaser.GameObjects.Text;
  obstacleRoots?: Phaser.GameObjects.Graphics;
  motionDebug?: Phaser.GameObjects.Text;
  motionRoots?: Phaser.GameObjects.Graphics;
  dropImages = new Map<string, Phaser.GameObjects.Text>();
  slash?: Phaser.GameObjects.Graphics;
  slashBack?: Phaser.GameObjects.Graphics;
  windTrail?: Phaser.GameObjects.Graphics;
  constructor() {
    super("World");
  }
  preload() {
    for (const [key, file] of [
      ["carpenter-workbench", "carpenter-workbench"],
      ["fountain", "plaza-fountain"],
      ["pond-water", "pond-water"],
    ]) this.load.image(key, `/assets/village-polish/${file}.png`);
    this.load.image(
      "vertical-fence",
      "/assets/village-defense/vertical-fence-candidate.png",
    );
    for (const key of ["village-gate", "bridge", "herb-bed", "packed-earth"])
      this.load.image(key, `/assets/level-rework/${key}-candidate.png`);
    this.load.image("training-base", "/assets/training-base.png");
    this.load.image("training-body", "/assets/training-body.png");
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
        `/assets/animation/round-three/${id}-motion.png`,
        { frameWidth: 128, frameHeight: 128 },
      );
    this.load.spritesheet(
      "hero-combat-action",
      "/assets/animation/hero-combat-action.png",
      {
        frameWidth: COMBAT_ACTION_ART.frameSize,
        frameHeight: COMBAT_ACTION_ART.frameSize,
      },
    );
    this.load.spritesheet(
      "hero-combat-back",
      "/assets/animation/hero-combat-back.png",
      { frameWidth: 160, frameHeight: 160 },
    );
    this.load.spritesheet(
      "hero-combat-side",
      "/assets/animation/hero-combat-side.png",
      { frameWidth: 160, frameHeight: 160 },
    );
    this.load.spritesheet("hero-parry","/assets/animation/hero-parry.png",{frameWidth:160,frameHeight:160});
    this.load.image(
      "hero-carry-sword",
      "/assets/animation/hero-carry-sword.png",
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
    props.forEach((p) => {
      const im = this.add
        .image(p.x, p.y, p.art, p.frame ?? 0)
        .setOrigin(0.5, 1)
        .setDisplaySize(p.w, p.h)
        .setDepth(p.depth ?? p.y);
      this.propImages.set(p.id, im);
    });
    // 仅池内两个落水点扩散；石质主体不参与动画，前池沿之外不绘制水效。
    for (const [x, y, delay] of [[658, 848, 0], [704, 846, 850]]) {
      const ripple = this.add.ellipse(x, y, 12, 4)
        .setFillStyle(0, 0).setStrokeStyle(0.6, 0xcbe9dc, 0.28)
        .setDepth(890.01).setAlpha(0);
      this.tweens.add({targets:ripple,alpha:0.35,scaleX:1.3,scaleY:1.3,
        duration:1600,delay,hold:100,yoyo:true,repeat:-1});
    }
    this.trainingView = new TrainingDummyView(this, this.training);
    this.fieldViews = this.fieldTargets.map(
      (t) => new TrainingDummyView(this, t),
    );
    this.hero = new Actor(this, 670, 720);
    this.cat = new Actor(this, 720, 740, true);
    this.cameras.main
      .setBounds(0, 0, WORLD.width, WORLD.height)
      .startFollow(this.hero.sprite, true, 0.1, 0.1, 0, 150);
    this.cameras.main.setZoom(this.scale.width / 1280);
    const resize = (size: Phaser.Structs.Size) => {
      this.cameras.main.setZoom(size.width / 1280);
      this.night?.setSize(size.width, size.height);
    };
    this.scale.on("resize", resize);
    this.events.once("shutdown", () => this.scale.off("resize", resize));
    this.night = this.add
      .rectangle(0, 0, this.scale.width, this.scale.height, 0x173c58, 0)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(10000);
    this.ui.actions = {
      start: (c) => void this.start(c).catch(() => {}),
      save: () => this.persist(true),
      import: async (s) => {
        await save(s);
        this.loaded = s;
        this.ui.available = true;
        await this.start(true);
      },
      use: (id) => this.use(id),
      pause: () => {
        this.keys.clear();
        this.combat.clearInputs();
        this.battleAxis={x:0,y:0};
        this.runIntent=false;
        this.timeline.reset(performance.now());
      },
      practice: (mode) => this.selectPractice(mode),
      volume: (v) => (this.soundFx.volume = v),
      getVolume: () => this.soundFx.volume,
      title: () => void this.toTitle(),
    };
    this.keys.enabled=()=>this.active&&!this.ui.paused;
    this.keys.uiKey=(e)=>this.ui.handleKey(e);
    this.keys.focusCanvas=()=>this.ui.focusGame();
    const unbindCanvas=this.keys.bindCanvas(this.game.canvas);
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
      unbindCanvas();
    });
    Object.defineProperty(window, "__farwind", {
      configurable: true,
      value: () =>
        structuredClone({
          state: this.state,
          attackSerial: this.attackSerial,
          ...(import.meta.env.DEV
            ? {
                layoutLabels: this.data.get("layoutLabelCount") ?? 0,
                obstacles: props
                  .filter((p) => p.solid)
                  .map((p) => ({
                    id: p.id,
                    raw: propBounds(p),
                    motion: propBounds(p, true),
                  })),
                training: this.training.snapshot(this.sim),
                parryTraining: this.practice.snapshot(),
                contacts: this.contactHistory,
                fieldTraining: this.fieldTargets.map((t) =>
                  t.snapshot(this.sim),
                ),
                trainingTargets: this.combatTargets().filter(
                  (t) => t.kind === "trainingDummy",
                ).length,
                session: {
                  sim: this.sim,
                  attackUntil: this.attackUntil,
                  cooldown: this.cooldown,
                  invulnerable: this.invulnerable,
                  exhausted: this.sprint.exhausted,
                  combat: {
                    ...this.combat.diagnostic(this.sim),
                    trailSamples: this.weaponTrail.samples.length,
                    invulnerableSources: [
                      ...(this.sim < this.invulnerable ? ["受击保护"] : []),
                      ...(this.sim < this.respawnInvulnerable
                        ? ["复活保护"]
                        : []),
                      ...(this.combat.invulnerable(this.sim) ? ["风步"] : []),
                    ],
                  },
                },
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
          region: region(this.state.player.x, this.state.player.y),
          target: this.target?.id,
          enemies: this.enemies.map((e) => ({
            id: e.id,
            x: e.x,
            y: e.y,
            hp: e.hp,
            ...(import.meta.env.DEV
              ? {
                  flashRemaining: Math.max(0, e.flashUntil - this.sim),
                  windup: e.windup,
                  attack: e.attack ?? null,
                  staggerRemaining: Math.max(0, e.staggerUntil - this.sim),
                  staggerUntil:e.staggerUntil,
                  home: { x: e.homeX, y: e.homeY },
                  footprint: {
                    left: e.x - FOOT.halfWidth,
                    right: e.x + FOOT.halfWidth,
                    top: e.y - FOOT.halfHeight,
                    bottom: e.y + FOOT.halfHeight,
                  },
                  ai: e.ai,
                  attackRejected: e.rejection ?? null,
                  meleeBlocker: meleeBlocker(this.state.player, e) ?? null,
                  waypoint: e.nav.path[0] ?? null,
                  path: e.nav.path,
                  queries: e.nav.queries,
                  visited: e.nav.visited,
                  recovered: e.recovered,
                  disabled: e.disabled,
                }
              : {}),
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
      const savedRegion = regionAt(this.state.player).id;
      const safe = nearestStanding(
        this.state.player,
        [
          { x: 670, y: 720 },
          ...VILLAGE_PORTALS.filter((p) => p.open).flatMap((p) => [
            portalAnchor(p, false),
            portalAnchor(p, true),
          ]),
        ],
        (p) => regionAt(p).id === savedRegion,
      );
      this.state.player.x = safe?.x ?? 670;
      this.state.player.y = safe?.y ?? 720;
      this.ui.message(
        safe
          ? "存档站位被新村界占用，已移到同一区域可走位置，其他进度保留。"
          : "存档位置无法站立，已返回安全广场，其他进度保留。",
      );
    }
    this.ui.state = this.state;
    this.active = true;
    resetSessionTimers(this);
    this.combat.reset(this.state.dashCooldownRemaining);
    this.practice.reset();
    this.contactHistory=[];
    this.parryEffects=[];
    this.timeline.reset(performance.now());
    this.battleAxis={x:0,y:0};
    this.runIntent=false;
    this.fieldTargets.forEach((t) => t.reset());
    this.fieldViews.forEach((v) => v.reset());
    this.training.reset();
    this.trainingView.reset();
    this.pointerAttack = false;
    this.respawnInvulnerable = 0;
    this.gatherUntil = 0;
    this.keys.clear();
    this.sprint.reset(this.state.player.stamina);
    this.hero.sprite.setAlpha(1);
    this.follower.reset(this.state.player);
    this.cat.place(this.state.player.x - 78, this.state.player.y + 18);
    if (this.blocked(this.cat.sprite.x, this.cat.sprite.y))
      this.cat.place(this.state.player.x, this.state.player.y);
    this.hero.place(this.state.player.x, this.state.player.y);
    this.cameras.main.centerOn(this.state.player.x, this.state.player.y - 150);
    this.refresh();
    this.spawnEnemies();
    this.syncDrops();
    this.ui.close(true);
    this.ui.intro();
    this.soundFx.start();
    if (!continued) await this.persist();
    this.ui.message("风铃村欢迎你。向北走几步，按 E 与守风人交谈。");
  }
  async persist(notify = false) {
    try {
      this.state.dashCooldownRemaining = Math.max(
        0,
        this.combat.dashCooldown - this.sim,
      );
      const snapshot = structuredClone(this.state);
      await save(snapshot);
      this.loaded = snapshot;
      this.ui.available = true;
      if (notify) this.ui.message("旅途已保存");
    } catch (e) {
      this.ui.message((e as Error).message);
      throw e;
    }
  }
  async toTitle() {
    try {
      await this.persist(true);
      this.active = false;
      this.combat.reset();
      this.practice.reset();
      this.keys.clear();
      this.parryEffects=[];
      this.parryInk?.clear();
      this.warningInk?.clear();
      this.fieldTargets.forEach((t) => t.reset());
      this.fieldViews.forEach((v) => v.reset());
      this.training.reset();
      this.trainingView.reset();
      this.pointerAttack = false;
      this.attackUntil = 0;
      this.slash?.clear();
      this.slashBack?.clear();
      this.ui.title();
    } catch {}
  }
  makeTerrain = makeTerrain;
  blocked(x: number, y: number, ignore?: string) {
    return motionBlocked(x, y, ignore);
  }

  // 身体通路：黑猫、交互和领取掉落沿用脚底扩张范围。
  clearLine(x: number, y: number, tx: number, ty: number, ignore?: string) {
    return clearMotionLine({ x, y }, { x: tx, y: ty }, ignore);
  }
  // 双方近战独立查询原实体，只豁免明确训练目标自身底座。
  meleeLine(x: number, y: number, tx: number, ty: number, targetId?: string) {
    return clearMeleeLine({ x, y }, { x: tx, y: ty }, targetId);
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
        kind: "enemy" as const,
        id: d.id,
        x: d.x,
        y: d.y,
        homeX: d.x,
        homeY: d.y,
        type: d.type,
        hp: d.type === "slime" ? 48 : 72,
        cool: 0,
        windup: 0,
        flashUntil: 0,
        staggerUntil: 0,
        nav: enemyNavigation(),
        ai: "家园",
        disabled: false,
        recovered: false,
        sprite: this.add
          .sprite(d.x, d.y, d.type, 0)
          .setOrigin(0.5, 1)
          .setDisplaySize(75, 75),
        shadow: this.add.ellipse(d.x, d.y, 45, 15, 0x18392d, 0.2),
      }));
    this.enemies.forEach((e) => {
      validateEnemyPosition(e);
      e.sprite.setPosition(e.x, e.y).setVisible(!e.disabled);
      e.shadow.setPosition(e.x, e.y - 3).setVisible(!e.disabled);
    });
    // 已死亡敌人的异常待领取掉落独立修复，不创建或复活敌人。
    for (const drop of this.state.pendingDrops)
      if (this.blocked(drop.x, drop.y)) {
        const definition = enemyDefs.find((d) => d.id === drop.enemyId);
        const point = repairEnemyPoint(drop, definition ?? drop);
        if (point) Object.assign(drop, point);
      }
  }
  syncDrops() {
    for (const [id, image] of this.dropImages)
      if (!this.state.pendingDrops.some((d) => d.enemyId === id)) {
        image.destroy();
        this.dropImages.delete(id);
      }
    for (const d of this.state.pendingDrops)
      if (!this.dropImages.has(d.enemyId))
        this.dropImages.set(
          d.enemyId,
          this.add
            .text(
              d.x,
              d.y - 32,
              d.item === "crystal" ? "✦ 风之结晶 · E" : "● 浆果 · E",
              {
                fontSize: "16px",
                color: "#fff2bf",
                backgroundColor: "#294b3a",
                padding: { x: 5, y: 3 },
              },
            )
            .setOrigin(0.5)
            .setDepth(d.y + 1),
        );
    for (const d of this.state.pendingDrops)
      this.dropImages
        .get(d.enemyId)
        ?.setPosition(d.x, d.y - 32)
        .setDepth(d.y + 1);
  }
  claimDrop() {
    const p = this.state.player;
    const d = this.state.pendingDrops.find(
      (v) =>
        Math.hypot(v.x - p.x, v.y - p.y) < 95 &&
        this.clearLine(p.x, p.y, v.x, v.y),
    );
    if (!d) return false;
    if (!add(this.state, d.item, 1)) {
      this.ui.message("行囊已满，请整理后再领取。");
      return true;
    }
    this.state.pendingDrops = this.state.pendingDrops.filter(
      (v) => v.enemyId !== d.enemyId,
    );
    this.syncDrops();
    this.soundFx.play("pick");
    this.ui.message(d.item === "crystal" ? "领取风之结晶 ×1" : "领取浆果 ×1");
    void this.persist().catch(() => {});
    return true;
  }
  drawSlash() {
    this.slash ??= this.add.graphics();
    this.slash.clear();
    this.slashBack ??= this.add.graphics();
    this.slashBack.clear();
    this.slashBack.setDepth(this.state.player.y - 0.1);
    this.weaponTrail.update(
      this.sim,
      this.combat.attack,
      this.state.player,
      this.combat.epoch,
    );
    this.slash.setDepth(this.state.player.y + 1);
    for (const { a, b, alpha } of this.weaponTrail.segments(this.sim)) {
      const ink = b.facing === 1 ? this.slashBack : this.slash;
      ink.fillStyle(b.stage === 3 ? 0xffdfa3 : 0xdaf9ed, alpha);
      ink.beginPath();
      ink.moveTo(a.inner.x, a.inner.y);
      ink.lineTo(a.tip.x, a.tip.y);
      ink.lineTo(b.tip.x, b.tip.y);
      ink.lineTo(b.inner.x, b.inner.y);
      ink.closePath();
      ink.fillPath();
      ink.lineStyle(b.stage === 3 ? 2.4 : 1.6, 0xfff8dc, alpha);
      ink.lineBetween(a.tip.x, a.tip.y, b.tip.x, b.tip.y);
    }
  }

  drawDashTrail() {
    this.windTrail ??= this.add.graphics();
    this.windTrail.clear();
    if (this.sim >= this.combat.dashUntil) return;
    const p = this.state.player,
      x = this.combat.dashX,
      y = this.combat.dashY;
    this.windTrail.setDepth(p.y - 0.2);
    this.windTrail.lineStyle(2, 0xbdeee5, 0.7);
    for (const offset of [18, 29])
      this.windTrail.lineBetween(
        p.x - x * offset - y * 7,
        p.y - y * offset + x * 7 - 25,
        p.x - x * (offset + 15) - y * 7,
        p.y - y * (offset + 15) + x * 7 - 25,
      );
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
  combatTargets(): CombatTarget[] {
    return [...this.enemies, this.training, ...this.fieldTargets];
  }
  hitFeedback(stage: number, material: "enemy" | "straw") {
    this.combat.stopOnHit(stage);
    this.soundFx.play(
      material === "straw"
        ? stage === 3
          ? "straw-heavy"
          : "straw"
        : stage === 3
          ? "finish"
          : "hit",
    );
  }
  strikeTarget(target: CombatTarget, stage: number, attack: Attack) {
    if (target.kind === "enemy") {
      this.strikeEnemy(target, stage,attack);
      return;
    }
    target.sync(this.combat.epoch);
    if (target.hit(attack, this.sim)) {
      this.hitFeedback(stage, "straw");
      const view =
        target === this.training
          ? this.trainingView
          : this.fieldViews[this.fieldTargets.indexOf(target)];
      view.hit(this.sim, attackConfig(attack).damage);
    }
  }
  strikeEnemy(e: Enemy, stage: number,attack:Attack) {
    if (e.hp <= 0) return;
    const move = attackConfig(attack);
    e.hp = Math.max(0, e.hp - move.damage);
    this.hitFeedback(stage, "enemy");
    e.flashUntil = this.sim + move.flash;
    staggerEnemy(e,this.sim,move.stagger);
    this.float(e.x, e.y, String(move.damage));
    const contact = Math.max(
      1,
      Math.hypot(this.state.player.x - e.x, this.state.player.y - e.y),
    );
    const spark = this.add
      .circle(
        e.x + ((this.state.player.x - e.x) / contact) * 12,
        e.y - 28 + ((this.state.player.y - e.y) / contact) * 6,
        stage === 3 ? 9 : 5,
        0xffefb5,
        0.88,
      )
      .setDepth(e.y + 2);
    this.tweens.add({
      targets: spark,
      scale: 1.6,
      alpha: 0,
      duration: stage === 3 ? 120 : 90,
      onComplete: () => spark.destroy(),
    });
    const [vx, vy] = facingVector(attack.facing);
    sweepMove(
      e,
      vx * move.knock,
      vy * move.knock,
      (x, y) => this.blocked(x, y),
      clearMotionLine,
    );
    e.nav.path = [];
    e.nav.failed = false;
    if (stage === 3 && e.windup > 0) {
      e.windup = 0;
      if(e.attack)e.attack.cancelled=true;
      e.cool = this.sim + 420;
    }
    if (e.hp > 0) return;
    e.windup = 0;
    if(e.attack)e.attack.cancelled=true;
    e.sprite.setVisible(false);
    e.shadow.setVisible(false);
    this.state.killed.push(e.id);
    if (e.type === "leaf" && this.state.quest === 3) this.state.quest = 4;
    const item = e.type === "leaf" ? "crystal" : "berry";
    if (add(this.state, item, 1)) {
      this.float(e.x, e.y - 30, item === "crystal" ? "风之结晶 +1" : "浆果 +1");
      this.soundFx.play("pick");
    } else {
      this.state.pendingDrops.push({
        enemyId: e.id,
        item,
        x: e.homeX,
        y: e.homeY,
      });
      this.syncDrops();
      this.ui.message("背包已满：掉落留在敌人原位置，整理行囊后按 E 领取。");
    }
    void this.persist().catch(() => {});
  }
  battleFacing() {
    const a=this.battleAxis;
    return Math.hypot(a.x,a.y)
      ? Math.abs(a.x)>Math.abs(a.y)?a.x<0?2:3:a.y<0?1:0
      : this.combat.effectiveFacing(this.sim,this.hero.direction);
  }
  tickAttack(prev:number,now:number) {
    this.combat.update(prev,now,this.battleFacing(),this.state.player,this.combatTargets(),
      (x,y)=>this.blocked(x,y),(x,y,tx,ty,id)=>this.meleeLine(x,y,tx,ty,id),
      (target,stage,attack)=>this.strikeTarget(target,stage,attack),
      (_,attack)=>{this.training.sync(this.combat.epoch);this.training.begin(attack);},
      stage=>this.soundFx.play(stage===3?"attack-heavy":"attack"),clearMotionLine);
  }
  advanceBattle(prev:number,now:number,contacts:EnemyContact[],budget:{queries:number}) {
    this.sim=now;
    const p=this.state.player,a=this.battleAxis,dt=(now-prev)/1000,length=Math.hypot(a.x,a.y);
    this.state.time+=dt*1.5;
    const guard=!!this.combat.parry&&prev<this.combat.parry.actionUntil;
    const dash=prev<this.combat.dashUntil;
    const busy=!!this.combat.attack||guard||dash||this.combat.pending;
    const movement=this.sprint.update(p.stamina,this.runIntent&&length>0&&!busy,dash?0:dt,prev>=this.combat.regenUntil);
    p.stamina=movement.stamina;
    const speed=guard?PARRY.speed:busy?this.combat.attack?55:0:movement.speed;
    if(length)sweepMove(p,a.x/length*speed*dt,a.y/length*speed*dt,(x,y)=>this.blocked(x,y),clearMotionLine);
    this.tickAttack(prev,now);
    for(const e of [...this.enemies].sort((a,b)=>a.id.localeCompare(b.id))) {
      const event=updateEnemy(e,p,now,now-prev,budget);
      if(event)contacts.push(event);
    }
    const training=this.practice.update(now,p,this.combat);
    if(training)contacts.push(training);
  }
  resolveBattle(now:number,contacts:EnemyContact[],budget:{queries:number}) {
    this.sim=now;
    const p=this.state.player;
    for(const action of this.combat.flushActions(now,p)) {
      if(action==="dash")this.sprint.reset(p.stamina);
      else {this.sprint.update(p.stamina,false,0);this.practice.started(now);}
      this.soundFx.play(action==="parry"?"guard":"dash");
    }
    this.tickAttack(now,now);
    for(const e of [...this.enemies].sort((a,b)=>a.id.localeCompare(b.id))) {
      const event=updateEnemy(e,p,now,0,budget);
      if(event)contacts.push(event);
    }
    const training=this.practice.update(now,p,this.combat);
    if(training)contacts.push(training);
    for(const contact of orderedContacts(contacts.splice(0))) {
      const e=this.enemies.find(e=>e.id===contact.attack.attackerId);
      const valid=contact.training?this.practice.mode!=="off":!!e&&e.hp>0&&!e.disabled&&e.attack?.attackId===contact.attack.attackId&&Math.hypot(p.x-e.homeX,p.y-e.homeY)<=520&&regionAt(p).id!=="village";
      const result=adjudicateContact(contact,this.combat,p,{valid,immune:now<this.invulnerable||now<this.respawnInvulnerable,clear:(a,b,id)=>clearMeleeLine(a,b,id)});
      if(contact.training)this.practice.observe(contact,result,this.combat,p);
      if(result==="normal"||result==="perfect") {
        if(e) {
          e.windup=0;
          staggerEnemy(e,now,PARRY[result].stagger);
          const [x,y]=facingVector(this.combat.parry!.facing);
          sweepMove(e,x*PARRY[result].knock,y*PARRY[result].knock,(x,y)=>this.blocked(x,y),clearMotionLine);
          e.nav.path=[];
        }
        const w=parryWeapon(this.combat.parry!.facing,1),dx=w.tip.x-w.grip.x,dy=w.tip.y-w.grip.y;
        const u=Math.max(0.25,Math.min(0.85,((contact.origin.x-p.x-w.grip.x)*dx+(contact.origin.y-p.y-28-w.grip.y)*dy)/(dx*dx+dy*dy)));
        this.parryEffects.push({at:now,x:p.x+w.grip.x+dx*u,y:p.y+w.grip.y+dy*u,perfect:result==="perfect"});
        this.sprint.update(p.stamina,false,0);
        this.soundFx.play(result==="perfect"?"parry-perfect":"parry");
        if(!contact.training)this.ui.message(result==="perfect"?"精准弹反 · J 反击":"弹反成功 · J 反击");
      } else if(result==="afterguard") {
        if(e)e.windup=0;
      } else if(result==="hurt"&&!contact.training) {
        p.hp-=contact.attack.damage;
        this.invulnerable=now+850;
        this.combat.hurt();
        this.soundFx.play("hit");
        this.float(p.x,p.y,`-${contact.attack.damage}`);
      }
      this.contactHistory.push({at:contact.at,id:contact.attack.attackId,result,parryAge:this.combat.lastParry?contact.at-this.combat.lastParry.start:null,stamina:p.stamina,hp:p.hp});
      if(this.contactHistory.length>80)this.contactHistory.shift();
    }
  }
  selectPractice(mode:PracticeMode) {
    const target=[this.training,...this.fieldTargets].sort((a,b)=>Math.hypot(a.x-this.state.player.x,a.y-this.state.player.y)-Math.hypot(b.x-this.state.player.x,b.y-this.state.player.y))[0];
    if(Math.hypot(target.x-this.state.player.x,target.y-this.state.player.y)>TRAINING.near){this.ui.message("请先靠近练习木桩");return;}
    this.combat.hurt();
    this.practice.select(mode,target,this.sim);
  }
  drawParry() {
    this.parryInk??=this.add.graphics();
    const ink=this.parryInk.clear().setDepth(this.state.player.y+2);
    this.parryEffects=this.parryEffects.filter(e=>this.sim-e.at<100);
    for(const e of this.parryEffects) {
      const u=(this.sim-e.at)/100,r=4+u*5,n=e.perfect?6:4;
      ink.lineStyle(e.perfect?2:1.5,e.perfect?0xffedac:0xb9f2e5,1-u);
      for(let i=0;i<n;i++) {
        const a=i*Math.PI*2/n;
        ink.lineBetween(e.x+Math.cos(a)*2,e.y+Math.sin(a)*2,e.x+Math.cos(a)*r,e.y+Math.sin(a)*r);
      }
    }
  }
  drawWarnings() {
    this.warningInk??=this.add.graphics();
    const ink=this.warningInk.clear().setDepth(8998);
    const sources=[...this.enemies.filter(e=>e.attack).map(e=>({root:e,attack:e.attack!})),
      ...(this.practice.target&&this.practice.attack?[{root:this.practice.target,attack:this.practice.attack}]:[])];
    for(const {root,attack:a} of sources) {
      if(a.cancelled||this.sim>=a.contactAt)continue;
      const u=Math.max(0,Math.min(1,(this.sim-a.startedAt)/(a.contactAt-a.startedAt))),r=34-u*24;
      ink.lineStyle(a.locked?2:1.5,0xf6d99a,0.5+u*0.35);
      for(const sign of [-1,1])ink.beginPath().arc(root.x,root.y-30,r,Math.atan2(a.direction.y,a.direction.x)+sign*0.3,Math.atan2(a.direction.y,a.direction.x)+sign*1.2,sign<0).strokePath();
      const x=root.x+a.direction.x*24,y=root.y-30+a.direction.y*12;
      ink.lineBetween(root.x,root.y-32,x,y);
      if(this.practice.target===root)ink.lineStyle(3,0xded7b9).lineBetween(root.x,root.y-34,x,y);
    }
  }
  drawObstacleDebug() {
    if (
      !import.meta.env.DEV ||
      !new URLSearchParams(location.search).has("obstacleDebug")
    )
      return;
    this.obstacleRoots ??= this.add.graphics().setDepth(99998);
    const ink = this.obstacleRoots.clear();
    for (const p of props.filter((p) => p.solid)) {
      for (const motion of [false, true]) {
        const r = propBounds(p, motion);
        ink
          .lineStyle(1, motion ? 0xffc864 : 0xff6578, 0.8)
          .strokeRect(r.left, r.top, r.right - r.left, r.bottom - r.top);
      }
    }
    for (const e of this.enemies.filter((e) => e.hp > 0)) {
      ink.lineStyle(1, 0x70e8d5).strokeRect(e.x - 12, e.y - 10, 24, 20);
      let previous = e;
      for (const point of e.nav.path) {
        ink.lineBetween(previous.x, previous.y, point.x, point.y);
        previous = { ...e, ...point };
      }
    }
    this.obstacleDebug ??= this.add
      .text(18, 150, "", {
        fontSize: "12px",
        color: "#ffffff",
        backgroundColor: "#263c36",
        padding: { x: 6, y: 4 },
      })
      .setScrollFactor(0)
      .setDepth(99999);
    this.obstacleDebug.setText(
      "红：实体；黄：脚底扩张；青：脚底及路径（只读）\n" +
        this.enemies
          .filter((e) => e.hp > 0)
          .map(
            (e) =>
              `${e.id} (${e.x.toFixed(1)},${e.y.toFixed(1)}) ${e.ai} 拒绝:${e.rejection ?? "无"} 目标:${e.nav.path[0] ? `${e.nav.path[0].x.toFixed(0)},${e.nav.path[0].y.toFixed(0)}` : "无"}`,
          )
          .join("\n"),
    );
  }
  update(_time: number, delta: number) {
    if (!this.hero) return;
    if (this.keys.take("escape") && this.active) {
      this.ui.open("pause");
      this.tweens.pauseAll();
      return;
    }
    if (!this.active || this.ui.paused) {
      this.pointerAttack = false;
      this.combat.clearInputs();
      this.keys.drain();
      this.timeline.reset(performance.now());
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
    const p=this.state.player,oldX=p.x,oldY=p.y,prevSim=this.sim;
    const contacts:EnemyContact[]=[];
    const navigationBudget={queries:NAV.queriesPerFrame};
    this.sim=this.timeline.frame(this.sim,performance.now(),delta,this.keys.drain(),this.combat,{
      boundary:(now)=>Math.min(this.combat.nextBoundary(now),this.practice.boundary(now),
        ...this.enemies.flatMap(e=>[e.attack?.lockAt??Infinity,e.attack?.contactAt??Infinity,e.attack?.recoveryUntil??Infinity,e.staggerUntil]).filter(t=>t>now+1e-7)),
      advance:(prev,now)=>this.advanceBattle(prev,now,contacts,navigationBudget),
      input:(events,now)=>{
        this.sim=now;
        for(const event of events){this.battleAxis=event.axis;this.runIntent=!!event.running;}
        const actions=events.filter((e):e is typeof e & {kind:"attack"|"parry"|"dash"}=>e.kind!=="axis");
        this.combat.requestActions(actions,now,p,this.hero.direction);
      },
      resolve:(now)=>this.resolveBattle(now,contacts,navigationBudget),
    });
    const dt=(this.sim-prevSim)/1000,a=this.battleAxis,length=Math.hypot(a.x,a.y),nextFacing=this.battleFacing();
    if(delta<200)this.fps.push(1000/delta);
    if(this.fps.length>1200)this.fps.shift();
    if(this.combat.hitStopRemaining>0)this.tweens.pauseAll();
    if (!this.combat.attack && !this.combat.parry && this.sim>=this.combat.dashUntil && length)
      this.hero.motion.direction=nextFacing;
    if(length&&!this.combat.attack&&!this.combat.parry&&this.sim>=this.combat.dashUntil)this.combat.leaveReady(this.sim);
    if(!length&&!this.combat.attack&&this.sim<this.combat.readyUntil)this.hero.motion.direction=this.combat.lastFacing;
    const striking = this.combat.attack;
    this.attackSerial = this.combat.serial;
    this.attackUntil = striking
      ? striking.start + this.combat.total(striking.stage)
      : 0;
    this.hero.move(
      p.x,
      p.y,
      p.x - oldX,
      p.y - oldY,
      this.sim,
      !!striking || !!this.combat.parry ||
        this.sim < this.combat.dashUntil ||
        this.sim < this.gatherUntil,
      dt,
      striking || this.combat.parry ? 0 : a.x,
      striking || this.combat.parry ? 0 : a.y,
      this.combat.parry
        ? parryVisual(this.combat.parry,this.sim)
        : striking
        ? {
            ...combatVisual(
              striking.stage,
              striking.facing,
              this.sim - striking.start,
              !!striking.enter,
              attackConfig(striking),
            ),
            weapon: weaponSample(
              striking.stage,
              striking.facing,
              this.sim - striking.start,
              attackConfig(striking),
            ),
          }
        : this.combat.counter && this.combat.lastParry?.successAt !== undefined && this.sim < this.combat.readyUntil
          ? parryVisual(this.combat.lastParry,this.sim,true)
        : this.sim < this.combat.readyUntil &&
            this.sim >= this.combat.dashUntil &&
            this.sim >= this.gatherUntil
          ? {
              ...combatVisual(
                this.combat.lastStage,
                this.combat.lastFacing,
                this.combat.total(this.combat.lastStage),
              ),
              phase: "ready" as const,
            }
          : this.combat.lastFacing >= 1 && this.sim < this.combat.settleUntil
            ? settleVisual(
                this.combat.lastFacing,
                this.sim - this.combat.readyUntil,
                this.combat.lastStage,
              )
            : undefined,
      !striking && this.sim < this.combat.dashUntil
        ? Math.abs(this.combat.dashX) > Math.abs(this.combat.dashY)
          ? this.combat.dashX < 0
            ? 2
            : 3
          : this.combat.dashY < 0
            ? 1
            : 0
        : undefined,
      Math.max(0, this.combat.carryUntil - this.sim),
      this.combat.dashArmed,
    );
    this.drawSlash();
    this.drawDashTrail();
    this.hero.sprite.setAlpha(
      this.sim < this.invulnerable ||
        this.sim < this.respawnInvulnerable ||
        this.combat.invulnerable(this.sim)
        ? 0.6 + Math.sin(this.sim / 45) * 0.3
        : 1,
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
            return `${a.cat ? "黑猫" : "旅人"} ${d.key} ${d.texture}:${d.frame} 进度${d.phaseProgress.toFixed(2)} 速度${d.speed.toFixed(1)} 翻转${d.flip} 根${d.root.map((n) => n.toFixed(0))} 锚${d.anchor.join(",")} 原点${d.origin.map((n) => n.toFixed(2))} 缩放${d.scale.map((n) => n.toFixed(2))}${d.provisional ? " 素材待补" : ""}`;
          })
          .join("\n") +
          `\n体力${p.stamina.toFixed(1)} 耗尽恢复${this.sprint.exhausted} sim${this.sim.toFixed(0)} 攻击截止${this.attackUntil.toFixed(0)}`,
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
    if (this.keys.take("e") && !this.claimDrop() && this.target)
      this.interact(this.target);
    for (let i = 0; i < 8; i++)
      if (this.keys.take(String(i + 1)) && this.state.hotbar[i])
        this.ui.useSlot(i);
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
      if(e.hp<=0||e.disabled)continue;
      e.sprite.setFrame(e.windup>0?1:Math.floor(this.sim/240)%2);
      const tint=enemyTint(this.sim,e.flashUntil,e.windup);
      if(tint===null)e.sprite.clearTint();else e.sprite.setTint(tint);
      const wind=e.attack&&!e.attack.cancelled&&this.sim<e.attack.contactAt;
      const progress=wind?Math.max(0,Math.min(1,(this.sim-e.attack!.startedAt)/(e.attack!.contactAt-e.attack!.startedAt))):0;
      e.sprite.setScale(75/128*(1+progress*0.08),75/128*(1-progress*0.1));
      e.sprite.setPosition(e.x,e.y).setDepth(e.y);
      e.shadow.setPosition(e.x,e.y-3).setDepth(e.y-0.5);
    }
    this.drawParry();
    this.drawWarnings();
    this.drawObstacleDebug();
    if (p.hp <= 0) {
      this.combat.reset(this.combat.dashCooldown);
      this.keys.clear();
      this.battleAxis={x:0,y:0};
      this.runIntent=false;
      this.practice.reset();
      this.parryEffects=[];
      this.attackUntil = 0;
      this.slash?.clear();
      this.slashBack?.clear();
      p.hp = 100;
      p.stamina = 100;
      this.sprint.reset(p.stamina);
      p.x = 670;
      p.y = 720;
      this.follower.reset(this.state.player);
      this.cat.place(592, 738);
      this.hero.place(p.x, p.y);
      this.respawnInvulnerable = this.sim + 2000;
      this.ui.message("岚爷爷把你带回广场。行囊与旅途进度都还在。");
      void this.persist().catch(() => {});
    }
    if (this.state.quest === 1 && regionAt(p).id === "forest") {
      this.state.quest = this.state.crafted ? 3 : 2;
      this.ui.dialog(
        "林间异响",
        "小黑竖起耳朵，望向更深的林间。先采集药草和浆果，在行囊中制作一瓶恢复药剂。",
        "cat",
      );
    }
    if (
      this.state.quest === 3 &&
      this.state.killed.some((id) => id.startsWith("leaf"))
    )
      this.state.quest = 4;
    const r = region(p.x, p.y);
    if (r !== this.lastRegion) {
      this.lastRegion = r;
      this.ui.message(`抵达 · ${r}`);
      void this.persist().catch(() => {});
    }
    const targets = [this.training, ...this.fieldTargets];
    const views = [this.trainingView, ...this.fieldViews];
    targets.forEach((target, i) => {
      if (target.epoch !== this.combat.epoch) {
        target.sync(this.combat.epoch);
        views[i].reset();
      }
      views[i].update(this.sim, p);
    });
    const nearest = targets.reduce((a, b) =>
      Math.hypot(p.x - a.x, p.y - a.y) < Math.hypot(p.x - b.x, p.y - b.y)
        ? a
        : b,
    );
    this.ui.training(
      nearest.snapshot(this.sim),
      Math.hypot(p.x - nearest.x, p.y - nearest.y) < TRAINING.near,
    );
    this.ui.practiceFeedback(this.practice.feedback,this.practice.mode);
    const hour = (this.state.time / 60) % 24;
    this.night.setAlpha(hour > 18 || hour < 6 ? 0.22 : 0);
    this.hudTimer += dt;
    if (this.hudTimer > 0.1) {
      this.hudTimer = 0;
      const remaining = Math.max(0, this.combat.dashCooldown - this.sim);
      this.ui.combatStatus =
        remaining > 0
          ? `L 风步 · ${(remaining / 1000).toFixed(1)}秒`
          : p.stamina < COMBAT.dash.cost
            ? "L 风步 · 体力不足"
            : "L 风步 · 就绪";
      this.ui.update(this.state, this.target ? `E · ${this.target.label}` : "");
      this.refresh();
    }
  }
}
