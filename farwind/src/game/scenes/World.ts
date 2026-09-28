import {arenaImpact} from "../systems/eliteArena";
import {ARENA_STONES,creatureMaxHP,type EliteKind} from "../../data/maps/windbell/elites";
import {enemyProtection} from '../systems/enemyTraits';
import {DEMON_KING} from '../../data/demonKing';
import {demonMalice,demonKingIntroduction} from '../systems/demonKingState';
import {regionalThreat} from "../systems/wildThreat";
import {ENCOUNTERS,encounterUnit} from "../../data/maps/windbell/encounters";
import {WildernessEncounters} from "../systems/encounterRuntime";
import {unitState,settleEncounterDeath} from "../systems/encounterState";
import {SHORTCUTS} from "../../data/maps/windbell/shortcuts";
import {syncMapGeometry} from "../../data/world";
import {WindLessons} from '../systems/windLessons';
import { XiaobaoView } from '../entities/xiaobaoView';
import { xiaobaoEnvironment, xiaobaoAllies } from '../systems/xiaobaoWorld';
import { XIAOBAO_SKILLS, type XiaobaoTask } from '../../data/xiaobaoCombat';
import type { DamageEvent, ReleasedAttack } from '../systems/damage';
import { WaterEffects } from "../systems/waterEffects";
import {NpcLife} from '../systems/npcLife';
import {NpcLifeView} from '../entities/npcLifeView';
import {lifeTargets,attachLifeUi,showNotes} from '../ui/npcLife';
import {spaceBlocked,spaceClear} from '../systems/npcNavigation';
import {CombatFeedback,feedbackVisual,feedbackAudio,feedbackContactDepth,parryContactPoint,deflectDirection,unit,type FeedbackKind,type FeedbackEvent} from "../systems/combatFeedback";
import {CombatFeedbackView} from "../entities/combatFeedbackView";
import { economySnapshot, outgoingDamage, incomingDamage, type EconomyRequest } from "../systems/economy";
import { EastDefense, prepareEastRaid, type DefenseEnemy } from "../systems/defense";
import { resolveDamage,resolveReleasedDamage } from "../systems/damage";
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
  companionControl,
  enemyAttackSpace,
  enemyAttackPermitted,
  type EnemyBody,
} from "../systems/enemy";
import { FIELD_TARGETS, TRAINING, TrainingDummy } from "../systems/training";
import { TrainingDummyView } from "../entities/trainingDummy";
import type { Attack } from "../systems/combat";
import { CombatTimeline } from "../systems/timeline";
import { StateCommit } from "../systems/stateCommit";
import { advanceNight,mayStartNight,nightWarningSnapshot,RaidDeferredError } from "../systems/nightDirector";
import { canDiscover,discoverySnapshot } from "../systems/nightDiscovery";
import { RAID_GATES, RAID_TIMING } from "../../data/defense";
import { inProtected } from "../../data/defenseZones";
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
  PLAYER_HURT,
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
  hurtVisual,
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
import {EnemyView} from '../entities/enemyView';
import {EnemyProjectiles} from '../systems/enemyProjectiles';
import {enemyProfile} from '../../data/enemies';
import type {AnimatedEnemy} from '../systems/enemyAnimation';
import { Interface } from "../ui/interface";
type Enemy = EnemyBody & {
  kind: "enemy";
  flashUntil: number;
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
};
type CombatTarget = Enemy | DefenseEnemy | TrainingDummy | NonNullable<ParryTraining["projection"]>;
type StrikeFeedback = {damage:number;stop:number;point?:{x:number;y:number};at?:number};
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
  lessons?:WindLessons;
  ui = new Interface();
  economy = new StateCommit(()=>{this.commitInputSuspended=true;},()=>{this.battleAxis=this.keys.axis();this.runIntent=this.keys.held.has(" ");this.keys.pressed.clear();this.keys.drain();this.commitInputSuspended=false;this.timeline.reset(performance.now());});
  nextNightAttempt=0;
  commitInputSuspended=false;
  defense = new EastDefense(this.state.defense, 0);
  defenseView!: DefendersView;
  life=new NpcLife(this.state,this.defense);
  lifeView!:NpcLifeView;
  xiaobao?: XiaobaoView;
  xiaobaoRecent: {id:string;at:number}|null=null;
  defenseSaving = false;
  defenseCheckpointPending = false;
  hero!: Actor;
  cat!: Actor;
  propImages = new Map<string, Phaser.GameObjects.Image>();
  waterEffects?: WaterEffects;
  enemies: Enemy[] = [];
  wilderness?:WildernessEncounters;
  enemyView!:EnemyView;
  enemyProjectiles=new EnemyProjectiles();
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
  hurtInk?: Phaser.GameObjects.Graphics;
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
    XiaobaoView.preload(this);
    EnemyView.preload(this);
    WaterEffects.preload(this);
    this.load.image("life-bed", "/assets/npc-life/bed.png");
    this.load.image("life-table", "/assets/npc-life/table.png");
    for (const id of ["elder", "healer", "carpenter"])
      this.load.spritesheet(`${id}-work`, `/assets/npc-life/${id}-work.png`, { frameWidth: 128, frameHeight: 128 });
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
    this.load.image("community-ledger", "/assets/commission/ledger-prop.webp");
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
    this.load.spritesheet("hero-hurt","/assets/animation/hero-hurt.png",{frameWidth:160,frameHeight:160});
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
    this.slash=this.slashBack=this.windTrail=this.parryInk=this.warningInk=this.hurtInk=undefined;
    this.obstacleDebug=this.motionDebug=undefined;this.obstacleRoots=this.motionRoots=undefined;
    if (this.failed.length) {
      this.ui.shell(
        "素材加载失败",
        `<p>缺少资源：${this.failed.join("、")}。请检查本地服务并刷新。</p>`,
      );
      return;
    }
    this.makeTerrain();
    this.enemyView=new EnemyView(this);
    this.defenseView = new DefendersView(this);
    this.lifeView=new NpcLifeView(this);
    this.xiaobao = new XiaobaoView(this);
    attachLifeUi(this);
    props.forEach((p) => {
      const im = this.add
        .image(p.displayAt?.x ?? p.x, p.displayAt?.y ?? p.y, p.art, p.frame ?? 0)
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
    this.events.once('shutdown',()=>{this.combat.hurt();this.clearFeedback();});
    this.swordWindView=new SwordWindView(this,this.swordWind);
    this.lessons=new WindLessons(this);
    this.events.once('shutdown',()=>this.clearSwordWind());
    this.cat = new Actor(this, 720, 740, true);
    this.cameras.main
      .setBounds(WORLD.left, WORLD.top, WORLD.width, WORLD.height)
      .startFollow(this.hero.sprite, true, 0.1, 0.1, 0, 150);
    this.cameras.main.setZoom(this.scale.width / 1280);
    const resize = (size: Phaser.Structs.Size) => {
      this.cameras.main.setZoom(size.width / 1280);
    };
    this.scale.on("resize", resize);
    this.events.once("shutdown", () => this.scale.off("resize", resize));
    this.dayNight = new DayNightView(this,()=>this.state,()=>this.ui.hudPreferences.nightVisibility);
    this.ui.actions = {
      xiaobao:()=>this.xiaobao?.open(this),
      canMutate:()=>!this.economy.busy&&!this.defenseSaving,
      trade: (r) => this.trade(r),
      start: (c) => void this.start(c).catch((error: unknown) => {
        console.error("启动旅途失败", error);
        this.active = false;
        this.ui.title(`启动旅途失败：${error instanceof Error ? error.message : String(error)}`);
      }),
      save: () => this.persist(true),
      import: async (s) => {
        if(this.economy.busy) throw Error("交易正在保存，请稍候。");
        await this.economy.run(()=>this.state,()=>s,save,next=>{this.loaded=next;});
        this.ui.available = true;
        await this.start(true);
      },
      use: (id) => this.use(id),
      pause: () => {
        this.soundFx.silenceFeedback();
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
      this.soundFx.silenceFeedback();
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
      this.xiaobao?.reset();
      this.soundFx.destroy();
      unbindCanvas();
    });
    Object.defineProperty(window, "__farwind", {
      configurable: true,
      value: () =>
        structuredClone({
          state: this.state,
          ground: this.data.get('groundSnapshot')?.(),
          defense: this.defense.snapshot(),
          npcLife: this.life.snapshot(),
          npcLifeView: this.lifeView.snapshot(),
          xiaobao: this.xiaobao?.snapshot(),
          defenseSaving: this.defenseSaving,
          defenseCheckpointPending: this.defenseCheckpointPending,
          ...(import.meta.env.DEV?{dayNight:{phase:lightAt(this.state.time),lights:this.dayNight.visibleLights,draws:this.dayNight.draws,loops:this.soundFx.loops.length,loopGains:this.soundFx.loops.map(l=>l.gain.gain.value),objects:this.children.length,textures:this.textures.getTextureKeys().length}}:{}),
          attackSerial: this.attackSerial,
          skillGrowth:{...this.lessons?.snapshot(),enemies:this.enemies.map(e=>({id:e.id,x:e.x,y:e.y,hp:e.hp,disabled:!!e.disabled})),contacts:this.swordWind.events.map(e=>({kind:e.kind,reason:e.reason,target:e.target?.id,at:e.at,point:e.point,release:e.wind.releaseId})),sim:this.sim,combatStage:this.combat.attack?.stage??0,ability:this.lessons?.config()?.name??null,water:this.swordWindView?.water.snapshot(),winds:this.swordWind.snapshot(),objects:this.children.length,textures:this.textures.getTextureKeys().length},
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
                feedback:{...this.feedback.snapshot(),visual:this.feedbackView?.snapshot(),audio:this.soundFx.diagnostic(),frames:this.feedbackFrames},
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
                  enemies:this.enemies.map(e=>({id:e.id,type:e.type,hp:e.hp,art:this.enemyView.debug(e.sprite)})),
                  practice:this.practiceSprite?this.enemyView.debug(this.practiceSprite):null,
                  projectiles:this.enemyProjectiles.shots.map(s=>({id:s.id,x:s.x,y:s.y,state:s.state,deflected:s.deflected})),
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
          wilderness:{active:this.enemies.filter(e=>encounterUnit(e.id)&&e.hp>0).length,south:regionalThreat(this.state.encounters,"south")},
          enemies: this.enemies.map((e) => ({
            id: e.id,
            x: e.x,
            y: e.y,
            hp: e.hp,
            type:e.type,
            behavior:{elite:e.elite,face:e.face,guardOpen:Math.max(0,(e.guardOpenUntil??0)-this.sim),attack:e.attack?{direction:e.attack.direction,startedAt:e.attack.startedAt,lockAt:e.attack.lockAt,contactAt:e.attack.contactAt,activeUntil:e.attack.activeUntil,recoveryUntil:e.attack.recoveryUntil,cancelled:e.attack.cancelled}:null,pose:this.enemyView.debug(e.sprite)?.pose},
            ...(import.meta.env.DEV
              ? {
                  art:this.enemyView.debug(e.sprite),
                  wallHit:e.wallHit??null,
                  type:e.type,
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
    syncMapGeometry(this.state.mapProgress.westRoad === "open",this.state.mapProgress.shortcuts,this.state.encounters.broken);
    if (this.blocked(this.state.player.x, this.state.player.y)) {
      const savedRegion = regionAt(this.state.player).id;
      const safe = nearestStanding(
        this.state.player,
        [
          { x: 670, y: 720 },
          ...VILLAGE_PORTALS.filter((p) => p.open || this.state.mapProgress.westRoad === "open").flatMap((p) => [
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
    this.xiaobao?.reset();
    this.waterEffects?.reset();
    resetSessionTimers(this);
    this.nextNightAttempt=0;
    this.commitInputSuspended=false;
    this.defense = new EastDefense(this.state.defense, this.sim);
    this.life=new NpcLife(this.state,this.defense);
    this.xiaobao?.controller.bind(this.state.xiaobao,true);this.wireXiaobao();this.xiaobaoRecent=null;
    this.combat.reset(this.state.dashCooldownRemaining);
    this.clearSwordWind();this.lessons?.reset();
    this.syncSwordWindAbility();
    this.practice.reset();
    this.enemyProjectiles.reset();this.enemyView.reset();
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
    this.wilderness=new WildernessEncounters({
      read:()=>this.state.encounters,bodies:()=>this.enemies,
      signal:d=>this.ui.message(`${d.name}正在接近，注意地面预兆。`),
      spawn:(d,u)=>{const e=this.makeEnemy(d);Object.assign(e,{elite:d.elite,hp:u.hp,x:u.x,y:u.y,attackSerial:u.serial,cool:this.sim+u.cooldown,face:{...u.face},guardOpenUntil:this.sim+u.guardOpen,leashRadius:ENCOUNTERS.find(g=>g.id===encounterUnit(d.id)!.group)!.radius});validateEnemyPosition(e);this.enemies.push(e);},
      release:id=>{const e=this.enemies.find(e=>e.id===id);if(!e)return;e.sprite.destroy();e.shadow.destroy();this.enemyBlades.get(id)?.destroy();this.enemyBlades.delete(id);this.enemies=this.enemies.filter(e=>e.id!==id);},
      busy:id=>this.encounterBusy(id),
    });
    this.wilderness.restore(this.state.life.playerSpace==="village"?this.state.player:this.state.life.outside);
    for(const saved of this.state.xiaobao.affected){const enemy=this.enemies.find(e=>e.id===saved.id);if(enemy){Object.assign(enemy,{hp:saved.hp,x:saved.x,y:saved.y,staggerUntil:this.sim+saved.control,staggerSince:this.sim,companionControlGrace:this.sim+saved.control+saved.controlGrace,companionControlLimit:this.sim+saved.controlLimit});validateEnemyPosition(enemy);}}
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
      this.defense.rebind(next.defense);this.life.rebind(next,this.defense);this.xiaobao?.controller.bind(next.xiaobao);
      if(request.kind === "rest") this.sprint.reset(next.player.stamina);
      this.refresh();
      this.ui.update(next, "");
      if(request.kind==="sleep")this.afterSleep();
    });
  }
  sleepSafety(){
    const c=this.combat,p=this.state.player;
    return {conflict:this.defenseSaving||this.defenseCheckpointPending,action:!!c.attack||!!c.pending||!!c.parry||this.sim<c.dashUntil||this.sim<this.gatherUntil||!!this.xiaobao?.controller.busy||!!this.xiaobao?.controller.data.support,
      threat:[...this.enemies,...this.defense.enemies].some(e=>e.hp>0&&!e.disabled&&Math.hypot(e.x-p.x,e.y-p.y)<380&&this.clearLine(p.x,p.y,e.x,e.y)),
      projectile:this.defense.arrows.length>0||this.swordWind.winds.length>0||!!this.xiaobao?.controller.data.flight};
  }
  afterSleep(){
    this.clearFeedback();
    this.keys.clear();this.combat.reset(this.sim+this.state.dashCooldownRemaining);this.battleAxis={x:0,y:0};this.runIntent=false;this.pointerAttack=false;this.attackUntil=this.gatherUntil=0;
    this.clearSwordWind();this.slash?.clear();this.slashBack?.clear();this.parryInk?.clear();this.warningInk?.clear();this.parryEffects=[];this.sprint.reset(100);
    this.follower.reset(this.state.player);this.cat.place(this.state.player.x-78,this.state.player.y+18);if(this.blocked(this.cat.sprite.x,this.cat.sprite.y))this.cat.place(this.state.player.x,this.state.player.y);
    this.hero.place(this.state.player.x,this.state.player.y);this.cameras.main.centerOn(this.state.player.x,this.state.player.y-150);this.timeline.reset(performance.now());this.ui.update(this.state,"");this.dayNight.render(true);this.soundFx.ambience(lightAt(this.state.time).lamps,false);
  }
  async persist(notify = false) {
    this.wilderness?.capture(this.sim);
    if(this.economy.busy){if(notify)throw Error("状态正在保存，请稍候。");return;}
    try {
      await this.economy.run(()=>this.state,s=>{
        const next=structuredClone(s);next.dashCooldownRemaining=Math.max(0,this.combat.dashCooldown-this.sim);return next;
      },save,snapshot=>{this.loaded=snapshot;this.defense.acknowledged(snapshot.defense.sequence);this.ui.available=true;if(snapshot.xiaobao.flight)this.xiaobao?.controller.confirmFlight(snapshot.xiaobao.flight.id);});
      if(notify)this.ui.message("旅途已保存");
    }catch(e){this.ui.message((e as Error).message);throw e;}
  }
  publishState(next:State){this.state=next;this.loaded=structuredClone(next);this.ui.state=next;this.ui.available=true;this.defense.rebind(next.defense);this.life.rebind(next,this.defense);this.xiaobao?.controller.bind(next.xiaobao);this.refresh();this.ui.update(next,"");}
  xiaobaoUnderRoof(p:{x:number;y:number}){return props.some(prop=>['house','shop','smith-building','inn-building'].includes(prop.art)&&p.x>prop.x-prop.w/2&&p.x<prop.x+prop.w/2&&p.y>prop.y-prop.h&&p.y<prop.y);}
  wireXiaobao(){
    this.defense.companionTarget=()=>{const c=this.xiaobao?.controller;return c?.available?{id:'xiaobao',x:c.x,y:c.y,hp:c.data.hp}:undefined;};
    this.defense.protection=id=>this.xiaobao?.controller.protection(id)??{};
    this.defense.companionContact=(source,contact)=>this.receiveXiaobao(contact,source);
  }
  checkpointXiaobaoFlight(id:string){
    void this.persist(true).then(()=>{if(this.xiaobao?.controller.data.flight?.id===id)this.ui.message('村庄危急，小宝将踏风飞援。');})
      .catch(e=>{this.ui.open('pause');this.ui.message(`飞援尚未保存，已暂停：${(e as Error).message}`);});
  }
  receiveXiaobao(contact:EnemyContact,source:EnemyBody){
    const c=this.xiaobao?.controller;if(!c)return false;
    return c.receive(contact,source,event=>{const target={id:'xiaobao',hp:c.data.hp,faction:'village' as const,armor:12,...c.protection('xiaobao')},shot=contact.projectileId?this.enemyProjectiles.shots.find(s=>s.id===contact.projectileId):undefined;
      return shot?resolveReleasedDamage(event,shot.released,target):resolveDamage(event,{id:source.id,hp:source.hp,faction:'hostile',armor:0},target);},this.sim);
  }
  enemyVictim(e:EnemyBody){
    const outside=this.state.life.playerSpace==='village',player=outside?this.state.player:{x:-10000,y:-10000,hp:0},c=this.xiaobao?.controller;
    if(e.attack&&e.targetId==='xiaobao'&&c?.available)return {point:c,id:'xiaobao'};
    if(e.attack&&e.targetId==='player'&&player.hp>0)return {point:player,id:'player'};
    const d=c?.available?Math.hypot(c.x-e.x,c.y-e.y):Infinity,engaged=(e.companionAggroUntil??0)>this.sim;
    if(c?.available&&d<380&&clearMeleeLine(e,c)&&(engaged||e.targetId==='xiaobao'||d<Math.hypot(player.x-e.x,player.y-e.y)))return {point:c,id:'xiaobao'};
    return {point:player,id:'player'};
  }
  syncXiaobaoEnemies(){
    const data=this.xiaobao?.controller.data;if(!data)return;
    if(!data.affected.length&&!data.cast&&!data.effects.length)return;
    const tracked=new Set(data.affected.map(e=>e.id));
    // 正在施法／已释放的目标即使尚未受击，也必须保持生命与位置；
    // 否则读档会把目标重建到家园，改变已经发出的弹道或领域结算。
    for(const cast of [...(data.cast?[data.cast]:[]),...data.effects]){
      if(cast.target)tracked.add(cast.target);
      for(const e of this.enemies){
        const shot=cast.skill==='star'||cast.skill==='blade';
        const field=['rock','fire','unity'].includes(cast.skill);
        const chain=cast.skill==='chain';
        const origin=shot?cast.origin:chain&&'last' in cast?cast.last as {x:number;y:number}:cast.center;
        if((shot||field||chain)&&Math.hypot(e.x-origin.x,e.y-origin.y)<=
          (shot?XIAOBAO_SKILLS[cast.skill].range:chain?XIAOBAO_SKILLS.chain.range:XIAOBAO_SKILLS[cast.skill].radius))tracked.add(e.id);
      }
    }
    data.affected=this.enemies.filter(e=>tracked.has(e.id)&&e.hp>0&&!e.disabled).map(e=>({id:e.id,hp:e.hp,x:e.x,y:e.y,control:Math.min(800,Math.max(0,e.staggerUntil-this.sim)),controlGrace:Math.min(1000,Math.max(0,(e.companionControlGrace??0)-Math.max(this.sim,e.staggerUntil))),controlLimit:Math.min(800,Math.max(0,(e.companionControlLimit??this.sim)-this.sim)),space:'village' as const}));
  }
  xiaobaoHit(e:EnemyBody,event:DamageEvent,released:ReleasedAttack,control:number,knock:number,task:XiaobaoTask,at:number){
    const before=e.hp,applied=this.defense.damageEnemy(e as typeof this.enemies[number],event,released),killed=applied&&e.hp===0;
    if(!applied)return {applied:false,killed:false,damage:0};
    const member=unitState(this.state.encounters,e.id);if(member&&task==="follow")member.participated=true;
    e.companionAggroUntil=at+2500;
    if(control>0)companionControl(e,at,control);
    if(knock>0){const c=this.xiaobao!.controller,n=Math.max(.001,Math.hypot(e.x-c.x,e.y-c.y));sweepMove(e,(e.x-c.x)/n*knock,(e.y-c.y)/n*knock,motionBlocked,clearMotionLine);e.nav.path=[];}
    const fixed=this.enemies.find(f=>f===e),data=this.xiaobao!.controller.data;
    if(fixed){
      if(killed){
        this.recordEnemyDefeat(fixed,task==='follow'?'companion':'guard');
        data.affected=data.affected.filter(t=>t.id!==e.id);
      }else if(!data.affected.some(t=>t.id===e.id))data.affected.push({id:e.id,hp:e.hp,x:e.x,y:e.y,control:Math.min(800,Math.max(0,e.staggerUntil-at)),controlGrace:1000,controlLimit:Math.min(800,Math.max(0,(e.companionControlLimit??at)-at)),space:'village'});
    }
    return {applied:true,killed,damage:before-e.hp};
  }
  async configureXiaobao(change:Partial<Pick<State['xiaobao'],'task'|'gate'|'tactic'|'autoSupport'>>){
    const oldTask=this.state.xiaobao.task,oldGate=this.state.xiaobao.gate;
    await this.economy.run(()=>this.state,s=>{const next=structuredClone(s);Object.assign(next.xiaobao,change,{known:true});
      if(change.task&&change.task!==s.xiaobao.task||change.gate&&change.gate!==s.xiaobao.gate){if(next.xiaobao.cast&&!next.xiaobao.cast.released){next.xiaobao.cast=null;next.xiaobao.recovery=Math.max(300,next.xiaobao.recovery);}next.xiaobao.command=null;next.xiaobao.wait=null;}
      return next;},save,next=>{this.publishState(next);if(oldTask!==next.xiaobao.task||oldGate!==next.xiaobao.gate)this.xiaobao!.controller.taskChanged();});
  }
  showDemonKingIntroduction(){
    if(this.ui.paused||this.economy.busy||this.defenseSaving||this.defenseCheckpointPending||!demonMalice(this.state.encounters)||this.state.demonKing.introduced||this.state.defense.raid)return false;
    const safety=this.sleepSafety();if(safety.action||safety.threat||safety.projectile)return false;
    this.ui.dialog(DEMON_KING.name,`${DEMON_KING.firstAppearance}\n\n「${DEMON_KING.firstWords}」\n\n你还不知道它的名字。清剿让当地安静下来，却也引来了远处的注视。`,'demon-king',()=>{
      void this.economy.run(()=>this.state,demonKingIntroduction,save,next=>this.publishState(next)).catch(e=>{this.ui.open('pause');this.ui.message('初见记录尚未保存，已暂停：'+(e as Error).message);});
    });
    return true;
  }
  async startNightRaid(){
    this.nextNightAttempt=this.sim+RAID_TIMING.retry;
    try{
      const v=this.cameras.main.worldView;
      await this.economy.run(()=>this.state,s=>{const occupied=this.enemies.filter(e=>e.hp>0&&!e.disabled),view={left:v.x,right:v.right,top:v.y,bottom:v.bottom};return nightWarningSnapshot(s,view,occupied,this.defense);},save,next=>this.publishState(next));
      const raid=this.state.defense.raid!;
      this.ui.message(raid.order?.source==='demon-king'?`${DEMON_KING.name}的部队接近村门，共 ${raid.members.length} 只；防线可能需要支援。`:"村门外发现动静，卫队正在戒备；可以参与或继续旅行。");
    }catch(e){
      // 同一个计划重试，失败不发布预警、不消费序号、不生成敌人。
      this.state.defense.retryMs=RAID_TIMING.retry;
      if(!(e instanceof RaidDeferredError))this.ui.open("pause");
      this.ui.message(e instanceof RaidDeferredError?"今晚的来袭暂缓："+e.message:"预警尚未保存，已暂停："+(e as Error).message);
    }
  }
  async discoverNight(){
    if(this.economy.busy)return;
    try{await this.economy.run(()=>this.state,discoverySnapshot,save,next=>this.publishState(next));
      this.ui.dialog("临水夜风","小黑循着微光停在草坡，轻轻碰了碰你的手。风从水面吹来，像是在说：无论走多远，总有一盏灯等你回家。\n获得恢复药剂 ×1。","cat");
    }catch(e){this.ui.message((e as Error).message);}
  }
  openDefenseDrill() {
    this.ui.dialog("东门驻防", "岑风和青禾守住通路两侧，弦雨在塔上警戒。门洞保持畅通，门外道路是巡逻近郊，往远处才进入森林。首夜安静；后续夜晚需冷却结束、三名卫兵健康返岗，才可能来袭。恶意为零时有1～3只；清剿据点引起黑焰回应后，恶意1～9时增加5只，后续逐步加入精英。清剿仍会阻止当地巡游和当地来源入侵。");
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
      await this.economy.run(()=>this.state,s=>{const next=structuredClone(s);next.defense=prepareEastRaid(next.defense,next.player);return next;},save,next=>{this.publishState(next);this.defense=new EastDefense(next.defense,this.sim);this.life.rebind(next,this.defense);this.life.restore();this.wireXiaobao();});
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
      this.xiaobao?.reset();
      this.soundFx.silenceFeedback();
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
    const cleared=this.state.encounters.groups["south-spore-camp"].cleared;this.propImages.get("south-camp-root")?.setTexture(cleared?"wood":"bush").setDisplaySize(cleared?115:180,cleared?65:135);
    for(const d of ENCOUNTERS.filter(d=>d.kind==="camp"&&d.direction!=="south")){const cleared=this.state.encounters.groups[d.id].cleared;this.propImages.get(`camp-root-${d.id}`)?.setTexture(cleared?"wood":"bush").setAlpha(cleared?.65:1);}
    syncMapGeometry(this.state.mapProgress.westRoad === "open",this.state.mapProgress.shortcuts,this.state.encounters.broken);
    for(const p of ARENA_STONES){const broken=this.state.encounters.broken.includes(p.id);this.propImages.get(p.id)?.setDisplaySize(p.w,broken?35:p.h).setAlpha(broken?.55:1);}
    for(const s of SHORTCUTS)this.propImages.get(`barrier-${s.id}`)?.setVisible(!this.state.mapProgress.shortcuts.includes(s.id)&&this.state.life.playerSpace==="village");
    this.propImages.get("west-gate-barrier")?.setVisible(this.state.mapProgress.westRoad !== "open" && this.state.life.playerSpace === "village");
    this.xiaobao?.render(this.active && this.state.life.playerSpace === "village",xiaobaoAllies(this));
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
  makeEnemy(d:{id:string;type:string;elite?:EliteKind;x:number;y:number}):Enemy {
    return {
        kind: "enemy" as const,
        id: d.id,
        x: d.x,
        y: d.y,
        homeX: d.x,
        homeY: d.y,
        type: d.type,elite:d.elite,
        hp: creatureMaxHP(d.type,d.elite),
        cool: 0,
        windup: 0,
        flashUntil: 0,
        staggerUntil: 0,
        nav: enemyNavigation(),
        ai: "家园",
        disabled: false,
        recovered: false,
        sprite: this.add
          .sprite(d.x, d.y, `enemy-${d.type}`, 0)
          .setOrigin(0.5, 1)
          .setDisplaySize(75, 75),
        shadow: this.add.ellipse(d.x, d.y, 45, 15, 0x18392d, 0.2),
    };
  }
  spawnEnemies() {
    this.enemies.forEach((e) => {
      e.sprite.destroy();
      e.shadow.destroy();
    });
    this.enemies = enemyDefs.filter(d=>!encounterUnit(d.id))
      .filter((d) => !this.state.killed.includes(d.id))
      .map((d) => this.makeEnemy(d));
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
  encounterBusy(id:string){
    const e=this.enemies.find(e=>e.id===id),x=this.state.xiaobao;
    return !!(e&&e.hp>0&&this.defense.manages(e))||x.affected.some(v=>v.id===id)||x.cast?.target===id||x.effects.some(v=>v.target===id||this.enemies.some(e=>e.id===id&&Math.hypot(e.x-v.center.x,e.y-v.center.y)<800))||this.enemyProjectiles.shots.some(s=>s.state==="flying"&&s.attack.attackerId===id);
  }
  worldDrops(){
    return [...this.state.pendingDrops,...ENCOUNTERS.flatMap(d=>d.members.flatMap(m=>{const u=unitState(this.state.encounters,m.id)!;return u.drop?[{enemyId:m.id,item:enemyProfile(m.type).drop,x:u.x,y:u.y}]:[];}))];
  }
  recordEnemyDefeat(e:Enemy,source:"player"|"companion"|"guard"){
    e.sprite.setVisible(false);e.shadow.setVisible(false);if(e.attack)e.attack.cancelled=true;
    const definition=encounterUnit(e.id),direct=source!=="guard",item=enemyProfile(e.type).drop;
    const legacy=enemyDefs.some(d=>d.id===e.id);
    if(definition){
      const group=this.state.encounters.groups[definition.group],wasCleared=group.cleared;
      if(!settleEncounterDeath(this.state.encounters,e.id,direct&&!legacy))return;
      const u=unitState(this.state.encounters,e.id)!;u.x=e.x;u.y=e.y;
      if(!legacy&&direct&&add(this.state,item,1)){u.drop=false;u.dropRemaining=0;this.soundFx.play("pick");}
      if(!wasCleared&&group.cleared&&ENCOUNTERS.find(d=>d.id===definition.group)!.kind==="camp"){
        const d=ENCOUNTERS.find(d=>d.id===definition.group)!;this.ui.message(`${d.name}已清理，当地巡游与当地来源来袭停止。${DEMON_KING.name}的恶意 +1，当前 ${demonMalice(this.state.encounters)}。`);this.refresh();
      }
    }
    if(legacy||!definition){
      if(this.state.killed.includes(e.id))return;this.state.killed.push(e.id);
      if(direct&&add(this.state,item,1)){if(item==="crystal"&&this.state.quest===3)this.state.quest=4;this.soundFx.play("pick");}
      else if(direct||item==="crystal")this.state.pendingDrops.push({enemyId:e.id,item,x:e.homeX,y:e.homeY});
    }
    this.soundFx.creature(e.type,"death",Math.hypot(e.x-this.state.player.x,e.y-this.state.player.y),this.sim);
    this.state.xiaobao.affected=this.state.xiaobao.affected.filter(t=>t.id!==e.id);
    this.syncDrops();this.defense.critical=true;
  }
  syncDrops() {
    for (const [id, image] of this.dropImages)
      if (!this.worldDrops().some((d) => d.enemyId === id)) {
        image.destroy();
        this.dropImages.delete(id);
      }
    for (const d of this.worldDrops())
      if (!this.dropImages.has(d.enemyId))
        this.dropImages.set(
          d.enemyId,
          this.add
            .text(
              d.x,
              d.y - 32,
              `${items[d.item].name} · E`,
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
    for (const d of this.worldDrops())
      this.dropImages
        .get(d.enemyId)
        ?.setPosition(d.x, d.y - 32)
        .setDepth(d.y + 1);
  }
  claimDrop() {
    const p = this.state.player;
    const d = this.worldDrops().find(
      (v) =>
        Math.hypot(v.x - p.x, v.y - p.y) < 95 &&
        this.clearLine(p.x, p.y, v.x, v.y),
    );
    if (!d) return false;
    if (!add(this.state, d.item, 1)) {
      this.ui.message("行囊已满，请整理后再领取。");
      return true;
    }
    const member=unitState(this.state.encounters,d.enemyId);if(member){member.drop=false;member.dropRemaining=0;}
    this.state.pendingDrops = this.state.pendingDrops.filter(
      (v) => v.enemyId !== d.enemyId,
    );
    this.syncDrops();
    this.soundFx.play("pick");
    this.ui.message(`领取${items[d.item].name} ×1`);
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
      const red=!!b.counter&&feedbackVisual(this.feedback.mode);
      ink.fillStyle(red?0xf85d53:b.counter ? b.counter==="perfect"?0xfff0bb:0xdcffff : b.stage === 3 ? 0xffdfa3 : 0xdaf9ed, red?alpha*.6:b.counter?Math.min(1,alpha*1.3):alpha);
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
  strikeTarget(target: CombatTarget, stage: number, attack: Attack,feedback?:StrikeFeedback,feedbackTarget?:CombatTarget) {
    if(target.kind==='enemy'||target.kind==='defense-enemy')this.xiaobaoRecent={id:target.id,at:this.sim};
    if (target.kind === "defense-enemy") {
      const move=attackConfig(attack);
      if(this.defense.damageEnemy(target,{sourceId:"player",targetId:target.id,attackId:`player:${this.combat.epoch}:${attack.start}:${stage}`,
        amount:feedback?.damage??outgoingDamage(this.state,move.damage),sourceType:stage===4||attack.delivery==='wind'?"player-wind":"player-melee",eventId:target.eventId,origin:{x:this.state.player.x,y:this.state.player.y},breaksGuard:stage===3||!!attack.counter},this.state.player.hp)) {
        this.hitFeedback(stage,"enemy",feedback?.stop,!!attack.counter);this.counterHit(target,attack,'hit',feedback);staggerEnemy(target,this.sim,enemyProtection(target,this.state.player,this.sim).reduction>0?0:move.stagger);
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
      this.counterHit(feedbackTarget??target,attack,'straw',feedback);
      const view =
        target === this.training
          ? this.trainingView
          : this.fieldViews[this.fieldTargets.indexOf(target)];
      view.hit(this.sim, damage);
    }
  }
  strikeEnemy(e: Enemy, stage: number,attack:Attack,feedback?:StrikeFeedback) {
    if (e.hp <= 0) return;
    const move = attackConfig(attack);
    const damage = feedback?.damage??outgoingDamage(this.state,move.damage);
    const protection=enemyProtection(e,this.state.player,this.sim,stage===3||!!attack.counter);
    const hit=resolveDamage({sourceId:"player",targetId:e.id,attackId:`player:${this.combat.epoch}:${attack.start}:${stage}`,
      amount:damage,sourceType:stage===4||attack.delivery==='wind'?"player-wind":"player-melee",eventId:null},
      {id:"player",faction:"village",hp:this.state.player.hp,armor:0},{id:e.id,faction:"hostile",hp:e.hp,armor:0,...protection});
    if(!hit.applied)return;
    const member=unitState(this.state.encounters,e.id);if(member)member.participated=true;
    e.hp = hit.hp; e.playerAggroUntil=this.sim+2500;
    if(e.hp>0)this.soundFx.creature(e.type,"hurt",Math.hypot(e.x-this.state.player.x,e.y-this.state.player.y),this.sim);
    this.hitFeedback(stage, "enemy",feedback?.stop,!!attack.counter);
    this.counterHit(e,attack,'hit',feedback);
    e.flashUntil = this.sim + move.flash;
    staggerEnemy(e,this.sim,protection.reduction>0?0:move.stagger);
    this.float(e.x, e.y, String(Math.round(hit.damage)));
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
    const [vx, vy] = attack.windDirection?[attack.windDirection.x,attack.windDirection.y]:facingVector(attack.facing);
    sweepMove(
      e,
      vx * move.knock * (1-protection.reduction),
      vy * move.knock * (1-protection.reduction),
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
    this.recordEnemyDefeat(e,"player");
    void this.persist().catch(() => {});
  }
  emitFeedback(kind:FeedbackKind,id:string,at:number,target?:{id:string;x:number;y:number;type?:string;hp?:number},attack?:Attack,extra:Partial<FeedbackEvent>={}) {
    const p=this.state.player,facing=attack?.facing??this.combat.parry?.facing??this.battleFacing(),[x,y]=facingVector(facing);
    const w=attack?.counter?counterVisual(attack,at,true).weapon!:parryWeapon(facing,1),blade=unit({x:w.tip.x-w.grip.x,y:w.tip.y-w.grip.y});
    const material=target?.type==='slime'||target?.type==='spore'||target?.type==='burrow'?'slime':target?.type&&['leaf','boar','raven','wolf','guardian'].includes(target.type)?'leaf':'straw';
    return this.feedback.emit({id,kind,at,targetId:target?.id??attack?.primaryTarget??'',attackId:attack?`player:${attack.id}`:id,sourceContactId:attack?.sourceContactId,point:{x:p.x+w.tip.x,y:p.y+w.tip.y},incoming:{x,y},blade,deflect:deflectDirection({x,y},blade),quality:attack?.counter??'normal',material,alive:target?.hp===undefined||target.hp>0,depth:(target?.y??p.y)+ (facing===1?-.05:2),...extra});
  }
  counterHit(target:CombatTarget,attack:Attack,legacyHit:'hit'|'straw'='hit',feedback?:StrikeFeedback) {
    if(!attack.counter)return;
    if(attack.delivery==='wind'&&feedback?.point) {
      const d=attack.windDirection!;
      this.emitFeedback('counter-hit',`counter-hit:${attack.id}:${target.id}`,feedback.at??this.sim,target,attack,{point:feedback.point,incoming:{...d},blade:{x:-d.y,y:d.x},depth:target.y+.15,legacyHit});
      return;
    }
    const weapon=counterVisual(attack,this.sim,true).weapon!,touch=parryContactPoint(this.state.player,weapon,{x:target.x,y:target.y-28});
    this.emitFeedback('counter-hit',`counter-hit:${attack.id}:${target.id}`,this.sim,target,attack,{point:touch.point,blade:touch.blade,depth:feedbackContactDepth(this.state.player.y,target.y),legacyHit});
  }
  clearFeedback(){this.feedback.reset(this.sim);this.feedbackView?.clear();this.hurtInk?.clear();this.soundFx.clearFeedback();this.feedbackFrames=[];}
  battleFacing() {
    const a=this.battleAxis;
    return Math.hypot(a.x,a.y)
      ? Math.abs(a.x)>Math.abs(a.y)?a.x<0?2:3:a.y<0?1:0
      : this.combat.effectiveFacing(this.sim,this.combat.intentFacing);
  }
  syncSwordWindAbility(){
    const config=this.lessons?.config()??null;
    this.combat.swordWindConfig=config?{...config,damage:outgoingDamage(this.state,config.damage)}:null;
    this.combat.swordWindEnabled=!!config;
  }
  tickAttack(prev:number,now:number) {
    this.syncSwordWindAbility();
    this.combat.update(prev,now,this.battleFacing(),this.state.player,this.combatTargets(),
      (x,y)=>this.blocked(x,y),(x,y,tx,ty,id)=>this.meleeLine(x,y,tx,ty,id),
      (target,stage,attack)=>this.strikeTarget(target,stage,attack),
      (stage,attack)=>{this.training.sync(this.combat.epoch);this.training.begin(attack);if(attack.counter){const m=attackConfig(attack);this.emitFeedback('counter-start',`counter-start:${attack.id}`,attack.start,undefined,attack,{until:attack.start+m.windup+m.active+m.recovery});}if(stage===4)this.soundFx.play('wind-charge');},
      stage=>{const a=this.combat.attack!;if(a.counter){if(!feedbackAudio(this.feedback.mode))this.soundFx.play('counter');}else this.soundFx.play(stage===4?'wind-release':stage===3?'attack-heavy':'attack');},clearMotionLine,
      (attack,root,at)=>this.swordWind.launch(attack,root,at,attack.delivery==='wind'?outgoingDamage(this.state,attackConfig(attack).damage):attack.swordWind!.damage));
  }
  clearSwordWind(){this.swordWind.clear();this.swordWindView?.clear();this.lessons?.endTrial();}
  resolveSwordWind(events:WindEvent[]){for(const event of events){
    if(event.target){
      if(event.target.lessonId)this.lessons?.hit(event);
      else {const w=event.wind,point=w.contact??event.point;this.strikeTarget(event.target as CombatTarget,w.attack.stage,w.attack,{damage:w.config.damage,stop:w.config.hitStop,point:{x:point.x,y:point.y-w.config.art.bodyHeight},at:event.at});}
      if(!event.terminal)this.swordWindView?.hit(event.point,event.at,event.wind);
    }else this.soundFx.play('wind-dissolve');
  }}
  windMotions():WindMotion[]{return [...this.combatTargets(),...(this.state.life.playerSpace==='village'?this.lessons?.targets??[]:[])].map(target=>({target,previous:{x:target.x,y:target.y},current:{x:target.x,y:target.y}}));}

  advanceBattle(prev:number,now:number,contacts:EnemyContact[],budget:{queries:number}) {
    const motion=this.windMotions();
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
    const hurt=this.combat.hurting(prev);
    const busy=!!this.combat.attack||guard||dash||this.combat.pending||hurt;
    const movement=this.sprint.update(p.stamina,this.runIntent&&length>0&&!busy,dash?0:dt,prev>=this.combat.regenUntil);
    p.stamina=movement.stamina;
    const speed=hurt?0:guard?PARRY.speed:busy?this.combat.attack?55:0:movement.speed;
    if(length)sweepMove(p,a.x/length*speed*dt,a.y/length*speed*dt,(x,y)=>this.blocked(x,y),(a,b)=>this.clearLine(a.x,a.y,b.x,b.y));
    const encounterView=this.cameras.main.worldView;
    this.wilderness?.update(now-prev,now,outside?p:this.state.life.outside,{left:encounterView.x,right:encounterView.right,top:encounterView.y,bottom:encounterView.bottom});
    for(const e of this.enemies){const unit=encounterUnit(e.id);if(!unit)continue;const d=ENCOUNTERS.find(g=>g.id===unit.group)!,way=d.patrol[Math.floor(this.state.encounters.elapsed/6000)%d.patrol.length];e.patrolTarget={x:unit.x+way.x-d.patrol[0].x,y:unit.y+way.y-d.patrol[0].y};}
    this.tickAttack(prev,now);
    this.defense.external=this.enemies;
    this.defense.now=now;
    if(this.xiaobao)this.xiaobao.controller.tick(now-prev,xiaobaoEnvironment(this),budget);
    const view = this.cameras.main.worldView;
    contacts.push(...this.defense.update(now,now-prev,battlePlayer,budget,
      outside?{left:view.x,right:view.right,top:view.y,bottom:view.bottom}:undefined,this.enemies.filter(e=>e.hp>0&&!e.disabled)));
    for(const e of this.defense.enemies)this.playEnemyAttack(e.attack,now,e);
    this.life.step(now-prev,budget);
    for(const e of [...this.enemies].sort((a,b)=>a.id.localeCompare(b.id))) {
      const victim=this.enemyVictim(e),event=this.defense.manages(e)?null:updateEnemy(e,victim.point,now,now-prev,budget,victim.id);
      this.playEnemyAttack(e.attack,now,e);
      const stone=arenaImpact(e,this.state.encounters.broken,now);if(stone){this.state.encounters.broken.push(stone);this.refresh();this.defense.critical=true;this.ui.message("裂岩林豕撞碎石障，正在失衡！");}
      if(event&&victim.id==='xiaobao')this.receiveXiaobao(event,e);else if(event&&outside)contacts.push(event);
    }
    const training=outside?this.practice.update(now,p,this.combat):null;
    this.playEnemyAttack(this.practice.attack,now,this.practice.projection??undefined);
    if(training)contacts.push(training);
    this.advanceEnemyProjectiles(now,battlePlayer,contacts,outside);
    for(const m of motion)m.current={x:m.target.x,y:m.target.y};
    this.resolveSwordWind(this.swordWind.advance(prev,now,motion));
    this.syncXiaobaoEnemies();this.wilderness?.capture(now);
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
    this.resolveSwordWind(this.swordWind.advance(now,now,this.windMotions()));
    for(const e of [...this.enemies].sort((a,b)=>a.id.localeCompare(b.id))) {
      const victim=this.enemyVictim(e),event=this.defense.manages(e)?null:updateEnemy(e,victim.point,now,0,budget,victim.id);
      this.playEnemyAttack(e.attack,now,e);
      const stone=arenaImpact(e,this.state.encounters.broken,now);if(stone){this.state.encounters.broken.push(stone);this.refresh();this.defense.critical=true;this.ui.message("裂岩林豕撞碎石障，正在失衡！");}
      if(event&&victim.id==='xiaobao')this.receiveXiaobao(event,e);else if(event)contacts.push(event);
    }
    const training=this.practice.update(now,p,this.combat);
    this.playEnemyAttack(this.practice.attack,now,this.practice.projection??undefined);
    if(training)contacts.push(training);
    this.advanceEnemyProjectiles(now,p,contacts,true);
    this.resolveContacts(now,contacts);
  }
  advanceEnemyProjectiles(now:number,p:{x:number;y:number},contacts:EnemyContact[],outside:boolean){
    for(const e of this.enemies)if(e.hp>0&&!e.disabled&&e.attack)this.enemyProjectiles.launch(e.attack,e,now);
    if(this.practice.projection&&this.practice.attack)this.enemyProjectiles.launch(this.practice.attack,this.practice.projection,now);
    const c=this.xiaobao?.controller,other=c?.available?[{id:'xiaobao',x:c.x,y:c.y}]:[],events=this.enemyProjectiles.update(now,p,clearMeleeLine,other);
    for(const event of events){
      if(event.targetId==='xiaobao'){const source=this.enemies.find(e=>e.id===event.attack.attackerId);if(source)this.receiveXiaobao(event,source);this.enemyProjectiles.settle(event.projectileId!,now,false);}
      else if(outside)contacts.push({...event,training:event.attack.attackerId.startsWith('practice-')});
      else this.enemyProjectiles.settle(event.projectileId!,now,false);
    }
  }
  resolveContacts(now:number,contacts:EnemyContact[],beforeInput=false) {
    const p=this.state.player,ready=contacts.filter(c=>!beforeInput||c.at<now-1e-7);
    for(const c of ready)contacts.splice(contacts.indexOf(c),1);
    for(const contact of orderedContacts(ready)) {
      const e=[...this.enemies,...this.defense.enemies].find(e=>e.id===contact.attack.attackerId);
      const owner=e??(contact.training?this.practice.projection:null);
      const projectile=contact.projectileId?this.enemyProjectiles.shots.find(s=>s.id===contact.projectileId):null;
      const body=contact.projectileId&&(!owner||owner.hp<=0||Math.hypot(owner.x-p.x,owner.y-p.y)>100||!clearMeleeLine(owner,p))?null:owner;
      const valid=contact.projectileId?!!projectile&&projectile.state==='contact'&&projectile.attack===contact.attack&&(!contact.training||this.practice.mode!=="off"):
        contact.training?this.practice.mode!=="off":!!e&&e.hp>0&&!e.disabled&&e.attack?.attackId===contact.attack.attackId&&
        (e.kind==="defense-enemy" || enemyAttackPermitted(e,p));
      const result=adjudicateContact(contact,this.combat,p,{valid,immune:now<this.invulnerable||now<this.respawnInvulnerable,clear:(a,b,id)=>clearMeleeLine(a,b,id),attacker:owner&&owner.hp>0?owner:undefined});
      if(contact.training)this.practice.observe(contact,result,this.combat,p);
      if(result==="normal"||result==="perfect") {
        if(body) {
          if(contact.projectileId&&contact.training&&this.practice.attack)this.practice.attack.cancelled=true;
          body.parried={at:contact.at,until:contact.at+PARRY[result].stagger,direction:{...contact.attack.direction},perfect:result==="perfect"};
          sweepMove(body,-contact.attack.direction.x*PARRY[result].knock,-contact.attack.direction.y*PARRY[result].knock,(x,y)=>this.blocked(x,y),clearMotionLine);
        }
        if(e&&body===e) {
          if(contact.projectileId&&e.attack)e.attack.cancelled=true;
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
          {id:contact.attack.attackerId,hp:contact.projectileId?1:e?.hp??1,faction:"hostile",armor:0},{id:"player",hp:p.hp,faction:"village",armor:0,...this.xiaobao?.controller.protection('player')});
        if(hit.applied) {
          p.hp=hit.hp;
          this.invulnerable=now+850;
          this.combat.takeHit(now,this.combat.effectiveFacing(now,this.hero.direction),contact.attack.direction,p);
          this.gatherUntil=0;
          this.feedback.cancelRelease();
          this.soundFx.play("hit");
          this.float(p.x,p.y,`-${hit.damage}`);
        }
      }
      this.contactHistory.push({at:contact.at,id:contact.attack.attackId,result,parryAge:this.combat.lastParry?contact.at-this.combat.lastParry.start:null,stamina:p.stamina,hp:p.hp,inputAt:this.combat.lastParryRequestAt,startAt:this.combat.lastParry?.start??null,phase:sampleEnemyAttack(contact.attack,contact.at,contact.origin).phase,predicted:this.warnings.find(w=>w.id===contact.attack.attackId)?.predicted??null,direction:{attack:contact.attack.direction,guard:this.combat.lastParry?.facing},rejection:this.combat.lastRejection});
      if(this.contactHistory.length>80)this.contactHistory.shift();
      if(contact.projectileId)this.enemyProjectiles.settle(contact.projectileId,now,result==='normal'||result==='perfect');
    }
  }
  selectPractice(mode:PracticeMode) {
    const target=[this.training,...this.fieldTargets].sort((a,b)=>Math.hypot(a.x-this.state.player.x,a.y-this.state.player.y)-Math.hypot(b.x-this.state.player.x,b.y-this.state.player.y))[0];
    if(Math.hypot(target.x-this.state.player.x,target.y-this.state.player.y)>TRAINING.near){this.ui.message("请先靠近练习木桩");return;}
    this.combat.hurt();
    this.clearFeedback();
    this.enemyProjectiles.shots=this.enemyProjectiles.shots.filter(s=>!s.attack.attackerId.startsWith('practice-'));
    this.practice.select(mode,target,this.sim,this.state.player);
  }
  drawHurt() {
    this.hurtInk??=this.add.graphics();const ink=this.hurtInk.clear(),hurt=this.combat.hurtReaction;
    if(!hurt||this.sim<hurt.start||this.sim-hurt.start>=PLAYER_HURT.sparkLife)return;
    const u=(this.sim-hurt.start)/PLAYER_HURT.sparkLife,alpha=(1-u)**2,d=hurt.direction;
    const x=hurt.root.x-d.x*12,y=hurt.root.y-34-d.y*8,angle=Math.atan2(-d.y,-d.x);
    ink.setDepth(this.state.player.y+2).fillStyle(0xfff2d5,alpha).fillCircle(x,y,4*(1-u)+1);
    // 局部受力射线留在接触位置，不随被击退的地面根移动。
    for(let i=0;i<5;i++) {
      const a=angle+(i-2)*.62,inner=5+u*5,outer=12+u*(i%2?12:18);
      ink.lineStyle(i%2?1.6:2.2,i%2?0xffc17e:0xffeee0,alpha)
        .lineBetween(x+Math.cos(a)*inner,y+Math.sin(a)*inner,x+Math.cos(a)*outer,y+Math.sin(a)*outer);
    }
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
    if(!attack.chargeSound){if(root)this.soundFx.creature(attack.type,'charge',Math.hypot(root.x-this.state.player.x,root.y-this.state.player.y),now);this.emitFeedback('enemy-charge',`charge:${attack.attackId}`,now,undefined,undefined,{attackId:attack.attackId,targetId:attack.attackerId,incoming:{...attack.direction}});attack.chargeSound=true;}
    if(now>=attack.contactAt&&!attack.strikeSound){if(root)this.soundFx.creature(attack.type,'strike',Math.hypot(root.x-this.state.player.x,root.y-this.state.player.y),now);this.emitFeedback('enemy-strike',`strike:${attack.attackId}`,attack.contactAt,undefined,undefined,{attackId:attack.attackId,targetId:attack.attackerId,incoming:{...attack.direction}});attack.strikeSound=true;}
  }
  drawEnemyPose(body:AnimatedEnemy&{id:string},attack:EnemyBody["attack"],sprite:Phaser.GameObjects.Sprite) {
    this.enemyView.draw(body,attack,sprite,this.sim,!body.id.startsWith('practice-')&&Math.hypot(body.x-this.state.player.x,body.y-this.state.player.y)<500);
    const pose=attack&&!attack.cancelled?sampleEnemyAttack(attack,this.sim,body):null;
    if(pose?.phase==="active"&&body.type==="leaf"){
      if(!this.enemyBlades.has(body.id))this.enemyBlades.set(body.id,this.add.graphics());
      const g=pose.geometry,ink=this.enemyBlades.get(body.id)!.setDepth(body.y+.1);
      ink.lineStyle(2,0xe5f1af,.7).lineBetween(g.a.x,g.a.y-30,g.b.x,g.b.y-30);
    }
  }
  drawWarnings() {
    this.warningInk??=this.add.graphics();const ink=this.warningInk.clear().setDepth(8998);if(this.state.life.playerSpace!=="village"){this.warnings=[];return;}
    const sources=[...this.enemies.filter(e=>e.attack&&!e.attack.cancelled&&e.hp>0&&enemyAttackPermitted(e,this.state.player)&&(!this.defense.manages(e)||e.targetId==="player")).map(e=>({root:e,attack:e.attack!})),...this.defense.enemies.filter(e=>e.attack&&!e.attack.cancelled&&e.hp>0&&e.targetId==="player").map(e=>({root:e,attack:e.attack!})),...(this.practice.projection&&this.practice.attack?[{root:this.practice.projection,attack:this.practice.attack}]:[])];
    const threats=[...sources.filter(s=>!s.attack.launched).map(source=>({...source,predicted:predictEnemyContact(source.attack,source.root,this.state.player,this.sim,"homeX" in source.root&&source.root.kind!=="defense-enemy"?enemyAttackSpace(source.root):undefined,Math.max(0,source.root.staggerUntil-this.sim))})),...this.enemyProjectiles.shots.filter(s=>s.state==='flying').map(s=>({root:{...s,staggerUntil:0},attack:s.attack,predicted:this.enemyProjectiles.prediction(s,this.state.player)}))].sort((a,b)=>(a.predicted??Infinity)-(b.predicted??Infinity)||a.attack.attackerId.localeCompare(b.attack.attackerId));
    this.warnings=threats.map(({attack:a,root,predicted})=>({id:a.attackId,predicted,lead:predicted===null?null:predicted-this.sim,quality:warningQuality(predicted===null?null:predicted-this.sim),phase:sampleEnemyAttack(a,this.sim,root).phase}));
    for(const {root,attack} of sources)if(attack.type==='burrow')this.enemyView.warn(root,attack,this.sim);
    if(!this.practice.indicators){this.enemyView.finishWarnings();return;}
    for(let i=0;i<threats.length;i++){
      const {root,attack:a,predicted}=threats[i],hint=this.warnings[i];if(a.cancelled||a.emitted||this.sim>=a.activeUntil)continue;
      if(a.type!=='burrow')this.enemyView.warn(root,a,this.sim);
      const pose=sampleEnemyAttack(a,this.sim,root),perfect=hint.quality==="perfect",normal=hint.quality==="normal",alpha=(i===0?1:.35)*(hint.quality==="none"?.25:1);
      const pause=Math.max(0,root.staggerUntil-this.sim),x=root.x+50,y=root.y-enemyProfile(a.type).height*.7-22,u=predicted===null?pose.warningProgress:Math.max(0,Math.min(1,1-(predicted-this.sim-pause)/(predicted-a.startedAt-pause))),r=10+(1-u)*20;
      ink.lineStyle(1,0xc8d3b5,.4*alpha).strokeCircle(x,y,9);
      ink.lineStyle(perfect?3:normal?2.5:1.2,perfect?0xfff4c7:normal?0xb9f7e5:0xdac49b,(perfect?.95:normal?.85:.45)*alpha).strokeCircle(x,y,r);
      ink.lineStyle(1,0xfff4c7,.6*alpha);for(const sign of [-1,1])ink.lineBetween(x+sign*8,y-3,x+sign*8,y+3);
      if(normal){ink.lineStyle(2,0xb9f7e5,.7*alpha).lineBetween(x-10,y+12,x+10,y+12);}
      if(perfect){ink.lineStyle(1.5,0xffffff,alpha).strokeCircle(x,y,r+3);ink.fillStyle(0xfff5cc,.95*alpha).beginPath().moveTo(x,y-5).lineTo(x+5,y).lineTo(x,y+5).lineTo(x-5,y).closePath().fillPath();}
    }
    this.enemyView.finishWarnings();
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
    const flying=this.xiaobao?.controller;this.soundFx.xiaobaoFlight(this.active&&!this.ui.paused&&!document.hidden&&!this.economy.busy&&!this.defenseSaving&&this.state.life.playerSpace==='village'&&!!flying?.airborne,flying?Math.hypot(flying.x-this.state.player.x,flying.y-this.state.player.y):Infinity);
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
    this.lessons?.checkTrial();
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
    // 原始引擎帧间隔包含长帧；性能诊断不能用平滑值或排除慢帧。
    this.fps.push(1000/Math.max(.001,this.game.loop.rawDelta));
    if(this.fps.length>1200)this.fps.shift();
    if(this.combat.hitStopRemaining>0)this.tweens.pauseAll();
    this.feedback.advance(this.sim,this.combat.attack?.counter?`player:${this.combat.attack.id}`:null,!!this.combat.autoCounter||this.combat.parry?.successAt!==undefined);
    const feedbackEvents=this.feedback.drain();
    this.soundFx.feedbackBatch(feedbackEvents,this.feedback.mode);
    this.swordWindView?.draw(this.sim);this.lessons?.draw(this.sim);
    const hurting=this.combat.hurting(this.sim);
    if (!hurting && !this.combat.attack && !this.combat.parry && this.sim>=this.combat.dashUntil && length)
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
      hurting?0:p.x - oldX,
      hurting?0:p.y - oldY,
      this.sim,
      hurting || !!striking || !!this.combat.parry ||
        this.sim < this.combat.dashUntil ||
        this.sim < this.gatherUntil,
      dt,
      hurting || striking || this.combat.parry ? 0 : a.x,
      hurting || striking || this.combat.parry ? 0 : a.y,
      hurting
        ? hurtVisual(this.combat.hurtReaction!,this.sim)
        : this.combat.parry
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
      !hurting && (this.sim < this.invulnerable ||
        this.sim < this.respawnInvulnerable ||
        this.combat.invulnerable(this.sim))
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
    this.xiaobao?.render(this.state.life.playerSpace==='village',xiaobaoAllies(this));
    const xstatus=document.querySelector<HTMLElement>('#xiaobao-summary');if(xstatus&&this.xiaobao){const c=this.xiaobao.controller;xstatus.textContent=`小宝 · ${c.data.task==='follow'?'随行':c.data.task==='guard'?'守村':'自由'} · ${Math.ceil(c.data.hp)}/640${c.data.rest?' · 调息':c.data.flight?` · 飞援${c.snapshot().eta.toFixed(1)}秒`:''}`;}
    if(this.xiaobao)for(const event of this.xiaobao.controller.drain())this.soundFx.xiaobao(event,Math.hypot(event.point.x-p.x,event.point.y-p.y),this.state.life.playerSpace==='village');
    this.target = [...lifeTargets(this),...(this.state.life.playerSpace==="village"&&this.xiaobao?[this.xiaobao.controller.target()]:[]),...(this.state.life.playerSpace==="village"?props.filter(p=>p.kind!=="npc"):[]),...(this.state.life.playerSpace==="village"&&canDiscover(this.state)?[{...NIGHT_DISCOVERY,art:"",w:0,h:0,kind:"sign" as const}]:[])]
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
    this.enemyView.begin();
    for(const e of this.enemies){if(e.disabled)continue;this.drawEnemyPose(e,e.attack,e.sprite);
      e.shadow.setPosition(e.x,e.y-3).setDepth(e.y-.5).setAlpha(.2*e.sprite.alpha).setVisible(e.sprite.visible);
    }
    this.defense.observerSpace=this.state.life.playerSpace;
    this.defenseView.update(this.defense,this.sim,(e,sprite)=>this.drawEnemyPose(e,e.attack,sprite),this.life);
    this.enemyView.projectile(this.enemyProjectiles,this.sim,this.state.life.playerSpace==="village");
    this.syncDrops();
    const defenseEvents=this.defense.drainNotices();
    this.life.consumeDefense(defenseEvents);
    for(const event of defenseEvents) {
      if(event.kind==="hit"){const e=this.enemies.find(e=>e.id===event.id);if(e&&e.hp>0)this.soundFx.creature(e.type,"hurt",Math.hypot(e.x-p.x,e.y-p.y),this.sim);}
      if(event.kind==="hit"&&event.x!==undefined&&Math.hypot(event.x-p.x,event.y!-p.y)<600)
        this.float(event.x,event.y!,`-${event.damage}`);
      if(event.kind==="death"&&this.state.defense.guards.some(g=>g.id===event.id))this.ui.message("守卫阵亡；不会因读档自动复活。");
      if(event.kind==="death"){const enemy=this.enemies.find(e=>e.id===event.id);if(enemy)this.recordEnemyDefeat(enemy,"guard");}
      if(event.kind==="warning")this.ui.message(`${event.id}外发现动静，卫队正在戒备。`);
      if(event.kind==="started")this.ui.message(this.state.defense.raid?.order?.source==='demon-king'?`${event.id}遭遇${DEMON_KING.name}的派遣，共 ${this.state.defense.raid.members.length} 只；防线可能需要支援。`:`${event.id}有小怪接近；卫队会自行拦截。`);
      if(event.kind==="delayed")this.ui.message("防线健康、岗位或路径条件已变化；本次未出生来袭已取消并延期。");
      if(event.kind==="ended")this.ui.message("村门来袭已结束，驻防变化正在保存。");
    }
    this.life.observePlayer();this.lifeView.update(this.life,this.sim);
    for(const message of this.life.messages.splice(0))this.ui.message(message);
    this.practiceSprite??=this.add.sprite(0,0,"slime",0).setOrigin(.5,1);
    this.practiceSprite.setVisible(!!this.practice.projection);
    if(this.practice.projection)this.drawEnemyPose(this.practice.projection,this.practice.attack,this.practiceSprite);
    this.practiceLabel??=this.add.text(0,0,"练习投影",{fontSize:"10px",color:"#a1adaf"}).setOrigin(.5,1);
    this.practiceLabel.setVisible(!!this.practice.projection);
    if(this.practice.projection)this.practiceLabel.setPosition(this.practice.projection.x,this.practice.projection.y-enemyProfile(this.practice.projection.type).height*1.45-24).setDepth(8996);
    this.drawParry();
    this.drawHurt();
    this.feedbackView?.draw(this.sim,this.hero);
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
      this.xiaobao?.controller.transitioned(p);
      this.follower.reset(this.state.player);
      this.cat.place(592, 738);
      this.hero.place(p.x, p.y);
      this.respawnInvulnerable = this.sim + 2000;
      this.ui.message("岚爷爷把你带回广场。行囊与旅途进度都还在。");
      void this.persist().catch(() => {});
    }
    if (this.state.life.playerSpace==="village"&&this.state.quest === 1 && regionAt(p).id === "forest" && !inProtected(p)) {
      this.state.quest = this.state.crafted ? 3 : 2;
      this.ui.dialog(
        "林间异响",
        "小黑竖起耳朵，望向更深的林间。先采集药草和浆果，在行囊中制作一瓶恢复药剂。",
        "cat",
      );
    }
    if (
      this.state.quest === 3 &&
      this.state.killed.some((id) => id.startsWith("leaf") && !this.state.pendingDrops.some(d=>d.enemyId===id&&d.item==="crystal"))
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
    const windWindow=this.combat.swordWindEnabled&&(attack?.stage===3&&this.sim>=attack.start+combat.total(3)-COMBAT.restartWindow||!attack&&combat.nextStage===4&&this.sim<=combat.chainUntil);
    const status=windWindow?combat.pending?'已预约第四击·剑风':'J 接第四击·剑风':attack&&attack.stage<3 ? combat.pending?`已预约第${attack.stage+1}刀`:`J 接第${attack.stage+1}刀` : !attack&&this.sim<=combat.chainUntil&&combat.nextStage>1&&combat.nextStage<=combat.maxStage?`J 接第${combat.nextStage}刀`:combat.autoCounter?"成功 · 自动反斩；J 接第二刀":p.stamina<PARRY.cost?"K · 体力不足":combat.diagnostic(this.sim).status;
    this.ui.parryStatus(status);
    this.ui.swordWind(swordWindSource(this.state),this.lessons?.config()?.name,!!this.lessons?.trial);


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
    else if(!this.showDemonKingIntroduction()&&mayStartNight(this.state)&&this.sim>=this.nextNightAttempt&&!this.economy.busy&&!this.defenseCheckpointPending)void this.startNightRaid();
  }
}
