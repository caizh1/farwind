import { WaterEffects } from "../systems/waterEffects";
import {NpcLife} from '../systems/npcLife';
import {NpcLifeView} from '../entities/npcLifeView';
import {lifeTargets,attachLifeUi,showNotes} from '../ui/npcLife';
import {spaceBlocked,spaceClear} from '../systems/npcNavigation';
import {CombatFeedback,feedbackVisual,feedbackAudio,feedbackContactDepth,parryContactPoint,deflectDirection,unit,type FeedbackKind,type FeedbackEvent} from "../systems/combatFeedback";
import {CombatFeedbackView} from "../entities/combatFeedbackView";
import { economySnapshot, outgoingDamage, incomingDamage, type EconomyRequest } from "../systems/economy";
import { EastDefense, prepareEastRaid, type DefenseEnemy } from "../systems/defense";
import { resolveDamage } from "../systems/damage";
import { DefendersView } from "../entities/defenders";
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
  enemyAttackSpace,
  enemyAttackPermitted,
  type EnemyBody,
} from "../systems/enemy";
import { FIELD_TARGETS, TRAINING, TrainingDummy } from "../systems/training";
import { TrainingDummyView } from "../entities/trainingDummy";
import type { Attack } from "../systems/combat";
import { CombatTimeline } from "../systems/timeline";
import { StateCommit } from "../systems/stateCommit";
import { advanceNight,mayStartNight,nightWarningSnapshot } from "../systems/nightDirector";
import { canDiscover,discoverySnapshot } from "../systems/nightDiscovery";
import { RAID_GATES } from "../../data/defense";
import { NIGHT_DISCOVERY } from "../../data/dayNight";
import { DayNightView } from "../rendering/dayNightView";
import { lightAt } from "../systems/worldClock";
import { advanceTime } from "../systems/worldClock";
import { adjudicateContact, orderedContacts } from "../systems/contact";
import {sampleEnemyAttack,predictEnemyContact,warningQuality,type EnemyContact} from "../systems/enemyAttack";
import { ParryTraining, type PracticeMode } from "../systems/parryTraining";
import { WeaponTrail } from "../systems/weaponTrail";
import {SwordWindSystem,type WindMotion,type WindEvent} from '../systems/swordWind';
import {SwordWindView} from '../entities/swordWindView';
import {hasSwordWind,swordWindSource} from '../systems/skills';
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
  counterVisual,
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
type CombatTarget = Enemy | DefenseEnemy | TrainingDummy | NonNullable<ParryTraining["projection"]>;
export class World extends Phaser.Scene {
  state: State = initialState();
  keys = new Input();
  soundFx = new Sound();
  weaponTrail = new WeaponTrail();
  feedback=new CombatFeedback();
  feedbackView?:CombatFeedbackView;
  feedbackFrames:{id:string;frame:number;sim:number;wall:number;phase:string}[]=[];
  presentedFrame=0;
  swordWind=new SwordWindSystem();
  swordWindView?:SwordWindView;
  ui = new Interface();
  economy = new StateCommit(()=>{this.commitInputSuspended=true;},()=>{this.battleAxis=this.keys.axis();this.runIntent=this.keys.held.has(" ");this.keys.pressed.clear();this.keys.drain();this.commitInputSuspended=false;this.timeline.reset(performance.now());});
  nextNightAttempt=0;
  commitInputSuspended=false;
  defense = new EastDefense(this.state.defense, 0);
  defenseView!: DefendersView;
  life=new NpcLife(this.state,this.defense);
  lifeView!:NpcLifeView;
  defenseSaving = false;
  defenseCheckpointPending = false;
  hero!: Actor;
  cat!: Actor;
  propImages = new Map<string, Phaser.GameObjects.Image>();
  waterEffects?: WaterEffects;
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
  contactHistory: {at:number;id:string;result:string;parryAge:number|null;stamina:number;hp:number;inputAt:number|null;startAt:number|null;phase:string;predicted:number|null;direction:unknown;rejection:string}[] = [];
  parryEffects: {at:number;x:number;y:number;perfect:boolean}[]=[];
  parryInk?: Phaser.GameObjects.Graphics;
  warningInk?: Phaser.GameObjects.Graphics;
  practiceSprite?: Phaser.GameObjects.Sprite;
  enemyBlades=new Map<string,Phaser.GameObjects.Graphics>();
  practiceLabel?: Phaser.GameObjects.Text;
  warnings: {id:string;predicted:number|null;lead:number|null;quality:string;phase:string}[]=[];
  inputHistory: {at:number;wall:number;sequence:number;kind:string;facing:number;rejection:string}[]=[];
  pointerAttack = false;
  gatherUntil = 0;
  target?: Prop;
  follower = new Follower();
  sprint = new Sprint();
  dayNight!: DayNightView;
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
    WaterEffects.preload(this);
    this.load.image("defender-guard","/assets/village-defense/m3/guard-source.png");
    this.load.image("defender-archer","/assets/village-defense/m3/archer-source.png");
    this.load.image("defender-vertical", "/assets/village-defense/m4/archer-vertical-candidate.png");
    this.load.image("east-watchtower","/assets/village-defense/m3/watchtower-candidate.png");
    this.load.spritesheet('hero-sword-wind','/assets/animation/sword-wind/hero-sword-wind.png',{frameWidth:160,frameHeight:160});
    for(const name of ['release','flight','hit','dissolve','ground'])this.load.spritesheet(`sword-wind-${name}`,`/assets/animation/sword-wind/sword-wind-${name}.png`,{frameWidth:128,frameHeight:128});
    this.load.image("smith-building","/assets/village-economy/smith-candidate.png");
    this.load.image("inn-building","/assets/village-economy/inn-candidate.png");
    for (const [key, file] of [
      ["carpenter-workbench", "carpenter-workbench"],
      ["fountain", "plaza-fountain"],
      ["pond-water", "pond-water"],
      ["orchard-flower-bed", "orchard-flower-bed"],
      ["village-bench", "village-bench"],
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
    this.load.spritesheet("hero-counter-v3","/assets/animation/hero-counter-v3.png",{frameWidth:160,frameHeight:160});
    this.load.spritesheet("hero-parry-v2","/assets/animation/hero-parry-v2.png",{frameWidth:160,frameHeight:160});
    this.load.image(
      "hero-carry-sword",
      "/assets/animation/hero-carry-sword.png",
    );
    this.load.on("loaderror", (file: { key: string }) =>
      this.failed.push(file.key),
    );
  }
  create() {
    // Phaser重启复用Scene实例；上一轮GameObject已销毁，不能再渲染旧引用。
    this.active=false;
    this.enemies=[];this.propImages.clear();this.dropImages.clear();this.enemyBlades.clear();
    this.practiceSprite=this.practiceLabel=undefined;
    this.slash=this.slashBack=this.windTrail=this.parryInk=this.warningInk=undefined;
    this.obstacleDebug=this.motionDebug=undefined;this.obstacleRoots=this.motionRoots=undefined;
    if (this.failed.length) {
      this.ui.shell(
        "素材加载失败",
        `<p>缺少资源：${this.failed.join("、")}。请检查本地服务并刷新。</p>`,
      );
      return;
    }
    this.makeTerrain();
    this.defenseView = new DefendersView(this);
    this.lifeView=new NpcLifeView(this);
    attachLifeUi(this);
    props.forEach((p) => {
      const im = this.add
        .image(p.x, p.y, p.art, p.frame ?? 0)
        .setOrigin(0.5, 1)
        .setDisplaySize(p.w, p.h)
        .setDepth(p.depth ?? p.y);
      if(p.kind==="npc")im.setVisible(false);
      this.propImages.set(p.id, im);
    });
    this.waterEffects = new WaterEffects(this, this.propImages.get("plaza-fountain")!);
    this.trainingView = new TrainingDummyView(this, this.training);
    this.fieldViews = this.fieldTargets.map(
      (t) => new TrainingDummyView(this, t),
    );
    this.hero = new Actor(this, 670, 720);
    const feedbackMode=new URLSearchParams(location.search).get('feedback');
    if(import.meta.env.DEV&&['A','B','C','D'].includes(feedbackMode??''))this.feedback.mode=feedbackMode as typeof this.feedback.mode;
    this.feedbackView=new CombatFeedbackView(this,this.feedback);
    this.events.once('shutdown',()=>this.clearFeedback());
    this.swordWindView=new SwordWindView(this,this.swordWind);
    this.events.once('shutdown',()=>this.clearSwordWind());
    this.cat = new Actor(this, 720, 740, true);
    this.cameras.main
      .setBounds(0, 0, WORLD.width, WORLD.height)
      .startFollow(this.hero.sprite, true, 0.1, 0.1, 0, 150);
    this.cameras.main.setZoom(this.scale.width / 1280);
    const resize = (size: Phaser.Structs.Size) => {
      this.cameras.main.setZoom(size.width / 1280);
    };
    this.scale.on("resize", resize);
    this.events.once("shutdown", () => this.scale.off("resize", resize));
    this.dayNight = new DayNightView(this,()=>this.state,()=>this.ui.hudPreferences.nightVisibility);
    this.ui.actions = {
      canMutate:()=>!this.economy.busy&&!this.defenseSaving,
      trade: (r) => this.trade(r),
      start: (c) => void this.start(c).catch(() => {}),
      save: () => this.persist(true),
      import: async (s) => {
        if(this.economy.busy) throw Error("交易正在保存，请稍候。");
        await this.economy.run(()=>this.state,()=>s,save,next=>{this.loaded=next;});
        this.ui.available = true;
        await this.start(true);
      },
      use: (id) => this.use(id),
      pause: () => {
        this.waterEffects?.pause();
        this.soundFx.ambience(0,false);
        this.keys.clear();
        this.combat.clearInputs();
        this.battleAxis={x:0,y:0};
        this.runIntent=false;
        this.timeline.reset(performance.now());
      },
      practice: (mode) => this.selectPractice(mode),
      indicators:(value)=>this.practice.indicators=value,
      getIndicators:()=>this.practice.indicators,
      volume: (v) => (this.soundFx.volume = v),
      getVolume: () => this.soundFx.volume,
      title: () => void this.toTitle(),
    };
    this.keys.enabled=()=>this.active&&!this.ui.paused&&!this.defenseSaving&&!Boolean(this.economy.busy);
    if(import.meta.env.DEV&&new URLSearchParams(location.search).has("dayNightDebug"))void import("../systems/dayNightDebug").then(m=>m.installClockDebug(this));
    this.keys.uiKey=(e)=>Boolean(this.ui.handleKey(e));
    this.keys.focusCanvas=()=>this.ui.focusGame();
    const unbindCanvas=this.keys.bindCanvas(this.game.canvas);
    const suspend = () => {
      this.waterEffects?.pause();
      this.soundFx.ambience(0,false);
      this.keys.clear();
      if (this.active && !this.ui.paused) this.ui.open("pause");
    };
    window.addEventListener("blur", suspend);
    const visibility=()=>{if(document.hidden)suspend();};
    document.addEventListener("visibilitychange",visibility);
    this.events.once("shutdown", () => {
      window.removeEventListener("blur", suspend);
      document.removeEventListener("visibilitychange",visibility);
      this.soundFx.destroy();
      unbindCanvas();
    });
    Object.defineProperty(window, "__farwind", {
      configurable: true,
      value: () =>
        structuredClone({
          state: this.state,
          defense: this.defense.snapshot(),
          npcLife: this.life.snapshot(),
          defenseSaving: this.defenseSaving,
          defenseCheckpointPending: this.defenseCheckpointPending,
          ...(import.meta.env.DEV?{dayNight:{phase:lightAt(this.state.time),lights:this.dayNight.visibleLights,draws:this.dayNight.draws,loops:this.soundFx.loops.length,loopGains:this.soundFx.loops.map(l=>l.gain.gain.value),objects:this.children.length,textures:this.textures.getTextureKeys().length}}:{}),
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
                swordWind:{ground:this.swordWindView?.snapshot()??[],source:swordWindSource(this.state),effective:hasSwordWind(this.state),entities:this.swordWind.snapshot(),events:this.swordWind.events.map(e=>({id:e.wind.id,attackId:e.wind.attackId,comboId:e.wind.comboId,at:e.at,point:e.point,reason:e.reason,target:e.target?.id,damage:e.wind.config.damage}))},
                parryTraining: this.practice.snapshot(this.sim,this.state.player),
                warnings:this.warnings,
                inputs:this.inputHistory,
                contacts: this.contactHistory,
                feedback:{...this.feedback.snapshot(),audio:this.soundFx.diagnostic(),frames:this.feedbackFrames},
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
                  pose:e.attack?sampleEnemyAttack(e.attack,this.sim,e):null,
                  parried:e.parried??null,
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
    if(this.economy.busy || this.defenseSaving) return;
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
          ? "存档站位被新建筑或村界占用，已移到同一区域可走位置，其他进度保留。"
          : "存档位置无法站立，已返回安全广场，其他进度保留。",
      );
    }
    this.ui.state = this.state;
    this.active = true;
    this.waterEffects?.reset();
    resetSessionTimers(this);
    this.nextNightAttempt=0;
    this.commitInputSuspended=false;
    this.defense = new EastDefense(this.state.defense, this.sim);
    this.life=new NpcLife(this.state,this.defense);
    this.combat.reset(this.state.dashCooldownRemaining);
    this.clearSwordWind();
    this.combat.swordWindEnabled=hasSwordWind(this.state);
    this.practice.reset();
    this.contactHistory=[];
    this.inputHistory=[];
    this.parryEffects=[];
    this.clearFeedback();
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
  async trade(request: EconomyRequest) {
    await this.economy.run(() => this.state,s=>economySnapshot(request.kind==="sleep"?{...s,dashCooldownRemaining:Math.max(0,this.combat.dashCooldown-this.sim)}:s,request,this.sleepSafety()),save,next => {
      this.state = next;
      this.loaded = structuredClone(next);
      this.ui.available = true;
      this.ui.state = next;
      this.defense.rebind(next.defense);this.life.rebind(next,this.defense);
      if(request.kind === "rest") this.sprint.reset(next.player.stamina);
      this.refresh();
      this.ui.update(next, "");
      if(request.kind==="sleep")this.afterSleep();
    });
  }
  sleepSafety(){
    const c=this.combat,p=this.state.player;
    return {conflict:this.defenseSaving||this.defenseCheckpointPending,action:!!c.attack||!!c.pending||!!c.parry||this.sim<c.dashUntil||this.sim<this.gatherUntil,
      threat:[...this.enemies,...this.defense.enemies].some(e=>e.hp>0&&!e.disabled&&Math.hypot(e.x-p.x,e.y-p.y)<380&&this.clearLine(p.x,p.y,e.x,e.y)),
      projectile:this.defense.arrows.length>0||this.swordWind.winds.length>0};
  }
  afterSleep(){
    this.clearFeedback();
    this.keys.clear();this.combat.reset(this.sim+this.state.dashCooldownRemaining);this.battleAxis={x:0,y:0};this.runIntent=false;this.pointerAttack=false;this.attackUntil=this.gatherUntil=0;
    this.clearSwordWind();this.slash?.clear();this.slashBack?.clear();this.parryInk?.clear();this.warningInk?.clear();this.parryEffects=[];this.sprint.reset(100);
    this.follower.reset(this.state.player);this.cat.place(this.state.player.x-78,this.state.player.y+18);if(this.blocked(this.cat.sprite.x,this.cat.sprite.y))this.cat.place(this.state.player.x,this.state.player.y);
    this.hero.place(this.state.player.x,this.state.player.y);this.cameras.main.centerOn(this.state.player.x,this.state.player.y-150);this.timeline.reset(performance.now());this.ui.update(this.state,"");this.dayNight.render(true);this.soundFx.ambience(lightAt(this.state.time).lamps,false);
  }
  async persist(notify = false) {
    if(this.economy.busy){if(notify)throw Error("状态正在保存，请稍候。");return;}
    try {
      await this.economy.run(()=>this.state,s=>{
        const next=structuredClone(s);next.dashCooldownRemaining=Math.max(0,this.combat.dashCooldown-this.sim);return next;
      },save,snapshot=>{this.loaded=snapshot;this.defense.acknowledged(snapshot.defense.sequence);this.ui.available=true;});
      if(notify)this.ui.message("旅途已保存");
    }catch(e){this.ui.message((e as Error).message);throw e;}
  }
  publishState(next:State){this.state=next;this.loaded=structuredClone(next);this.ui.state=next;this.ui.available=true;this.defense.rebind(next.defense);this.life.rebind(next,this.defense);this.refresh();this.ui.update(next,"");}
  async startNightRaid(){
    this.nextNightAttempt=this.sim+5000;
    try{
      const v=this.cameras.main.worldView;
      await this.economy.run(()=>this.state,s=>{const p=s.night.plan!,occupied=this.enemies.filter(e=>e.hp>0&&!e.disabled),view={left:v.x,right:v.right,top:v.y,bottom:v.bottom};if(!this.defense.canScheduleAtGate(p.gate,s.player,RAID_GATES.find(g=>g.id===p.gate)!.spawns.slice(0,p.count),view,occupied))throw Error("防线健康或生成条件尚不满足。");return nightWarningSnapshot(s,view,occupied);},save,next=>this.publishState(next));
      this.ui.message("村门外发现动静，卫队正在戒备；可以参与或继续旅行。");
    }catch(e){
      // 同一个计划重试，失败不发布预警、不消费序号、不生成敌人。
      this.state.defense.retryMs=5000;
      this.ui.message("今晚的来袭暂未开始："+(e as Error).message);
    }
  }
  async discoverNight(){
    if(this.economy.busy)return;
    try{await this.economy.run(()=>this.state,discoverySnapshot,save,next=>this.publishState(next));
      this.ui.dialog("临水夜风","小黑循着微光停在草坡，轻轻碰了碰你的手。风从水面吹来，像是在说：无论走多远，总有一盏灯等你回家。\n获得恢复药剂 ×1。","cat");
    }catch(e){this.ui.message((e as Error).message);}
  }
  openDefenseDrill() {
    this.ui.dialog("东门驻防", "岑风和青禾守住通路两侧，弦雨在塔上警戒。门洞保持畅通，穿过村门便是森林。");
    if (!import.meta.env.DEV || !new URLSearchParams(location.search).has("defenseDebug")) return;
    const button=document.createElement("button"); button.id="defense-drill";
    button.textContent="启动东门演练 · 3只普通怪";
    this.ui.modal.querySelector("#dialog-text")!.after(button);
    button.onclick=()=>void this.startDefenseDrill();
  }
  async startDefenseDrill() {
    if (!import.meta.env.DEV || !new URLSearchParams(location.search).has("defenseDebug") && !new URLSearchParams(location.search).has("npcDebug") || this.defenseSaving || this.economy.busy) return;
    this.defenseSaving=true; this.ui.economyBusy=true;
    this.ui.modal.querySelectorAll<HTMLButtonElement>("button").forEach(b=>b.disabled=true);
    try {
      await this.economy.run(()=>this.state,s=>{const next=structuredClone(s);next.defense=prepareEastRaid(next.defense,next.player);return next;},save,next=>{this.publishState(next);this.defense=new EastDefense(next.defense,this.sim);this.life.rebind(next,this.defense);this.life.restore();});
      this.ui.economyBusy=false;this.ui.close();this.ui.message("东门演练开始；可以观战或远离，驻防会继续运行。");
    } catch(e) { this.ui.economyBusy=false;this.openDefenseDrill();this.ui.message(`演练未开始：${(e as Error).message}`); }
    finally {this.defenseSaving=false;}
  }
  async checkpointDefense() {
    if (this.economy.busy || this.defenseSaving || this.defenseCheckpointPending || !this.defense.critical) return;
    const defense=this.defense;
    defense.critical=false;this.defenseCheckpointPending=true;
    try {await this.persist();}
    catch(e) {if(this.defense===defense){defense.critical=true;this.ui.open("pause");this.ui.message(`驻防变化尚未保存：${(e as Error).message}`);}}
    finally {this.defenseCheckpointPending=false;}
  }
  async toTitle() {
    try {
      await this.persist(true);
      this.active = false;
      this.waterEffects?.pause();
      this.combat.reset();
      this.clearSwordWind();
      this.practice.reset();
      this.keys.clear();
      this.parryEffects=[];
      this.clearFeedback();
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
    return this.state.life.playerSpace==="village"?motionBlocked(x,y,ignore):spaceBlocked(this.state.life.playerSpace,x,y);
  }

  // 身体通路：黑猫、交互和领取掉落沿用脚底扩张范围。
  clearLine(x: number, y: number, tx: number, ty: number, ignore?: string) {
    return this.state.life.playerSpace==="village"?clearMotionLine({x,y},{x:tx,y:ty},ignore):spaceClear(this.state.life.playerSpace,{x,y},{x:tx,y:ty});
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
      feedbackVisual(this.feedback.mode),
    );
    this.slash.setDepth(this.state.player.y + 1);
    for (const { a, b, alpha } of this.weaponTrail.segments(this.sim)) {
      const ink = b.facing === 1 ? this.slashBack : this.slash;
      ink.fillStyle(b.counter ? b.counter==="perfect"?0xfff0bb:0xdcffff : b.stage === 3 ? 0xffdfa3 : 0xdaf9ed, b.counter?Math.min(1,alpha*1.3):alpha);
      ink.beginPath();
      ink.moveTo(a.inner.x, a.inner.y);
      ink.lineTo(a.tip.x, a.tip.y);
      ink.lineTo(b.tip.x, b.tip.y);
      ink.lineTo(b.inner.x, b.inner.y);
      ink.closePath();
      ink.fillPath();
      ink.lineStyle(b.counter?2.8:b.stage === 3 ? 2.4 : 1.6, 0xfff8dc, alpha);
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
    if(this.economy.busy||this.defenseSaving)return;
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
    if(this.state.life.playerSpace!=="village")return [];
    return [...this.enemies,...this.defense.enemies, this.training, ...this.fieldTargets,...(this.practice.projection?[this.practice.projection]:[])];
  }
  hitFeedback(stage: number, material: "enemy" | "straw",stop?:number,counter=false) {
    this.combat.stopOnHit(stage);
    if(stop!==undefined){this.combat.lastHitStopRequested=stop;this.combat.hitStopRemaining=Math.max(this.combat.hitStopRemaining,stop);}
    if(stage===4){this.soundFx.play('wind-hit');return;}
    if(counter)return;
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
  strikeTarget(target: CombatTarget, stage: number, attack: Attack,feedback?:{damage:number;stop:number},feedbackTarget?:CombatTarget) {
    if (target.kind === "defense-enemy") {
      const move=attackConfig(attack);
      if(this.defense.damageEnemy(target,{sourceId:"player",targetId:target.id,attackId:`player:${this.combat.epoch}:${attack.start}:${stage}`,
        amount:feedback?.damage??outgoingDamage(this.state,move.damage),sourceType:stage===4?"player-wind":"player-melee",eventId:target.eventId},this.state.player.hp)) {
        this.hitFeedback(stage,"enemy",feedback?.stop,!!attack.counter);this.counterHit(target,attack);staggerEnemy(target,this.sim,move.stagger);
        if(stage===3&&target.attack)target.attack.cancelled=true;
      }
      return;
    }
    if (target.kind === "enemy") {
      this.strikeEnemy(target, stage,attack,feedback);
      return;
    }
    if(target.kind==="trainingProjection") {
      const dummy=[this.training,...this.fieldTargets].find(t=>t===this.practice.target||t.id===this.practice.target?.id);
      staggerEnemy(target,this.sim,attackConfig(attack).stagger);
      if(dummy)this.strikeTarget(dummy,stage,attack,feedback,target);
      return;
    }
    // 同帧风步改变 epoch 时先同步，再记录旧发射快照；帧末同步不能擦掉刚收到的远程命中。
    target.sync(this.combat.epoch);
    const damage = feedback?.damage??outgoingDamage(this.state,attackConfig(attack).damage);
    if (target.hit(attack, this.sim,damage)) {
      this.hitFeedback(stage, "straw",feedback?.stop,!!attack.counter);
      this.counterHit(feedbackTarget??target,attack,'straw');
      const view =
        target === this.training
          ? this.trainingView
          : this.fieldViews[this.fieldTargets.indexOf(target)];
      view.hit(this.sim, damage);
    }
  }
  strikeEnemy(e: Enemy, stage: number,attack:Attack,feedback?:{damage:number;stop:number}) {
    if (e.hp <= 0) return;
    const move = attackConfig(attack);
    const damage = feedback?.damage??outgoingDamage(this.state,move.damage);
    const hit=resolveDamage({sourceId:"player",targetId:e.id,attackId:`player:${this.combat.epoch}:${attack.start}:${stage}`,
      amount:damage,sourceType:stage===4?"player-wind":"player-melee",eventId:null},
      {id:"player",faction:"village",hp:this.state.player.hp,armor:0},{id:e.id,faction:"hostile",hp:e.hp,armor:0});
    if(!hit.applied)return;
    e.hp = hit.hp; e.playerAggroUntil=this.sim+2500;
    this.hitFeedback(stage, "enemy",feedback?.stop,!!attack.counter);
    this.counterHit(e,attack);
    e.flashUntil = this.sim + move.flash;
    staggerEnemy(e,this.sim,move.stagger);
    this.float(e.x, e.y, String(damage));
    const contact = Math.max(
      1,
      Math.hypot(this.state.player.x - e.x, this.state.player.y - e.y),
    );
    if(stage!==4&&(!attack.counter||!feedbackVisual(this.feedback.mode))){const spark = this.add
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
    });}
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
  emitFeedback(kind:FeedbackKind,id:string,at:number,target?:{id:string;x:number;y:number;type?:string;hp?:number},attack?:Attack,extra:Partial<FeedbackEvent>={}) {
    const p=this.state.player,facing=attack?.facing??this.combat.parry?.facing??this.battleFacing(),[x,y]=facingVector(facing);
    const w=attack?.counter?counterVisual(attack,at,true).weapon!:parryWeapon(facing,1),blade=unit({x:w.tip.x-w.grip.x,y:w.tip.y-w.grip.y});
    return this.feedback.emit({id,kind,at,targetId:target?.id??attack?.primaryTarget??'',attackId:attack?`player:${attack.id}`:id,point:{x:p.x+w.tip.x,y:p.y+w.tip.y},incoming:{x,y},blade,deflect:deflectDirection({x,y},blade),quality:attack?.counter??'normal',material:target?.type==='leaf'?'leaf':target?.type==='slime'?'slime':'straw',alive:target?.hp===undefined||target.hp>0,depth:(target?.y??p.y)+ (facing===1?-.05:2),...extra});
  }
  counterHit(target:CombatTarget,attack:Attack,legacyHit:'hit'|'straw'='hit') {
    if(!attack.counter)return;
    const weapon=counterVisual(attack,this.sim,true).weapon!,touch=parryContactPoint(this.state.player,weapon,{x:target.x,y:target.y-28});
    this.emitFeedback('counter-hit',`counter-hit:${attack.id}:${target.id}`,this.sim,target,attack,{point:touch.point,blade:touch.blade,depth:feedbackContactDepth(this.state.player.y,target.y),legacyHit});
  }
  clearFeedback(){this.feedback.reset(this.sim);this.feedbackView?.clear();this.soundFx.clearFeedback();this.feedbackFrames=[];}
  battleFacing() {
    const a=this.battleAxis;
    return Math.hypot(a.x,a.y)
      ? Math.abs(a.x)>Math.abs(a.y)?a.x<0?2:3:a.y<0?1:0
      : this.combat.effectiveFacing(this.sim,this.combat.intentFacing);
  }
  tickAttack(prev:number,now:number) {
    this.combat.swordWindEnabled=hasSwordWind(this.state);
    this.combat.update(prev,now,this.battleFacing(),this.state.player,this.combatTargets(),
      (x,y)=>this.blocked(x,y),(x,y,tx,ty,id)=>this.meleeLine(x,y,tx,ty,id),
      (target,stage,attack)=>this.strikeTarget(target,stage,attack),
      (stage,attack)=>{this.training.sync(this.combat.epoch);this.training.begin(attack);if(attack.counter)this.emitFeedback('counter-start',`counter-start:${attack.id}`,attack.start,undefined,attack);if(stage===4)this.soundFx.play('wind-charge');},
      stage=>{const a=this.combat.attack!;if(a.counter){if(!feedbackAudio(this.feedback.mode))this.soundFx.play('counter');}else this.soundFx.play(stage===4?'wind-release':stage===3?'attack-heavy':'attack');},clearMotionLine,
      (attack,root,at)=>this.swordWind.launch(attack,root,at,outgoingDamage(this.state,attack.swordWind!.damage)));
  }
  clearSwordWind(){this.swordWind.clear();this.swordWindView?.clear();}
  resolveSwordWind(events:WindEvent[]){for(const event of events){if(event.target)this.strikeTarget(event.target as CombatTarget,4,event.wind.attack,{damage:event.wind.config.damage,stop:event.wind.config.hitStop});else this.soundFx.play('wind-dissolve');}}
  advanceBattle(prev:number,now:number,contacts:EnemyContact[],budget:{queries:number}) {
    const motion:WindMotion[]=this.combatTargets().map(target=>({target,previous:{x:target.x,y:target.y},current:{x:target.x,y:target.y}}));
    this.sim=now;
    const p=this.state.player,a=this.battleAxis,dt=(now-prev)/1000,length=Math.hypot(a.x,a.y),outside=this.state.life.playerSpace==="village",battlePlayer=outside?p:{x:-10000,y:-10000,hp:0};
    const previousTime=this.state.time;
    const previousNight=this.state.night.plan?.night;
    this.state.time=advanceTime(previousTime,now-prev);
    if(Math.floor(previousTime)!==Math.floor(this.state.time)&&advanceNight(this.state,previousTime)){
      this.defense.critical=true;
      if(this.state.night.plan?.night!==previousNight)this.ui.message(this.state.night.plan?.outcome==="pending"?"黄昏已至，卫队今晚会留意村门。可自由探索或到旅馆住宿。":"村灯亮起，今晚适合沿水边散步。");
    }
    const guard=!!this.combat.parry&&prev<this.combat.parry.actionUntil;
    const dash=prev<this.combat.dashUntil;
    const busy=!!this.combat.attack||guard||dash||this.combat.pending;
    const movement=this.sprint.update(p.stamina,this.runIntent&&length>0&&!busy,dash?0:dt,prev>=this.combat.regenUntil);
    p.stamina=movement.stamina;
    const speed=guard?PARRY.speed:busy?this.combat.attack?55:0:movement.speed;
    if(length)sweepMove(p,a.x/length*speed*dt,a.y/length*speed*dt,(x,y)=>this.blocked(x,y),(a,b)=>this.clearLine(a.x,a.y,b.x,b.y));
    this.tickAttack(prev,now);
    this.defense.external=this.enemies;
    const view = this.cameras.main.worldView;
    contacts.push(...this.defense.update(now,now-prev,battlePlayer,budget,
      outside?{left:view.x,right:view.right,top:view.y,bottom:view.bottom}:undefined,this.enemies.filter(e=>e.hp>0&&!e.disabled)));
    for(const e of this.defense.enemies)this.playEnemyAttack(e.attack,now,e);
    this.life.step(now-prev,budget);
    for(const e of [...this.enemies].sort((a,b)=>a.id.localeCompare(b.id))) {
      const event=this.defense.manages(e)?null:updateEnemy(e,battlePlayer,now,now-prev,budget);
      this.playEnemyAttack(e.attack,now,e);
      if(event&&outside)contacts.push(event);
    }
    const training=outside?this.practice.update(now,p,this.combat):null;
    this.playEnemyAttack(this.practice.attack,now,this.practice.projection??undefined);
    if(training)contacts.push(training);
    for(const m of motion)m.current={x:m.target.x,y:m.target.y};
    this.resolveSwordWind(this.swordWind.advance(prev,now,motion));
  }
  resolveBattle(now:number,contacts:EnemyContact[],budget:{queries:number}) {
    this.sim=now;
    const p=this.state.player;
    if(this.state.life.playerSpace!=="village"){contacts.length=0;return;}
    for(const action of this.combat.flushActions(now,p)) {
      if(action==="dash")this.sprint.reset(p.stamina);
      else {this.sprint.update(p.stamina,false,0);this.practice.started(now);}
      if(action==='parry')this.emitFeedback('guard-start',`guard:${this.combat.parry!.id}`,now);else this.soundFx.play('dash');
    }
    this.tickAttack(now,now);
    this.resolveSwordWind(this.swordWind.advance(now,now,this.combatTargets().map(target=>({target,previous:{x:target.x,y:target.y},current:{x:target.x,y:target.y}}))));
    for(const e of [...this.enemies].sort((a,b)=>a.id.localeCompare(b.id))) {
      const event=this.defense.manages(e)?null:updateEnemy(e,p,now,0,budget);
      this.playEnemyAttack(e.attack,now,e);
      if(event)contacts.push(event);
    }
    const training=this.practice.update(now,p,this.combat);
    this.playEnemyAttack(this.practice.attack,now,this.practice.projection??undefined);
    if(training)contacts.push(training);
    this.resolveContacts(now,contacts);
  }
  resolveContacts(now:number,contacts:EnemyContact[],beforeInput=false) {
    const p=this.state.player,ready=contacts.filter(c=>!beforeInput||c.at<now-1e-7);
    for(const c of ready)contacts.splice(contacts.indexOf(c),1);
    for(const contact of orderedContacts(ready)) {
      const e=[...this.enemies,...this.defense.enemies].find(e=>e.id===contact.attack.attackerId);
      const body=e??(contact.training?this.practice.projection:null);
      const valid=contact.training?this.practice.mode!=="off":!!e&&e.hp>0&&!e.disabled&&e.attack?.attackId===contact.attack.attackId&&
        (e.kind==="defense-enemy" || enemyAttackPermitted(e,p));
      const result=adjudicateContact(contact,this.combat,p,{valid,immune:now<this.invulnerable||now<this.respawnInvulnerable,clear:(a,b,id)=>clearMeleeLine(a,b,id)});
      if(contact.training)this.practice.observe(contact,result,this.combat,p);
      if(result==="normal"||result==="perfect") {
        if(body) {
          body.parried={at:contact.at,until:contact.at+PARRY[result].stagger,direction:{...contact.attack.direction},perfect:result==="perfect"};
          sweepMove(body,-contact.attack.direction.x*PARRY[result].knock,-contact.attack.direction.y*PARRY[result].knock,(x,y)=>this.blocked(x,y),clearMotionLine);
        }
        if(e) {
          e.windup=0;
          staggerEnemy(e,contact.at,PARRY[result].stagger);

          e.nav.path=[];
        }
        const guard=this.combat.parry!,w=parryWeapon(guard.facing,1),g=contact.geometry;
        const attackPoint=g?{x:(g.a.x+g.b.x)/2,y:(g.a.y+g.b.y)/2-28}:{x:contact.origin.x,y:contact.origin.y-28};
        const touch=parryContactPoint(p,w,attackPoint),incoming=unit(contact.attack.direction),deflect=deflectDirection(incoming,touch.blade);
        this.emitFeedback(result==='perfect'?'parry-perfect-contact':'parry-contact',`parry:${contact.attack.attackId}`,contact.at,body??undefined,undefined,{attackId:contact.attack.attackId,point:touch.point,incoming,blade:touch.blade,deflect,quality:result,until:contact.at+PARRY[result].stagger,depth:feedbackContactDepth(p.y,body?.y)});
        const legacyTouch=parryContactPoint(p,w,{x:contact.origin.x,y:contact.origin.y-28});
        this.parryEffects.push({at:now,x:legacyTouch.point.x,y:legacyTouch.point.y,perfect:result==='perfect'});
        this.sprint.update(p.stamina,false,0);
        this.ui.update(this.state,this.target?`E · ${this.target.label}`:"");

      } else if(result==="afterguard") {
        this.emitFeedback('afterguard',`afterguard:${contact.attack.attackId}`,contact.at,body??undefined,undefined,{attackId:contact.attack.attackId,point:{x:contact.origin.x,y:contact.origin.y-28},incoming:unit(contact.attack.direction)});
        if(e)e.windup=0;
      } else if(result==="hurt"&&!contact.training) {
        const damage=incomingDamage(this.state,contact.attack.damage);
        const hit=resolveDamage({sourceId:contact.attack.attackerId,targetId:"player",attackId:contact.attack.attackId,
          amount:damage,sourceType:"enemy-melee",eventId:e?.kind==="defense-enemy"?e.eventId:null},
          {id:contact.attack.attackerId,hp:e?.hp??1,faction:"hostile",armor:0},{id:"player",hp:p.hp,faction:"village",armor:0});
        p.hp=hit.hp;
        this.invulnerable=now+850;
        this.combat.hurt();
        this.feedback.cancelRelease();
        this.soundFx.play("hit");
        this.float(p.x,p.y,`-${damage}`);
      }
      this.contactHistory.push({at:contact.at,id:contact.attack.attackId,result,parryAge:this.combat.lastParry?contact.at-this.combat.lastParry.start:null,stamina:p.stamina,hp:p.hp,inputAt:this.combat.lastParryRequestAt,startAt:this.combat.lastParry?.start??null,phase:sampleEnemyAttack(contact.attack,contact.at,contact.origin).phase,predicted:this.warnings.find(w=>w.id===contact.attack.attackId)?.predicted??null,direction:{attack:contact.attack.direction,guard:this.combat.lastParry?.facing},rejection:this.combat.lastRejection});
      if(this.contactHistory.length>80)this.contactHistory.shift();
    }
  }
  selectPractice(mode:PracticeMode) {
    const target=[this.training,...this.fieldTargets].sort((a,b)=>Math.hypot(a.x-this.state.player.x,a.y-this.state.player.y)-Math.hypot(b.x-this.state.player.x,b.y-this.state.player.y))[0];
    if(Math.hypot(target.x-this.state.player.x,target.y-this.state.player.y)>TRAINING.near){this.ui.message("请先靠近练习木桩");return;}
    this.combat.hurt();
    this.clearFeedback();
    this.practice.select(mode,target,this.sim,this.state.player);
  }
  drawParry() {
    this.parryInk??=this.add.graphics();const ink=this.parryInk.clear().setDepth(this.state.player.y+2);
    this.parryEffects=this.parryEffects.filter(e=>this.sim-e.at<PARRY.visual.flashLife);
    for(const e of feedbackVisual(this.feedback.mode)?[]:this.parryEffects){const u=(this.sim-e.at)/PARRY.visual.flashLife,alpha=1-u,r=PARRY.visual.rayStart+u*PARRY.visual.rayTravel;
      ink.fillStyle(0xfffff1,alpha).fillCircle(e.x,e.y,u<.2?PARRY.visual.core:2.5*(1-u));
      ink.lineStyle(e.perfect?2.8:2.2,e.perfect?0xffe6a7:0xd9ffff,alpha);
      for(let i=0;i<4;i++){const a=i*Math.PI/2+.4;ink.lineBetween(e.x+Math.cos(a)*5,e.y+Math.sin(a)*5,e.x+Math.cos(a)*r,e.y+Math.sin(a)*r);}
      if(e.perfect)ink.lineStyle(1,0xffffff,alpha).strokeRect(e.x-5-u*3,e.y-5-u*3,10+u*6,10+u*6);
    }
    const guard=this.combat.parry;
    if(guard&&guard.successAt===undefined){const p=this.state.player,w=parryWeapon(guard.facing,0),active=this.combat.parryQuality(this.sim)!==null;
      ink.lineStyle(active?1.6:1,active?0xbdf5f1:0x839389,active?.7:.35).lineBetween(p.x+w.grip.x,p.y+w.grip.y,p.x+w.tip.x,p.y+w.tip.y);
    }
  }
  playEnemyAttack(attack:EnemyBody["attack"],now:number,root?:{x:number;y:number}) {
    if(attack&&!this.feedback.attackAudible(attack.startedAt,root,this.state.player))return;
    if(!attack||attack.cancelled)return;
    if(!attack.chargeSound){this.emitFeedback('enemy-charge',`charge:${attack.attackId}`,now,undefined,undefined,{attackId:attack.attackId,targetId:attack.attackerId,incoming:{...attack.direction}});attack.chargeSound=true;}
    if(now>=attack.contactAt&&!attack.strikeSound){this.emitFeedback('enemy-strike',`strike:${attack.attackId}`,attack.contactAt,undefined,undefined,{attackId:attack.attackId,targetId:attack.attackerId,incoming:{...attack.direction}});attack.strikeSound=true;}
  }
  drawEnemyPose(body:{id:string;x:number;y:number;type:string;parried?:EnemyBody["parried"]},attack:EnemyBody["attack"],sprite:Phaser.GameObjects.Sprite) {
    const pose=attack&&!attack.cancelled?sampleEnemyAttack(attack,this.sim,body):null,parried=body.parried;
    let x=pose?.offset.x??0,y=pose?.offset.y??0,rotation=0,frame=pose?.frame??Math.floor(this.sim/240)%2;
    if(parried&&this.sim<parried.until&&!feedbackVisual(this.feedback.mode)){const u=(this.sim-parried.at)/(parried.until-parried.at),strength=u<.15?Math.sin(u/.15*Math.PI/2):u<.7?1:1-(u-.7)/.3;
      frame=u<.78?3:0;x-=parried.direction.x*11*strength;y-=parried.direction.y*7*strength;
      rotation=(parried.direction.x<0?-1:1)*(body.type==="leaf"?.22:.13)*strength+Math.sin(u*19)*.045*(1-u);
    }
    const impact=feedbackVisual(this.feedback.mode)?this.feedback.reaction(body.id,this.sim,body.type):null;
    if(impact){x=impact.x;y=impact.y;rotation=impact.rotation;frame=impact.frame;}
    sprite.setTexture(body.type,frame).setDisplaySize(75,75).setPosition(body.x+x,body.y+y).setDepth(body.y).setRotation(rotation);
    if(pose||parried)sprite.setFlipX((pose?.direction??parried!.direction).x<0);
    if(pose?.phase==="active"&&body.type==="leaf"){
      if(!this.enemyBlades.has(body.id))this.enemyBlades.set(body.id,this.add.graphics());
      const g=pose.geometry,ink=this.enemyBlades.get(body.id)!.setDepth(body.y+.1);ink.lineStyle(3,0xe5f1af,.85).lineBetween(g.a.x,g.a.y-30,g.b.x,g.b.y-30);ink.lineStyle(1,0xffffff,.8).lineBetween(g.a.x,g.a.y-30,g.b.x,g.b.y-30);
    }
  }
  drawWarnings() {
    this.warningInk??=this.add.graphics();const ink=this.warningInk.clear().setDepth(8998);if(this.state.life.playerSpace!=="village"){this.warnings=[];return;}
    const sources=[...this.enemies.filter(e=>e.attack&&!e.attack.cancelled&&e.hp>0&&enemyAttackPermitted(e,this.state.player)&&(!this.defense.manages(e)||e.targetId==="player")).map(e=>({root:e,attack:e.attack!})),...this.defense.enemies.filter(e=>e.attack&&!e.attack.cancelled&&e.hp>0&&e.targetId==="player").map(e=>({root:e,attack:e.attack!})),...(this.practice.projection&&this.practice.attack?[{root:this.practice.projection,attack:this.practice.attack}]:[])];
    const threats=sources.map(source=>({...source,predicted:predictEnemyContact(source.attack,source.root,this.state.player,this.sim,"homeX" in source.root&&source.root.kind!=="defense-enemy"?enemyAttackSpace(source.root):undefined,Math.max(0,source.root.staggerUntil-this.sim))})).sort((a,b)=>(a.predicted??Infinity)-(b.predicted??Infinity)||a.attack.attackerId.localeCompare(b.attack.attackerId));
    this.warnings=threats.map(({attack:a,root,predicted})=>({id:a.attackId,predicted,lead:predicted===null?null:predicted-this.sim,quality:warningQuality(predicted===null?null:predicted-this.sim),phase:sampleEnemyAttack(a,this.sim,root).phase}));
    if(!this.practice.indicators)return;
    for(let i=0;i<threats.length;i++){
      const {root,attack:a,predicted}=threats[i],hint=this.warnings[i];if(a.cancelled||a.emitted||this.sim>=a.activeUntil)continue;
      const pose=sampleEnemyAttack(a,this.sim,root),perfect=hint.quality==="perfect",normal=hint.quality==="normal",alpha=(i===0?1:.35)*(hint.quality==="none"?.25:1);
      const pause=Math.max(0,root.staggerUntil-this.sim),x=root.x,y=root.y-66,u=predicted===null?pose.warningProgress:Math.max(0,Math.min(1,1-(predicted-this.sim-pause)/(predicted-a.startedAt-pause))),r=10+(1-u)*20;
      ink.lineStyle(1,0xc8d3b5,.4*alpha).strokeCircle(x,y,9);
      ink.lineStyle(perfect?3:normal?2.5:1.2,perfect?0xfff4c7:normal?0xb9f7e5:0xdac49b,(perfect?.95:normal?.85:.45)*alpha).strokeCircle(x,y,r);
      ink.lineStyle(1,0xfff4c7,.6*alpha);for(const sign of [-1,1])ink.lineBetween(x+sign*8,y-3,x+sign*8,y+3);
      if(normal){ink.lineStyle(2,0xb9f7e5,.7*alpha).lineBetween(x-10,y+12,x+10,y+12);}
      if(perfect){ink.lineStyle(1.5,0xffffff,alpha).strokeCircle(x,y,r+3);ink.fillStyle(0xfff5cc,.95*alpha).beginPath().moveTo(x,y-5).lineTo(x+5,y).lineTo(x,y+5).lineTo(x-5,y).closePath().fillPath();}
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
    const residentTools=document.querySelector<HTMLElement>(".resident-tools");if(residentTools)residentTools.hidden=!this.active||this.ui.paused;
    if (!this.hero) return;
    this.waterEffects?.update(delta, this.active && !this.ui.paused && !document.hidden && !this.defenseSaving && !this.economy.busy);
    this.soundFx.ambience(lightAt(this.state.time).lamps,this.active&&!this.ui.paused&&!document.hidden&&document.hasFocus());
    if (this.keys.take("escape") && this.active && !this.economy.busy && !this.defenseSaving) {
      this.ui.open("pause");
      this.tweens.pauseAll();
      return;
    }
    if (!this.active || this.ui.paused || this.defenseSaving || this.economy.busy) {
      if(this.active&&!this.ui.paused&&(this.economy.busy||this.defenseSaving))this.commitInputSuspended=true;
      this.pointerAttack = false;
      this.combat.clearInputs();
      this.keys.drain();
      this.timeline.reset(performance.now());
      this.tweens.pauseAll();
      return;
    }
    // 保存冻结期间仍记录物理按键的按下/松开；恢复时只同步方向，不补放攻击。
    if(this.commitInputSuspended){this.battleAxis=this.keys.axis();this.runIntent=this.keys.held.has(" ");this.keys.pressed.clear();this.keys.drain();this.commitInputSuspended=false;}
    this.tweens.resumeAll();
    if(this.keys.take("n")){showNotes(this);return;}
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
      beforeInput:(now)=>this.resolveContacts(now,contacts,true),
      boundary:(now)=>Math.min(this.combat.nextBoundary(now),this.practice.boundary(now),
        ...this.enemies.flatMap(e=>[e.attack?.lockAt??Infinity,e.attack?.contactAt??Infinity,e.attack?.activeUntil??Infinity,e.attack?.recoveryUntil??Infinity,e.staggerUntil]).filter(t=>t>now+1e-7)),
      advance:(prev,now)=>this.advanceBattle(prev,now,contacts,navigationBudget),
      input:(events,now)=>{
        this.sim=now;
        for(const event of events){this.battleAxis=event.axis;this.runIntent=!!event.running;this.combat.setIntent(event.axis);this.inputHistory.push({at:now,wall:event.at,sequence:event.sequence,kind:event.kind,facing:this.combat.intentFacing,rejection:this.combat.lastRejection});}if(this.inputHistory.length>160)this.inputHistory.splice(0,this.inputHistory.length-160);
        const actions=events.filter((e):e is typeof e & {kind:"attack"|"parry"|"dash"}=>e.kind!=="axis"&&this.state.life.playerSpace==="village");
        this.combat.requestActions(actions,now,p,this.combat.intentFacing);
      },
      resolve:(now)=>this.resolveBattle(now,contacts,navigationBudget),
    });
    const dt=(this.sim-prevSim)/1000,a=this.battleAxis,length=Math.hypot(a.x,a.y),nextFacing=this.battleFacing();
    if(delta<200)this.fps.push(1000/delta);
    if(this.fps.length>1200)this.fps.shift();
    if(this.combat.hitStopRemaining>0)this.tweens.pauseAll();
    this.feedback.advance(this.sim,this.combat.attack?.counter?`player:${this.combat.attack.id}`:null);
    const feedbackEvents=this.feedback.drain();
    this.soundFx.feedbackBatch(feedbackEvents,this.feedback.mode);
    this.swordWindView?.draw(this.sim);
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
        ? striking.counter ? counterVisual(striking,this.sim,feedbackVisual(this.feedback.mode)) : {
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
    this.target = [...lifeTargets(this),...(this.state.life.playerSpace==="village"?props.filter(p=>p.kind!=="npc"):[]),...(this.state.life.playerSpace==="village"&&canDiscover(this.state)?[{...NIGHT_DISCOVERY,art:"",w:0,h:0,kind:"sign" as const}]:[])]
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
    if (this.keys.take("e") && !(this.state.life.playerSpace==="village"&&this.claimDrop()) && this.target)
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
    for(const ink of this.enemyBlades.values())ink.clear();
    for(const e of this.enemies){if(e.hp<=0||e.disabled)continue;this.drawEnemyPose(e,e.attack,e.sprite);
      if(this.sim<e.flashUntil)e.sprite.setTint(0xff8585);else e.sprite.clearTint();
      e.shadow.setPosition(e.x,e.y-3).setDepth(e.y-.5);
    }
    this.defense.observerSpace=this.state.life.playerSpace;
    this.defenseView.update(this.defense,this.sim,(e,sprite)=>{
      if(Math.hypot(e.x-p.x,e.y-p.y)<650)this.drawEnemyPose(e,e.attack,sprite);
      else sprite.setFrame(e.attack?sampleEnemyAttack(e.attack,this.sim,e).frame:Math.floor(this.sim/240)%2)
        .setDisplaySize(75,75).setPosition(e.x,e.y).setDepth(e.y);
    },this.life);
    const defenseEvents=this.defense.drainNotices();
    this.life.consumeDefense(defenseEvents);
    for(const event of defenseEvents) {
      if(event.kind==="hit"&&event.x!==undefined&&Math.hypot(event.x-p.x,event.y!-p.y)<600)
        this.float(event.x,event.y!,`-${event.damage}`);
      if(event.kind==="death"&&this.state.defense.guards.some(g=>g.id===event.id))this.ui.message("守卫阵亡；不会因读档自动复活。");
      if(event.kind==="death"){const enemy=this.enemies.find(e=>e.id===event.id);
        if(enemy){enemy.sprite.setVisible(false);enemy.shadow.setVisible(false);
          // 常驻野怪被卫队击倒只记录世界状态，不代领采集或主线奖励。
          if(!this.state.killed.includes(enemy.id))this.state.killed.push(enemy.id);}}
      if(event.kind==="warning")this.ui.message(`${event.id}外发现动静，卫队正在戒备。`);
      if(event.kind==="started")this.ui.message(`${event.id}有小怪接近；卫队会自行拦截。`);
      if(event.kind==="delayed")this.ui.message("来袭路径或生成点不合法，本轮已延后。");
      if(event.kind==="ended")this.ui.message("村门来袭已结束，驻防变化正在保存。");
    }
    this.life.observePlayer();this.lifeView.update(this.life,this.sim);
    for(const message of this.life.messages.splice(0))this.ui.message(message);
    this.practiceSprite??=this.add.sprite(0,0,"slime",0).setOrigin(.5,1);
    this.practiceSprite.setVisible(!!this.practice.projection);
    if(this.practice.projection)this.drawEnemyPose(this.practice.projection,this.practice.attack,this.practiceSprite);
    this.practiceLabel??=this.add.text(0,0,"练习投影",{fontSize:"10px",color:"#a1adaf"}).setOrigin(.5,1);
    this.practiceLabel.setVisible(!!this.practice.projection);
    if(this.practice.projection)this.practiceLabel.setPosition(this.practice.projection.x,this.practice.projection.y-82).setDepth(8996);
    this.drawParry();
    this.feedbackView?.draw(this.sim);
    this.presentedFrame++;
    for(const event of feedbackEvents)this.feedbackFrames.push({id:event.id,frame:this.presentedFrame,sim:this.sim,wall:performance.now(),phase:this.hero.presentation.phase});
    if(this.feedbackFrames.length>96)this.feedbackFrames.splice(0,this.feedbackFrames.length-96);
    this.drawWarnings();
    this.drawObstacleDebug();
    if (p.hp <= 0) {
      this.clearSwordWind();
      this.combat.reset(this.combat.dashCooldown);
      this.keys.clear();
      this.battleAxis={x:0,y:0};
      this.runIntent=false;
      this.practice.reset();
      this.parryEffects=[];
      this.clearFeedback();
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
    if (this.state.life.playerSpace==="village"&&this.state.quest === 1 && regionAt(p).id === "forest") {
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
    const r = this.state.life.playerSpace==="village"?region(p.x,p.y):"室内";
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
    const combat=this.combat,attack=combat.attack;
    const windWindow=hasSwordWind(this.state)&&(attack?.stage===3&&this.sim>=attack.start+combat.total(3)-COMBAT.restartWindow||!attack&&combat.nextStage===4&&this.sim<=combat.chainUntil);
    const status=windWindow?combat.pending?'已预约第四击·剑风':'J 接第四击·剑风':attack&&attack.stage<3 ? combat.pending?`已预约第${attack.stage+1}刀`:`J 接第${attack.stage+1}刀` : !attack&&this.sim<=combat.chainUntil&&combat.nextStage>1&&combat.nextStage<=combat.maxStage?`J 接第${combat.nextStage}刀`:combat.autoCounter?"成功 · 自动反斩；J 接第二刀":p.stamina<PARRY.cost?"K · 体力不足":combat.diagnostic(this.sim).status;
    this.ui.parryStatus(status);
    this.ui.swordWind(swordWindSource(this.state));


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
    if(this.state.life.playerSpace!=="village"){
      this.hero.sprite.setDepth(7500+p.y);this.hero.shadow?.setDepth(7500+p.y-.5);
      this.cat.sprite.setDepth(7500+this.cat.sprite.y);this.cat.shadow?.setDepth(7500+this.cat.sprite.y-.5);
      this.warningInk?.clear();this.parryInk?.clear();this.slash?.clear();this.slashBack?.clear();
    }
    if(this.defense.critical)void this.checkpointDefense();
    else if(mayStartNight(this.state)&&this.sim>=this.nextNightAttempt&&!this.economy.busy&&!this.defenseCheckpointPending)void this.startNightRaid();
  }
}
