import {activeHostileCount} from '../systems/combatUnitBudget';
import {observeCombat} from '../systems/combatObservation';
import {bossGroundContains,bossGroundBlocks} from '../systems/meleeGeometry';
import {updateSummonSupport} from '../systems/summonSupport';
import {startWindMemory,endWindMemory,memoryGold} from '../systems/windMemory';
import {ADVENTURE_ROUTES,adventureIndex,type WildernessDirection} from '../../data/maps/windbell/encounters';
import {updateBossEnvironment,defeatBossSummon} from '../systems/bossEnvironment';
import {giftValue,offerWindGift,giftChoiceSnapshot} from '../systems/windGifts';
const xiaobaoLifeCheck=typeof location!=='undefined'&&new URLSearchParams(location.search).has('xiaobaoLifeCheck');
import {encounterDefinitions} from '../systems/encounterState';
import {requestXiaobaoTask} from '../systems/xiaobaoLife';
import {CatCompanion,catCareSnapshot} from '../systems/catCompanion';
import {CatCompanionView} from '../entities/catCompanionView';
import {catBenefits,catStage,CAT_STAGES,type CatCare} from '../systems/catBond';
import {legacyEncounterEnabled,updateLegacyDevice} from '../systems/windLegacy';
import {WindAim} from '../systems/windAim';
import {creditCombatCoins,settleEncounterCoins,combatResourceDrop} from '../systems/combatCoins';
import {BuildTraining,nearBuildTraining} from '../systems/buildTraining';
import {momentumConfig,returnMode} from '../systems/runeState';
import {isWindAttack,isMeleeFinisher} from '../systems/combat';
import {SOUTH_EVENTS,type SouthEventId} from '../systems/southEvents';
import {INTERIOR_ASSETS} from '../../data/villageInteriors';
import {refreshFungalShields,takeFungalBlast,fungalBlastContact,validFungalBlastContact,FUNGAL} from '../systems/fungalCombat';
import {RuneWorld} from '../systems/runeWorld';
import type {RuneEvent} from '../systems/runeCombat';
import {arenaImpact} from "../systems/eliteArena";
import { RETURN_WIND_ORB } from "../../data/economy";
import {ARENA_STONES,creatureMaxHP,type EliteKind} from "../../data/maps/windbell/elites";
import {enemyProtection} from '../systems/enemyTraits';
import {reactToEnemyHit} from '../systems/enemyReaction';
import {playerAttackPermitted} from '../systems/encounterTempo';
import {DEMON_KING,retaliationSummary} from '../../data/demonKing';
import {demonMalice,demonKingIntroduction} from '../systems/demonKingState';
import {regionalThreat} from "../systems/wildThreat";
import {ENCOUNTERS,ENCOUNTER_LIMITS,encounterUnit} from "../../data/maps/windbell/encounters";
import {WildernessEncounters} from "../systems/encounterRuntime";
import {CAMP_BOSSES,BOSS_RULES,type CampBossKind} from '../../data/maps/windbell/campBosses';
import {BossHazards,captureBossCombat,restoreBossCombat,clearBossPendingAttacks} from '../systems/campBossCombat';
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
import {lifeTargets,attachLifeUi,showNotes,enterShop} from '../ui/npcLife';
import {spaceBlocked,spaceClear} from '../systems/npcNavigation';
import {CombatFeedback,feedbackVisual,feedbackAudio,hitFeedbackKind,feedbackContactDepth,parryContactPoint,deflectDirection,unit,type FeedbackKind,type FeedbackEvent} from "../systems/combatFeedback";
import {CombatFeedbackView} from "../entities/combatFeedbackView";
import { economySnapshot, outgoingDamage, incomingDamage, movementSpeed, type EconomyRequest } from "../systems/economy";
import { EastDefense, prepareEastRaid, type DefenseEnemy } from "../systems/defense";
import { resolveDamage,resolveReleasedDamage,resolveBlastDamage } from "../systems/damage";
import { DefendersView } from "../entities/defenders";
import { NPC_WALK } from "../systems/npcAnimation";
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
  navigationBudget,
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
import { advanceNight,mayStartNight,nightWarningSnapshot,mayStartRetaliation,retaliationWarningSnapshot,RaidDeferredError } from "../systems/nightDirector";
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
import { playerVitals, recordRunDistance } from '../systems/journeyTraining';
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
import { springSnapshot } from "../systems/villageSpring";
import { makeTerrain } from "../systems/terrain";
import Phaser from "phaser";
import { props, roads, enemyDefs, region, type Prop } from "../../data/world";
import { VILLAGE_HOUSE_ART } from "../../data/villageHouseArt";
import { items, type ItemId } from "../../data/content";
import {
  COMBAT_ACTION_ART,
  combatVisual,
  swordWindVisual,
  weaponSample,
  settleVisual,
  parryVisual,
  alertVisual,
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
import { save, load, switchSaveSession, saveDiagnostic, markSaveDirty } from "../systems/save";
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
type StrikeFeedback = {catBoost?:boolean;runeEvent?:RuneEvent;damage:number;stop?:number;point?:{x:number;y:number};at?:number};
export class World extends Phaser.Scene {
  runes?:RuneWorld;
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
  economy = new StateCommit(()=>{this.commitInputSuspended=true;this.snapshotSerial++;},()=>{this.battleAxis=this.keys.axis();this.runIntent=this.keys.held.has(" ");this.keys.pressed.clear();this.keys.drain();this.commitInputSuspended=false;this.timeline.reset(performance.now());});
  nextNightAttempt=0;
  commitInputSuspended=false;
  snapshotSerial=0;
  snapshotCapture:Promise<void>|null=null;
  snapshotPending=false;
  nextSnapshot=0;
  sessionStarting=false;
  combatNumbers=true;
  combatShake=.35;
  defense = new EastDefense(this.state.defense, 0);
  defenseView!: DefendersView;
  life=new NpcLife(this.state,this.defense);
  lifeView!:NpcLifeView;
  xiaobao?: XiaobaoView;
  xiaobaoRecent: {id:string;at:number}|null=null;
  defenseSaving = false;
  defenseCheckpointPending = false;
  defenseRetryAt=0;
  hero!: Actor;
  windAim=new WindAim();
  legacyDeviceArmed=false;legacyDeviceSaving=false;
  scopeMarker?:Phaser.GameObjects.Graphics;
  cat!: Actor;
  catCompanion = new CatCompanion();
  catView?: CatCompanionView;
  catSpace = '';
  catCareUntil = 0;
  propImages = new Map<string, Phaser.GameObjects.Image>();
  waterEffects?: WaterEffects;
  enemies: Enemy[] = [];
  wilderness?:WildernessEncounters;
  enemyView!:EnemyView;
  enemyProjectiles=new EnemyProjectiles();
  bossHazards=new BossHazards();
  training = new TrainingDummy();
  buildTraining=new BuildTraining(this);
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
  contactHistory: {at:number;id:string;skill?:number;part?:number;result:string;parryAge:number|null;stamina:number;hp:number;inputAt:number|null;startAt:number|null;phase:string;predicted:number|null;direction:unknown;rejection:string}[] = [];
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
  cameraIndoor = false;
  fps: number[] = [];
  obstacleDebug?: Phaser.GameObjects.Text;
  obstacleRoots?: Phaser.GameObjects.Graphics;
  motionDebug?: Phaser.GameObjects.Text;
  motionRoots?: Phaser.GameObjects.Graphics;
  dropImages = new Map<string, Phaser.GameObjects.Text>();
  slash?: Phaser.GameObjects.Graphics;
  slashBack?: Phaser.GameObjects.Graphics;
  windTrail?: Phaser.GameObjects.Graphics;
  constructor(key="World") {
    super(key);
  }
  preload() {
    Actor.preloadScope(this);
    WindLessons.preload(this);
    for(const id of INTERIOR_ASSETS) this.load.image(`interior-${id}`, `/assets/village-interiors/${id}.webp`);
    for (const [id, texture] of Object.entries(VILLAGE_HOUSE_ART))
      this.load.image(texture, `/assets/village-houses/${id}.webp`);
    RuneWorld.preload(this);
    XiaobaoView.preload(this);
    EnemyView.preload(this);
    WaterEffects.preload(this);
    this.load.image("life-bed", "/assets/npc-life/bed.png");
    this.load.image("life-table", "/assets/npc-life/table.png");
    for (const id of ["elder", "healer", "carpenter"])
      this.load.spritesheet(`${id}-work`, `/assets/npc-life/${id}-work.png`, { frameWidth: 128, frameHeight: 128 });
    for (const id of NPC_WALK.ids)
      this.load.spritesheet(`npc-motion-${id}`, `/assets/npc-life/motion/${id}-walk.png`,
        { frameWidth: NPC_WALK.frameSize, frameHeight: NPC_WALK.frameSize });
    this.load.image("defender-guard","/assets/village-defense/m3/guard-source.png");
    this.load.spritesheet("defender-guard-walk", "/assets/village-defense/m3/guard-walk.png",
      { frameWidth: NPC_WALK.frameSize, frameHeight: NPC_WALK.frameSize });
    this.load.image("defender-archer","/assets/village-defense/m3/archer-source.png");
    this.load.image("defender-vertical", "/assets/village-defense/m4/archer-vertical-candidate.png");
    this.load.image("east-watchtower","/assets/village-defense/m3/watchtower-candidate.png");
    this.load.spritesheet('hero-melee-finisher','/assets/animation/hero-melee-finisher.png',{frameWidth:160,frameHeight:160});
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
        .image(p.displayAt?.x ?? p.x, p.displayAt?.y ?? p.y, VILLAGE_HOUSE_ART[p.id] ?? p.art, p.frame ?? 0)
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
    this.runes=new RuneWorld(this);
    this.events.once('shutdown',()=>{this.runes?.destroy();this.runes=undefined;});
    this.events.once('shutdown',()=>this.clearSwordWind());
    this.cat = new Actor(this, 720, 740, true);
    this.catView = new CatCompanionView(this);
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
      catCare:kind=>this.careForCat(kind),
      catCareReason:()=>this.catCareReason(),
      catStatus:()=>this.catStatus(),
      runeChange:r=>this.runes!.change(r),
      runeLock:()=>this.runes?.lock()??'',
      runeA:()=>outgoingDamage(this.state,STRIKES[0].damage),
      presentation:(numbers,shake)=>{this.combatNumbers=numbers;this.combatShake=shake?.35:0;},
      xiaobao:()=>this.xiaobao?.open(this),
      canMutate:()=>!this.economy.busy&&!this.defenseSaving&&!this.sessionStarting,
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
      enterShop: (id) => enterShop(this,id),
      pause: () => {
        this.runes?.cancelReturn();
        this.soundFx.silenceFeedback();
        this.waterEffects?.pause();
        this.soundFx.ambience(0,false);
        this.keys.clear();
        this.combat.clearInputs('暂停或失焦',this.sim);this.windAim.clear();
        for(const enemy of [...this.enemies,...this.defense.enemies])enemy.recoil=undefined;
        this.battleAxis={x:0,y:0};
        this.runIntent=false;
        this.timeline.reset(performance.now());
      },
      practice: (mode) => this.selectPractice(mode),
      trainBuild:()=>{if(nearBuildTraining(this.state.player))this.buildTraining.open();},
      indicators:(value)=>this.practice.indicators=value,
      memoryStart:direction=>this.changeWindMemory(direction),
      memoryEnd:()=>this.changeWindMemory(),
      giftSaved:receipt=>!!this.loaded?.windGifts.pending.some(c=>c.receipt===receipt),
      giftChoose:async(receipt,id,replace)=>{if(!this.loaded?.windGifts.pending.some(c=>c.receipt===receipt))throw Error('候选尚未保存，请先保存旅途。');await this.economy.run(()=>this.state,s=>giftChoiceSnapshot(s,receipt,id,replace),save,next=>this.publishState(next));},
      getIndicators:()=>this.practice.indicators,
      volume: (v) => (this.soundFx.volume = v),
      getVolume: () => this.soundFx.volume,
      title: () => void this.toTitle(),
    };
    this.keys.enabled=()=>this.active&&!this.ui.paused&&!this.defenseSaving&&!this.sessionStarting&&!Boolean(this.economy.busy);
    this.combatNumbers=this.ui.hudPreferences.combatNumbers;this.combatShake=this.ui.hudPreferences.combatShake?.35:0;
    if(import.meta.env.DEV&&new URLSearchParams(location.search).has("dayNightDebug"))void import("../systems/dayNightDebug").then(m=>m.installClockDebug(this));
    if(import.meta.env.DEV&&new URLSearchParams(location.search).has('runeLab'))void import('../systems/runeLab').then(m=>m.installRuneLab(this));
    if(import.meta.env.DEV&&(new URLSearchParams(location.search).has('combatFeel')||new URLSearchParams(location.search).has('combatSlice')))void import('../systems/combatFeelDebug').then(m=>m.installCombatFeelDebug(this));
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
      unbindCanvas();this.keys.destroy();
    });
    Object.defineProperty(window, "__farwind", {
      configurable: true,
      value: () =>
        structuredClone({
          windAim:{target:this.windAim.target,enabled:this.state.equipment.head==='windScope'},
          equipmentVisual:this.hero.debug(),
          state: this.state,
          catCompanion:{...this.catCompanion.snapshot(this.state),position:{x:this.cat.sprite.x,y:this.cat.sprite.y},blocked:this.blocked(this.cat.sprite.x,this.cat.sprite.y)},
          runes: this.runes?.snapshot(),
          ground: this.data.get('groundSnapshot')?.(),
          defense: this.defense.snapshot(),
          npcLife: this.life.snapshot(),
          npcLifeView: this.lifeView.snapshot(),
          defendersView: this.defenseView.snapshot(),
          xiaobao: this.xiaobao?.snapshot(),
          defenseSaving: this.defenseSaving,
          defenseCheckpointPending: this.defenseCheckpointPending,
          ...(import.meta.env.DEV?{dayNight:{phase:lightAt(this.state.time),lights:this.dayNight.visibleLights,draws:this.dayNight.draws,loops:this.soundFx.loops.length,loopGains:this.soundFx.loops.map(l=>l.gain.gain.value),objects:this.children.length,textures:this.textures.getTextureKeys().length}}:{}),
          attackSerial: this.attackSerial,
          buildTraining:this.buildTraining.snapshot(),
          skillGrowth:{...this.lessons?.snapshot(),enemies:this.enemies.map(e=>({id:e.id,x:e.x,y:e.y,hp:e.hp,disabled:!!e.disabled})),contacts:this.swordWind.events.map(e=>({kind:e.kind,reason:e.reason,target:e.target?.id,at:e.at,point:e.point,release:e.wind.releaseId})),sim:this.sim,combatStage:this.combat.attack?.stage??0,ability:this.lessons?.config()?.name??null,water:this.swordWindView?.water.snapshot(),winds:this.swordWind.snapshot(),objects:this.children.length,textures:this.textures.getTextureKeys().length},
          ...(import.meta.env.DEV
            ? {
                layoutLabels: this.data.get("layoutLabelCount") ?? 0,
                missingPropTextures: [...this.propImages].filter(([, image]) => image.texture.key === '__MISSING').map(([id]) => id),
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
                  saving: saveDiagnostic(),
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
          bossHazards:this.bossHazards.hazards,
          bossEffects:this.enemyView.boss.effects.snapshot(),
          bossPresentation:{hero:this.hero.debug(),combatFacing:this.battleFacing(),reaction:{visible:this.enemyView.boss.reaction.visible,text:this.enemyView.boss.reaction.text,root:[this.enemyView.boss.reaction.x,this.enemyView.boss.reaction.y]},camera:{view:{x:this.cameras.main.worldView.x,y:this.cameras.main.worldView.y},zoom:this.cameras.main.zoom}},
          bossContacts:this.contactHistory.filter(c=>c.id.startsWith('boss-')),
          bossProjectiles:this.enemyProjectiles.shots.filter(s=>s.attack.boss).map(s=>{const glyph=this.enemyView.shots.get(s.id);return {id:s.id,x:s.x,y:s.y,state:s.state,skill:s.attack.bossSkill,part:s.attack.bossPart,visual:glyph?{texture:glyph.texture.key,width:glyph.displayWidth,height:glyph.displayHeight,depth:glyph.depth}:null};}),
          wilderness:{active:this.enemies.filter(e=>encounterUnit(e.id)&&e.hp>0).length,south:regionalThreat(this.state.encounters,"south")},
          enemies: this.enemies.map((e) => ({
            id: e.id,
            x: e.x,
            y: e.y,
            hp: e.hp,
            type:e.type,
            behavior:{passiveRoot:e.passiveRoot,shieldSource:e.fungalShield?.id,boss:e.boss,battle:e.bossBattle,attempt:e.bossAttempt,elite:e.elite,face:e.face,guardOpen:Math.max(0,(e.guardOpenUntil??0)-this.sim),attack:e.attack?{direction:e.attack.direction,startedAt:e.attack.startedAt,lockAt:e.attack.lockAt,contactAt:e.attack.contactAt,activeUntil:e.attack.activeUntil,recoveryUntil:e.attack.recoveryUntil,cancelled:e.attack.cancelled,skill:e.attack.bossSkill,part:e.attack.bossPart,area:e.attack.bossArea,geometry:e.attack.bossGeometry,shotAngles:e.attack.bossShotAngles??e.attack.shotAngles,bombAt:e.attack.bombAt,supportTarget:e.attack.supportTarget}:null,pose:this.enemyView.debug(e.sprite)?.pose},
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
    if(this.economy.busy || this.defenseSaving||this.sessionStarting) return;
    this.sessionStarting=true;
    try{
    this.active=false;
    await switchSaveSession();
    this.snapshotSerial++;
    this.snapshotPending=false;this.snapshotCapture=null;this.nextSnapshot=5000;this.defenseRetryAt=0;
    this.state =
      continued && this.loaded ? structuredClone(this.loaded) : initialState();
    syncMapGeometry(this.state.mapProgress.westRoad === "open",this.state.mapProgress.shortcuts,this.state.encounters.broken,this.state.windLegacy);
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
    this.catCompanion.reset();this.catView?.clear();this.catSpace=this.state.life.playerSpace;this.catCareUntil=0;
    this.runes?.reset();
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
    this.enemyProjectiles.reset();this.bossHazards.clear();this.enemyView.reset();
    this.contactHistory=[];
    this.inputHistory=[];
    this.parryEffects=[];
    this.clearFeedback();
    this.timeline.reset(performance.now());
    this.battleAxis={x:0,y:0};
    this.runIntent=false;
    this.fieldTargets.forEach((t) => t.reset());
    this.fieldViews.forEach((v) => v.reset());
    this.training.reset();this.buildTraining.clear();this.legacyDeviceArmed=false;this.legacyDeviceSaving=false;
    this.trainingView.reset();
    this.pointerAttack = false;
    this.respawnInvulnerable = 0;
    this.gatherUntil = 0;
    this.keys.clear();
    this.sprint.reset(this.state.player.stamina);
    this.hero.setAlpha(1);
    this.follower.reset(this.state.player);
    this.cat.place(this.state.player.x - 78, this.state.player.y + 18);
    if (this.blocked(this.cat.sprite.x, this.cat.sprite.y))
      this.cat.place(this.state.player.x, this.state.player.y);
    this.windAim.clear();
    this.hero.place(this.state.player.x, this.state.player.y);
    this.cameras.main.centerOn(this.state.player.x, this.state.player.y - 150);
    this.refresh();
    this.spawnEnemies();
    this.wilderness=new WildernessEncounters({
      reserved:()=>this.defense.enemies.filter(e=>e.hp>0&&!e.disabled).length,
      bossReady:kind=>this.enemyView.boss.assets.ready(kind),
      checkpoint:()=>this.persist(true),
      enabled:d=>this.state.windMemory.active?ADVENTURE_ROUTES[this.state.windMemory.active.direction].includes(d.id):legacyEncounterEnabled(this.state,d.id),read:()=>this.combatEncounters,bodies:()=>this.enemies,
      signal:d=>this.ui.message(`${d.name}正在接近，注意地面预兆。`),
      bossEnter:d=>{if(d.boss)this.soundFx.bossArrival(d.boss,this.sim);if(this.combatShake>0)this.cameras.main.shake(180,.0015*this.combatShake);},
      spawn:(d,u)=>{const e=this.makeEnemy(d);Object.assign(e,{elite:d.elite,boss:d.boss,bossAttempt:this.combatEncounters.groups[encounterUnit(d.id)!.group].boss?.attempt,hp:u.hp,x:u.x,y:u.y,attackSerial:u.serial,cool:this.sim+u.cooldown,face:{...u.face},guardOpenUntil:this.sim+u.guardOpen,leashRadius:ENCOUNTERS.find(g=>g.id===encounterUnit(d.id)!.group)!.radius});if(d.boss)restoreBossCombat(e,this.combatEncounters.groups[encounterUnit(d.id)!.group].boss!.combat,this.sim,this.bossHazards,this.enemyProjectiles);validateEnemyPosition(e);this.enemies.push(e);},
      release:id=>{const e=this.enemies.find(e=>e.id===id);if(!e)return;e.sprite.destroy();e.shadow.destroy();this.enemyBlades.get(id)?.destroy();this.enemyBlades.delete(id);this.enemies=this.enemies.filter(e=>e.id!==id);},
      busy:id=>this.encounterBusy(id),
      bossCapture:(e,now)=>captureBossCombat(e,now,this.bossHazards,this.enemyProjectiles),
      occupied:()=>[...this.defense.enemies.filter(e=>e.hp>0),...(this.xiaobao?.controller.available?[this.xiaobao.controller]:[])],
      bossReset:id=>this.clearBossEffects(id),
    });
    const restoredBoss=ENCOUNTERS.find(d=>this.combatEncounters.groups[d.id].boss?.stage==='battle');if(restoredBoss)await this.enemyView.boss.assets.ensure(restoredBoss.members.find(m=>m.boss)!.boss!);
    this.wilderness.restore(this.state.life.playerSpace==="village"?this.state.player:this.state.life.outside);
    for(const saved of this.state.xiaobao.affected){const enemy=this.enemies.find(e=>e.id===saved.id);if(enemy&&!enemy.boss){Object.assign(enemy,{hp:saved.hp,x:saved.x,y:saved.y,staggerUntil:this.sim+saved.control,staggerSince:this.sim,companionControlGrace:this.sim+saved.control+saved.controlGrace,companionControlLimit:this.sim+saved.controlLimit});validateEnemyPosition(enemy);}}
    this.syncDrops();
    this.ui.close(true);
    this.ui.intro();
    this.soundFx.start();
    if (!continued) await this.persist();
    this.ui.message("风铃村欢迎你。向北走几步，按 E 与守风人交谈。");
    }finally{this.sessionStarting=false;}
  }
  catCareReason() {
    if(this.state.player.hp<=0)return '先回到安全处恢复状态。';
    if(Math.hypot(this.cat.sprite.x-this.state.player.x,this.cat.sprite.y-this.state.player.y)>150||!this.clearLine(this.cat.sprite.x,this.cat.sprite.y,this.state.player.x,this.state.player.y))return '小黑还没跟上，等它走近再相处。';
    const safety=this.sleepSafety();
    return safety.action||safety.threat||safety.projectile||safety.conflict||this.enemyProjectiles.shots.length>0||this.catCompanion.pounce?'附近还有战斗风险，先带小黑到安全处。':'';
  }
  catStatus() {
    const c=this.state.catBond;
    return `${this.catCompanion.aura?`灵猫同行：体力恢复 +${Math.round(catBenefits(c.score).recovery*100)}%`:'小黑正在跟上你'}${c.shield>0?` · 灵息护盾 ${Math.ceil(c.shield)}`:''}${c.clawCooldown>0?` · 影爪冷却 ${Math.ceil(c.clawCooldown/1000)}秒`:''}${c.guardCooldown>0?` · 护主冷却 ${Math.ceil(c.guardCooldown/1000)}秒`:''}${this.catCompanion.hint?` · 嗅到了${this.catCompanion.hint.label}`:''}`;
  }
  async careForCat(kind:CatCare) {
    if(kind!=='pet'&&kind!=='feed')throw Error('未知的相处方式。');
    const reason=this.catCareReason();if(reason)throw Error(reason);
    const previous=catStage(this.state.catBond.score);
    await this.economy.run(()=>this.state,s=>catCareSnapshot(s,kind),save,next=>this.publishState(next));
    this.catCareUntil=this.sim+1800;
    this.catView?.event({kind:'care',point:{...this.state.player},text:'小黑蹭了蹭你的手'},this.sim);
    this.soundFx.play('cat-meow');
    const stage=catStage(this.state.catBond.score);
    if(stage>previous){this.ui.message(`默契提升：${CAT_STAGES[stage].name} · ${CAT_STAGES[stage].skill}`);this.catView?.event({kind:'unlock',point:{...this.state.player},text:CAT_STAGES[stage].skill},this.sim);}
  }
  catRemember(key:string,point:{x:number;y:number}=this.state.player) {
    if(this.practice.mode!=='off'||this.lessons?.trial)return;
    if(this.catCompanion.remember(this.state,key,point))this.snapshotPending=true;
  }
  async trade(request: EconomyRequest) {
    if(request.kind==="equip" && request.slot==="head" && (this.state.life.playerSpace!=="village" || regionAt(this.state.player).id!=="village" || this.runes?.lock()))throw Error("请在安全村庄脱战8秒且攻击结束后更换头部装备。");
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
  async drinkSpring() {
    if (this.ui.paused || this.defenseSaving || this.sessionStarting || !this.runes) return;
    let saving = false;
    try {
      await this.economy.run(() => this.state, state => {
        const next = springSnapshot(state, this.runes!.safety());
        next.dashCooldownRemaining = Math.max(0, this.combat.dashCooldown - this.sim);
        return next;
      }, next => { saving = true; return save(next); }, next => {
        this.publishState(next);
        this.sprint.reset(next.player.stamina);
        this.ui.saved(next);
        this.soundFx.play("success");
        this.float(next.player.x, next.player.y, "生命与体力全满");
        this.ui.message("饮用了清凉的泉水，生命与体力已全部恢复。");
      });
    } catch (error) {
      if (saving) this.ui.saveFailed(error);
      this.ui.message(error instanceof Error ? error.message : "泉水恢复失败，请稍后再试。");
    }
  }
  sleepSafety(){
    const c=this.combat,p=this.state.life.playerSpace === "village" ? this.state.player : this.state.life.outside;
    return {conflict:this.defenseSaving||this.defenseCheckpointPending,action:!!c.attack||!!c.pending||!!c.parry||this.sim<c.dashUntil||this.sim<this.gatherUntil||!!this.xiaobao?.controller.busy||!!this.xiaobao?.controller.data.support,
      threat:[...this.enemies,...this.defense.enemies].some(e=>e.hp>0&&!e.disabled&&Math.hypot(e.x-p.x,e.y-p.y)<380&&clearMotionLine(p,e)),
      projectile:this.defense.arrows.length>0||this.swordWind.winds.length>0||!!this.xiaobao?.controller.data.flight};
  }
  afterSleep(){
    this.catCompanion.transition();this.catView?.clear();
    this.clearFeedback();
    this.keys.clear();this.combat.reset(this.sim+this.state.dashCooldownRemaining);this.battleAxis={x:0,y:0};this.runIntent=false;this.pointerAttack=false;this.attackUntil=this.gatherUntil=0;
    this.clearSwordWind();this.slash?.clear();this.slashBack?.clear();this.parryInk?.clear();this.warningInk?.clear();this.parryEffects=[];this.sprint.reset(this.state.player.stamina);
    this.follower.reset(this.state.player);this.cat.place(this.state.player.x-78,this.state.player.y+18);if(this.blocked(this.cat.sprite.x,this.cat.sprite.y))this.cat.place(this.state.player.x,this.state.player.y);
    this.windAim.clear();
    this.hero.place(this.state.player.x,this.state.player.y);this.cameras.main.centerOn(this.state.player.x,this.state.player.y-150);this.timeline.reset(performance.now());this.ui.update(this.state,"");this.dayNight.render(true);this.soundFx.ambience(lightAt(this.state.time).lamps,false);
  }
  async persist(notify = false) {
    if(this.economy.busy){if(notify)throw Error("状态正在保存，请稍候。");this.snapshotPending=true;return;}
    const session=saveDiagnostic().session;
    const confirm=(snapshot:State,serial:number,defense:EastDefense)=>{
      if(session!==saveDiagnostic().session||serial!==this.snapshotSerial)return;
      this.loaded=snapshot;defense.acknowledged(snapshot.defense.sequence);this.ui.available=true;
      this.ui.saved(snapshot);this.wilderness?.confirmed();
      if(snapshot.xiaobao.flight)this.xiaobao?.controller.confirmFlight(snapshot.xiaobao.flight.id);
    };
    const report=(error:unknown)=>{if(session===saveDiagnostic().session){this.ui.saveFailed(error);}throw error;};
    if(notify){
      let serial=0;const defense=this.defense;
      try{await this.economy.run(()=>{this.syncFungalRoots();this.wilderness?.capture(this.sim);return this.state;},s=>({...s,dashCooldownRemaining:Math.max(0,this.combat.dashCooldown-this.sim)}),s=>{serial=++this.snapshotSerial;return save(s);},snapshot=>confirm(snapshot,serial,defense));this.ui.message('旅途已保存');}
      catch(error){report(error);}return;
    }
    // 同步更新结束后只捕获一份快照；存储完成只确认，不发布副本到运行世界。
    if(this.snapshotCapture)return this.snapshotCapture;
    const capture=Promise.resolve().then(()=>{
      if(session!==saveDiagnostic().session)return;
      if(this.economy.busy){this.snapshotPending=true;return;}
      this.syncFungalRoots();this.wilderness?.capture(this.sim);
      this.state.dashCooldownRemaining=Math.max(0,this.combat.dashCooldown-this.sim);
      const serial=++this.snapshotSerial,defense=this.defense;let snapshot!:State;
      const written=save(this.state,{automatic:true,captured:s=>snapshot=s});
      // 释放捕获门禁，不等待存储；下一帧的新变化可以排入队尾并合并。
      if(this.snapshotCapture===capture)this.snapshotCapture=null;
      return written.then(()=>confirm(snapshot,serial,defense));
    }).catch(report).finally(()=>{if(this.snapshotCapture===capture)this.snapshotCapture=null;});
    this.snapshotCapture=capture;return capture;
  }
  publishState(next:State){this.state=next;this.loaded=structuredClone(next);this.ui.state=next;this.ui.available=true;this.defense.rebind(next.defense);this.life.rebind(next,this.defense);this.xiaobao?.controller.bind(next.xiaobao);this.refresh();this.ui.update(next,"");}
  xiaobaoUnderRoof(p:{x:number;y:number}){return props.some(prop=>['house','shop','smith-building','inn-building'].includes(prop.art)&&p.x>prop.x-prop.w/2&&p.x<prop.x+prop.w/2&&p.y>prop.y-prop.h&&p.y<prop.y);}
  wireXiaobao(){
    this.defense.hostileLimit=ENCOUNTER_LIMITS.active;
    this.defense.runeEnemyScale=id=>this.runes?.engine.enemyScale(id)??1;
    this.defense.playerAttackPermit=(enemy,target)=>this.attackPermit(enemy,target);
    this.defense.enemyDeath=(enemy,sourceId)=>{
      const member=this.state.defense.raid?.members.find(m=>m.id===enemy.id);if(!member)return;
      const eligible=!!member.participated||sourceId==='player'||sourceId==='xiaobao'&&this.state.xiaobao.task==='follow';
      const earned=creditCombatCoins(this.state,{elite:member.eliteLevel},eligible);if(earned)this.float(enemy.x,enemy.y-25,`金币 +${earned}`);
    };
    this.defense.enemyDamage=(enemy,event,result)=>{
      if(result.damage>0&&(event.sourceId==='player'||event.sourceId==='xiaobao'&&this.state.xiaobao.task==='follow')){
        const member=unitState(this.combatEncounters,enemy.id);if(member)member.participated=true;
        const raid=this.state.defense.raid?.members.find(m=>m.id===enemy.id);if(raid)raid.participated=true;
      }
      if(event.sourceId==='player')return;
      const origin=event.origin??this.defense.victim(event.sourceId)??this.state.player,direction=unit({x:enemy.x-origin.x,y:enemy.y-origin.y});
      this.emitFeedback(hitFeedbackKind({...result,interrupted:false,guardBroken:false}),`contact:${event.attackId}:${enemy.id}`,this.sim,enemy,undefined,{attackId:event.attackId,sourceId:event.sourceId,point:{x:enemy.x-direction.x*10,y:enemy.y-28-direction.y*6},incoming:direction,blade:{x:-direction.y,y:direction.x},depth:enemy.y+.15,damage:result.damage,guarded:result.guarded,killed:result.killed});
    };
    this.defense.companionTarget=()=>{const c=this.xiaobao?.controller;return c?.available?{id:'xiaobao',x:c.x,y:c.y,hp:c.data.hp}:undefined;};
    this.defense.protection=id=>this.xiaobao?.controller.protection(id)??{};
    this.defense.companionContact=(source,contact)=>this.receiveXiaobao(contact,source);
  }
  checkpointXiaobaoFlight(id:string){
    void this.persist(true).then(()=>{if(this.xiaobao?.controller.data.flight?.id===id)this.ui.message('村庄危急，小宝将踏风飞援。');})
      .catch(e=>{this.ui.open('pause');this.ui.message(`飞援尚未保存，已暂停：${(e as Error).message}`);});
  }
  receiveXiaobao(contact:EnemyContact,source:EnemyBody){
    const c=this.xiaobao?.controller;if(!c||c.data.space!=='village')return false;
    return c.receive(contact,source,event=>{const target={id:'xiaobao',hp:c.data.hp,faction:'village' as const,armor:12,...c.protection('xiaobao')},shot=contact.projectileId?this.enemyProjectiles.shots.find(s=>s.id===contact.projectileId):undefined;
      const adjusted={...event,sourceScale:this.runes?.engine.enemyScale(source.id)??1};return shot?resolveReleasedDamage(adjusted,shot.released,target):resolveDamage(adjusted,{id:source.id,hp:source.hp,faction:'hostile',armor:0},target);},this.sim);
  }
  enemyVictim(e:EnemyBody){
    const outside=this.state.life.playerSpace==='village',player=outside?this.state.player:{x:-10000,y:-10000,hp:0},c=this.xiaobao?.controller;
    if(e.boss)return {point:player,id:'player'};
    if(e.attack&&e.targetId==='xiaobao'&&c?.available)return {point:c,id:'xiaobao'};
    if(e.attack&&e.targetId==='player'&&player.hp>0)return {point:player,id:'player'};
    const d=c?.available?Math.hypot(c.x-e.x,c.y-e.y):Infinity,engaged=(e.companionAggroUntil??0)>this.sim;
    if(c?.available&&d<380&&clearMeleeLine(e,c)&&(engaged||e.targetId==='xiaobao'||d<Math.hypot(player.x-e.x,player.y-e.y)))return {point:c,id:'xiaobao'};
    return {point:player,id:'player'};
  }
  attackPermit(enemy:EnemyBody,target:string){const v=this.cameras.main.worldView;return playerAttackPermitted(enemy,target,this.state.player,[...this.enemies,...this.defense.enemies],this.sim,{left:v.x,right:v.right,top:v.y,bottom:v.bottom});}
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
    data.affected=this.enemies.filter(e=>!e.passiveRoot&&tracked.has(e.id)&&e.hp>0&&!e.disabled).map(e=>({id:e.id,hp:e.hp,x:e.x,y:e.y,control:Math.min(800,Math.max(0,e.staggerUntil-this.sim)),controlGrace:Math.min(1000,Math.max(0,(e.companionControlGrace??0)-Math.max(this.sim,e.staggerUntil))),controlLimit:Math.min(800,Math.max(0,(e.companionControlLimit??this.sim)-this.sim)),space:'village' as const}));
  }
  xiaobaoHit(e:EnemyBody,event:DamageEvent,released:ReleasedAttack,control:number,knock:number,task:XiaobaoTask,at:number){
    const before=e.hp,applied=this.defense.damageEnemy(e as typeof this.enemies[number],event,released),killed=applied&&e.hp===0;
    if(!applied)return {applied:false,killed:false,damage:0};
    const member=unitState(this.combatEncounters,e.id);if(member&&task==="follow"&&e.hp<before)member.participated=true;
    e.companionAggroUntil=at+2500;
    if(control>0)companionControl(e,at,control);
    if(knock>0&&!e.boss){const c=this.xiaobao!.controller,n=Math.max(.001,Math.hypot(e.x-c.x,e.y-c.y));sweepMove(e,(e.x-c.x)/n*knock,(e.y-c.y)/n*knock,motionBlocked,clearMotionLine);e.nav.path=[];}
    const fixed=this.enemies.find(f=>f===e),data=this.xiaobao!.controller.data;
    if(fixed){
      if(killed){
        this.recordEnemyDefeat(fixed,task==='follow'?'companion':'guard');
        data.affected=data.affected.filter(t=>t.id!==e.id);
      }else if(!e.passiveRoot&&!data.affected.some(t=>t.id===e.id))data.affected.push({id:e.id,hp:e.hp,x:e.x,y:e.y,control:Math.min(800,Math.max(0,e.staggerUntil-at)),controlGrace:1000,controlLimit:Math.min(800,Math.max(0,(e.companionControlLimit??at)-at)),space:'village'});
    }
    return {applied:true,killed,damage:before-e.hp};
  }
  async configureXiaobao(change:Partial<Pick<State['xiaobao'],'task'|'gate'|'tactic'>>){
    const oldTask=this.state.xiaobao.task,oldGate=this.state.xiaobao.gate;
    let response='小宝记下了你的安排。';
    await this.economy.run(()=>this.state,s=>{const next=structuredClone(s);const {task,...settings}=change;Object.assign(next.xiaobao,settings,{known:true});if(task)response=requestXiaobaoTask(next,task);
      if(change.task&&change.task!==s.xiaobao.task||change.gate&&change.gate!==s.xiaobao.gate){if(next.xiaobao.cast&&!next.xiaobao.cast.released){next.xiaobao.cast=null;next.xiaobao.recovery=Math.max(300,next.xiaobao.recovery);}next.xiaobao.command=null;next.xiaobao.wait=null;}
      return next;},save,next=>{this.publishState(next);if(oldTask!==next.xiaobao.task||oldGate!==next.xiaobao.gate)this.xiaobao!.controller.taskChanged();});
    return response;
  }
  showDemonKingIntroduction(){
    if(this.ui.paused||this.economy.busy||this.defenseSaving||this.defenseCheckpointPending||!demonMalice(this.state.encounters)||this.state.demonKing.introduced||this.state.defense.raid)return false;
    const safety=this.sleepSafety();if(safety.action||safety.threat||safety.projectile)return false;
    this.ui.dialog(DEMON_KING.name,`${DEMON_KING.firstAppearance}\n\n「${DEMON_KING.firstWords}」\n\n你还不知道它的名字。清剿让当地安静下来，却也引来了远处的注视。`,'demon-king',()=>{
      void this.economy.run(()=>this.state,demonKingIntroduction,save,next=>this.publishState(next)).catch(e=>{this.ui.open('pause');this.ui.message('初见记录尚未保存，已暂停：'+(e as Error).message);});
    });
    return true;
  }
  async startNightRaid(retaliation=false){
    this.nextNightAttempt=this.sim+RAID_TIMING.retry;
    try{
      const v=this.cameras.main.worldView;
      await this.economy.run(()=>this.state,s=>{const occupied=this.enemies.filter(e=>e.hp>0&&!e.disabled),view={left:v.x,right:v.right,top:v.y,bottom:v.bottom};return (retaliation?retaliationWarningSnapshot:nightWarningSnapshot)(s,view,occupied,this.defense);},save,next=>this.publishState(next));
      const raid=this.state.defense.raid!;
      this.ui.message(retaliation?`魔王为据点陷落发起报复！${retaliationSummary(raid.order!)}正在地图边缘集结，即将向村庄总攻。`:raid.order?.source==='demon-king'?`${DEMON_KING.name}的部队接近村门，共 ${raid.members.length} 只；防线可能需要支援。`:"村门外发现动静，卫队正在戒备；可以参与或继续旅行。");
    }catch(e){
      // 同一个计划重试，失败不发布预警、不消费序号、不生成敌人。
      this.state.defense.retryMs=RAID_TIMING.retry;
      if(!(e instanceof RaidDeferredError))this.ui.open("pause");
      this.ui.message(e instanceof RaidDeferredError?(retaliation?'魔王报复暂缓：':'今晚的来袭暂缓：')+e.message:"预警尚未保存，已暂停："+(e as Error).message);
    }
  }
  async discoverNight(){
    if(this.economy.busy)return;
    try{await this.economy.run(()=>this.state,discoverySnapshot,save,next=>this.publishState(next));
      this.ui.dialog("临水夜风","小黑循着微光停在草坡，轻轻碰了碰你的手。风从水面吹来，像是在说：无论走多远，总有一盏灯等你回家。\n获得恢复药剂 ×1。","cat");
    }catch(e){this.ui.message((e as Error).message);}
  }
  openDefenseDrill() {
    this.ui.dialog("东门驻防", "岑风和青禾守住通路两侧，弦雨在塔上警戒。门洞保持畅通，门外道路是巡逻近郊，往远处才进入森林。首夜安静；后续夜晚需冷却结束、三名卫兵健康返岗，才可能来袭。恶意为零时有1～3只；清剿据点引起黑焰回应后，恶意1～9时增加5只，后续逐步加入精英。每处据点首次陷落后，魔王另派一波10只精英裂枝镰灵从地图边缘向村庄总攻；第一处一阶、第二处二阶，此后逐阶增强，已有袭击时排队接续，不受首夜与常规冷却限制。此后按恶意决定夜间骚扰概率，恶意0～4依次为50%、60%、70%、80%、90%。清剿仍会阻止当地巡游和当地来源入侵。");
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
    if (this.economy.busy || this.defenseSaving || this.defenseCheckpointPending || !this.defense.critical || performance.now()<this.defenseRetryAt) return;
    const defense=this.defense;
    defense.critical=false;this.defenseCheckpointPending=true;
    try {await this.persist();}
    catch {if(this.defense===defense){defense.critical=true;this.defenseRetryAt=performance.now()+5000;}}
    finally {this.defenseCheckpointPending=false;}
  }
  async toTitle() {
    try {
      await this.persist(true);
      this.active = false;
      await switchSaveSession();
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
      this.training.reset();this.buildTraining.clear();this.legacyDeviceArmed=false;this.legacyDeviceSaving=false;
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
    return this.state.life.playerSpace==="village"?(motionBlocked(x,y,ignore)||this.enemies.some(e=>e.hp>0&&e.id!==ignore&&(e.boss?bossGroundContains(e,{x,y}):e.passiveRoot&&this.enemies.find(b=>b.id===e.passiveRoot!.owner)?.bossBattle?.roots?.[e.passiveRoot.index]?.kind==='rock'&&Math.hypot(e.x-x,e.y-y)<40))):spaceBlocked(this.state.life.playerSpace,x,y);
  }

  playerBlocked(x:number,y:number){
    const p=this.state.player;
    if(this.state.life.playerSpace!=="village")return spaceBlocked(this.state.life.playerSpace,x,y);
    return motionBlocked(x,y)||this.enemies.some(e=>e.hp>0&&(e.boss?bossGroundBlocks(e,p,{x,y}):e.passiveRoot&&this.enemies.find(b=>b.id===e.passiveRoot!.owner)?.bossBattle?.roots?.[e.passiveRoot.index]?.kind==='rock'&&Math.hypot(e.x-x,e.y-y)<40));
  }

  // 身体通路：黑猫、交互和领取掉落沿用脚底扩张范围。
  clearLine(x: number, y: number, tx: number, ty: number, ignore?: string) {
    return this.state.life.playerSpace==="village"?clearMotionLine({x,y},{x:tx,y:ty},ignore):spaceClear(this.state.life.playerSpace,{x,y},{x:tx,y:ty});
  }
  // 双方近战独立查询原实体，只豁免明确训练目标自身底座。
  meleeLine(x: number, y: number, tx: number, ty: number, targetId?: string) {
    return clearMeleeLine({ x, y }, { x: tx, y: ty }, targetId);
  }

  renderCampRoots(){
    for(const d of ENCOUNTERS.filter(d=>d.kind==='camp')){
      const g=this.state.encounters.groups[d.id],battle=g.boss?.stage==='battle',root=this.propImages.get(d.direction==='south'?'south-camp-root':`camp-root-${d.id}`);
      // 巢根在战斗中伏低，保证首领和地面提示不被不可碰撞的装饰完全遮住。
      root?.setTexture(g.cleared?'wood':'bush').setDisplaySize(g.cleared?115:180,g.cleared?65:135).setAlpha(battle?.35:g.cleared?.65:1).setDepth(battle?d.y-160:d.y);
    }
  }
  refresh() {
    this.renderCampRoots();
    syncMapGeometry(this.state.mapProgress.westRoad === "open",this.state.mapProgress.shortcuts,this.state.encounters.broken,this.state.windLegacy);
    for(const p of ARENA_STONES){const broken=this.state.encounters.broken.includes(p.id);this.propImages.get(p.id)?.setDisplaySize(p.w,broken?35:p.h).setAlpha(broken?.55:1);}
    this.propImages.get('legacy-residual-a')?.setAlpha(.4).setTint(0xd3e9a1);this.propImages.get('legacy-residual-b')?.setAlpha(.4).setTint(0xd3e9a1);
    this.propImages.get('legacy-wind-seal')?.setVisible(this.state.windLegacy.wind<4&&this.state.life.playerSpace==='village');this.propImages.get('legacy-blade-seal')?.setVisible(this.state.windLegacy.blade<4&&this.state.life.playerSpace==='village');this.propImages.get('legacy-wind-bell')?.setTint(this.state.windLegacy.device?0xbfffff:0xffffff);this.propImages.get('legacy-windDevice')?.setTint(this.state.windLegacy.device?0xbfffff:0xffffff);
    for(const s of SHORTCUTS)this.propImages.get(`barrier-${s.id}`)?.setVisible(!this.state.mapProgress.shortcuts.includes(s.id)&&this.state.life.playerSpace==="village");
    this.propImages.get("west-gate-barrier")?.setVisible(this.state.mapProgress.westRoad !== "open" && this.state.life.playerSpace === "village");
    this.xiaobao?.render(this.active && this.state.life.playerSpace === this.state.xiaobao.space,xiaobaoAllies(this));
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
  async changeWindMemory(direction?:WildernessDirection){
    if(this.wilderness?.saving||this.wilderness?.checkpointFailed)throw Error('先保存当前战斗记录。');
    if(direction){const safety=this.runes?.safety();if(this.state.life.playerSpace!=='village'||safety&&(safety.combat||safety.boss||safety.defense||safety.trial||safety.action))throw Error('请先离开交战并收招，再开启风忆远征。');}
    this.syncFungalRoots();this.wilderness?.capture(this.sim);
    await this.economy.run(()=>this.state,s=>direction?startWindMemory(s,direction):endWindMemory(s),save,next=>this.publishState(next));
    this.clearSwordWind();this.bossHazards.clear();this.enemyProjectiles.reset();this.spawnEnemies();this.wilderness?.restore(this.state.player);this.enemyView.reset();this.refresh();this.ui.message(direction?'风忆已开启，沿原路线完成新的波次。':'已结束本次风忆，回到真实清剿进度。');
  }
  get combatEncounters(){return this.state.windMemory.active?.encounters??this.state.encounters;}
  makeEnemy(d:{id:string;type:string;elite?:EliteKind;boss?:CampBossKind;x:number;y:number}):Enemy {
    return {
        kind: "enemy" as const,
        id: d.id,
        x: d.x,
        y: d.y,
        homeX: d.x,
        homeY: d.y,
        type: d.type,elite:d.elite,boss:d.boss,
        hp: creatureMaxHP(d.type,d.elite,d.boss),
        cool: 0,
        windup: 0,
        flashUntil: 0,
        staggerUntil: 0,
        nav: enemyNavigation(),
        ai: "家园",
        disabled: false,
        recovered: false,
        sprite: this.add
          .sprite(d.x, d.y, ['archer','bell','shade','geomancer'].includes(d.type)?`enemy-hd-${d.type}`:`enemy-${d.type}`, ['archer','bell','shade','geomancer'].includes(d.type)?'down/idle':0)
          .setOrigin(0.5, 1)
          .setDisplaySize(75, 75),
        shadow: this.add.ellipse(d.x, d.y, d.boss?CAMP_BOSSES[d.boss].height*.56:45, d.boss?CAMP_BOSSES[d.boss].height*.18:15, 0x18392d, 0.2),
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
  clearBossEffects(id:string){
    const owned=(value:string|null|undefined)=>!!value&&(value===id||value.startsWith(id+":"));
    for(const root of this.enemies.filter(e=>e.passiveRoot?.owner===id||e.bossSummon?.owner===id)){root.sprite.destroy();root.shadow.destroy();this.enemies=this.enemies.filter(e=>e!==root);}

    this.bossHazards.clear(id);this.enemyProjectiles.shots=this.enemyProjectiles.shots.filter(s=>s.attack.attackerId!==id);
    this.state.xiaobao.affected=this.state.xiaobao.affected.filter(e=>!owned(e.id));
    // 撤战只清理涉及该首领的本轮效果，村庄与其他遭遇继续推进。
    if(owned(this.state.xiaobao.cast?.target))this.state.xiaobao.cast=null;
    this.state.xiaobao.effects=this.state.xiaobao.effects.filter(effect=>!owned(effect.target)&&!effect.hit.some(key=>owned(key)||key.endsWith(':'+id)));
    if(owned(this.state.xiaobao.command?.target??undefined))this.state.xiaobao.command=null;
  }
  encounterBusy(id:string){
    const e=this.enemies.find(e=>e.id===id),x=this.state.xiaobao;
    return !!(e&&e.hp>0&&this.defense.manages(e))||x.affected.some(v=>v.id===id)||x.cast?.target===id||x.effects.some(v=>v.target===id||this.enemies.some(e=>e.id===id&&Math.hypot(e.x-v.center.x,e.y-v.center.y)<800))||this.enemyProjectiles.shots.some(s=>s.state==="flying"&&s.attack.attackerId===id);
  }
  worldDrops(){
    if(this.state.windMemory.active)return [];
    return [...this.state.pendingDrops,...ENCOUNTERS.flatMap(d=>encounterDefinitions(this.combatEncounters,d).flatMap(m=>{const u=unitState(this.combatEncounters,m.id)!;return u.drop?[{enemyId:m.id,item:enemyProfile(m.type).drop,x:u.x,y:u.y}]:[];}))];
  }
  recordEnemyDefeat(e:Enemy,source:"player"|"companion"|"guard"){
    this.state.xiaobao.affected=this.state.xiaobao.affected.filter(t=>t.id!==e.id);
    e.sprite.setVisible(false);e.shadow.setVisible(false);if(e.attack)e.attack.cancelled=true;
    if(e.passiveRoot?.owner.startsWith('event:')){const id=e.passiveRoot.owner.slice(6) as SouthEventId;this.state.southEvents[id]=0;this.ui.message(`${SOUTH_EVENTS[id].name}已完成，采集恢复；回村委托簿领取谢礼。`);this.defense.critical=true;return;}
    if(e.bossSummon){const owner=this.enemies.find(b=>b.id===e.bossSummon!.owner&&b.bossAttempt===e.bossSummon!.attempt);if(defeatBossSummon(owner,e.id,this.sim))this.ui.message('护猎已破，猎王失衡！');this.defense.critical=true;return;}
    if(e.passiveRoot){
      const tag=e.passiveRoot,boss=this.enemies.find(b=>b.id===tag.owner&&b.hp>0&&b.bossAttempt===tag.attempt),root=boss?.bossBattle?.roots?.[tag.index];
      if(root){root.hp=0;if(root.kind==='sac')this.bossHazards.hazards=this.bossHazards.hazards.filter(h=>!h.independent||h.owner!==boss!.id||!h.id.includes(`:孢囊:${boss!.bossAttempt??0}:${tag.index}:`));if(root.kind!=='sac'&&root.kind!=='rock'&&boss!.bossBattle!.roots!.filter(r=>(r.kind??'root')===(root.kind??'root')).every(r=>r.hp<=0)){const b=boss!.bossBattle!;b.exposedUntil=this.sim+2000;b.nextAt=Math.max(b.nextAt,b.exposedUntil);if(boss!.attack)boss!.attack.cancelled=true;this.bossHazards.hazards=this.bossHazards.hazards.filter(h=>h.owner!==boss!.id);this.ui.message(boss!.boss==='spore-heart'?'祭根已断，巢母核心暴露！':'祭印已破，仪式中止，风核暴露！');}else this.ui.message(root.kind==='rock'?'岩柱已破。':root.kind==='sac'?'孢囊提前击破。':'一处护心机关已断。');}
      this.defense.critical=true;return;
    }
    if(e.id.includes(':唤巢:')){const u=unitState(this.combatEncounters,e.id);if(u){u.hp=0;u.defeated=true;}this.defense.critical=true;return;}
    if(e.boss)this.clearBossEffects(e.id);
    const definition=encounterUnit(e.id),direct=source!=="guard",item=enemyProfile(e.type).drop;
    if(direct&&Math.hypot(e.x-this.state.player.x,e.y-this.state.player.y)<400)this.catRemember(`battle:${e.id}`,e);
    const legacy=enemyDefs.some(d=>d.id===e.id),resourceDrop=combatResourceDrop(e.id,this.combatEncounters.seed??0,legacy&&item==='crystal');
    if(definition){
      const group=this.combatEncounters.groups[definition.group],wasCleared=group.cleared,wasRewarded=group.rewarded;
      const earned=settleEncounterCoins(this.state,e.id,direct,direct&&!legacy&&resourceDrop);if(earned===null)return;
      if(earned)this.float(e.x,e.y-25,`金币 +${earned}`);
      const u=unitState(this.combatEncounters,e.id)!;u.x=e.x;u.y=e.y;
      if(!legacy&&direct&&u.drop&&add(this.state,item,1)){u.drop=false;u.dropRemaining=0;this.soundFx.play("pick");}
      if(!wasRewarded&&group.rewarded){for(const u of group.summons??[]){u.hp=0;u.defeated=true;const body=this.enemies.find(e=>e.id===u.id);if(body){body.hp=0;body.sprite.setVisible(false);body.shadow.setVisible(false);if(body.attack)body.attack.cancelled=true;}}}
      if(!wasRewarded&&group.rewarded&&this.state.windMemory.active)memoryGold(this.state,definition.group,adventureIndex(definition.group)===3?8:4);
      if(!wasRewarded&&group.rewarded&&offerWindGift(this.state.windGifts,`${this.combatEncounters.instance??'首次'}:${definition.group}`,this.combatEncounters.seed??0,this.state.skills.swordWindStage>0)){
        this.state.player.hp=Math.min(playerVitals(this.state).maxHp,this.state.player.hp+giftValue(this.state.windGifts,'spring'));
        this.ui.mode='reward-saving';this.ui.shell('整场胜利','<p>正在保存波次与三选一候选……</p>');
        void this.persist(true).then(()=>this.ui.open('wind-gifts')).catch(()=>{this.ui.mode='';this.ui.open('pause');this.ui.message('奖励尚未保存，请点击保存后从手记继续领取；候选保持不变。');});
      }
      if(!this.state.windMemory.active&&!wasCleared&&group.cleared&&ENCOUNTERS.find(d=>d.id===definition.group)!.kind==="camp"){
        const d=ENCOUNTERS.find(d=>d.id===definition.group)!;this.nextNightAttempt=0;if(!this.state.defense.raid)this.state.defense.retryMs=0;this.ui.message(`${d.name}已陷落，当地巡游停止。魔王恶意 +1，当前 ${demonMalice(this.state.encounters)}；10只精英镰灵将从地图边缘向村庄总攻，报复每波升一阶。`);this.refresh();
      }
    }
    if(legacy||!definition){
      if(this.state.killed.includes(e.id))return;this.state.killed.push(e.id);
      if(!definition&&!e.id.startsWith("practice-")&&!e.id.includes("dummy")){const earned=creditCombatCoins(this.state,e,direct);if(earned)this.float(e.x,e.y-25,`金币 +${earned}`);}
      if(resourceDrop){
        if(direct&&add(this.state,item,1)){if(item==="crystal"&&this.state.quest===3)this.state.quest=4;this.soundFx.play("pick");}
        else if(direct||item==="crystal")this.state.pendingDrops.push({enemyId:e.id,item,x:e.homeX,y:e.homeY});
      }
    }
    this.soundFx.creature(e.type,"death",Math.hypot(e.x-this.state.player.x,e.y-this.state.player.y),this.sim);
    this.state.xiaobao.affected=this.state.xiaobao.affected.filter(t=>t.id!==e.id);
    this.syncDrops();this.defense.critical=true;
    if(e.boss){if(this.state.windMemory.active){memoryGold(this.state,`${definition!.group}:boss`,16);this.state.windMemory.active.finished=true;this.ui.update(this.state,'');this.ui.mode='memory-victory';this.ui.shell('风忆远征完成','<p>记忆中的首领已击败，金币 +16。风赐继续留在旅人身上。</p><p>正在保存远征结果……</p>');void this.persist(true).then(()=>this.ui.open('wind-memory')).catch(()=>{this.ui.mode='';this.ui.open('pause');});}else{const rewards=this.runes?.milestone()??[];this.ui.mode='boss-saving';this.ui.shell('据点胜利','<p>正在保存首次清剿、符文与魔王恶意……</p>');void this.persist(true).then(()=>{this.ui.bossVictory(e.boss!,rewards);if(this.loaded)this.ui.saved(this.loaded);}).catch(()=>{if(this.wilderness)this.wilderness.checkpointFailed=true;this.ui.mode='';this.ui.open('pause');this.ui.message('首次胜利尚未保存，请先保存旅途；清剿结果保持待提交。');});}}
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
    const member=unitState(this.combatEncounters,d.enemyId);if(member){member.drop=false;member.dropRemaining=0;}
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
  async use(id: ItemId) {
    if(this.economy.busy||this.defenseSaving)return;
    if (!this.active) return;
    try {
      await this.trade({kind:"consume",item:id,sequence:this.state.economyRevision+1});
      this.soundFx.play("pick");
      this.ui.message(`${items[id].name}已使用并保存。`);
    } catch (error) { this.ui.message((error as Error).message); }
  }
  interact = interact;
  float(x: number, y: number, text: string) {
    if(!this.combatNumbers)return;
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
  hitFeedback(stage: number, material: "enemy" | "straw",stop?:number,counter=false,attackId?:number) {
    if(!this.combat.stopOnHit(stage,attackId,stop))return;
    if(stop!==undefined){this.combat.lastHitStopRequested=stop;this.combat.hitStopRemaining=Math.max(this.combat.hitStopRemaining,stop);}
  }
  settledPlayerHit(target:CombatTarget,attack:Attack,result:{damage:number;killed:boolean;guarded:boolean;guardBroken:boolean;interrupted:boolean},feedback?:StrikeFeedback){
    if(target.kind==='enemy'||target.kind==='defense-enemy'){
      this.catCompanion.landed(target,result.damage,!!feedback?.catBoost);
      if(result.damage>0&&isMeleeFinisher(attack,this.combat.maxStage)&&this.practice.mode==='off'&&!this.lessons?.trial){
        const supportTarget=target.hp>0?target:[...this.enemies,...this.defense.enemies].filter(e=>e.hp>0&&!e.disabled&&!e.passiveRoot&&Math.hypot(e.x-this.state.player.x,e.y-this.state.player.y)<=300&&Math.hypot(e.x-this.cat.sprite.x,e.y-this.cat.sprite.y)<=300&&clearMotionLine(this.cat.sprite,e)).sort((a,b)=>Math.hypot(a.x-this.state.player.x,a.y-this.state.player.y)-Math.hypot(b.x-this.state.player.x,b.y-this.state.player.y))[0];
        if(supportTarget)this.catCompanion.requestClaw(this.state,this.cat.sprite,supportTarget,`finisher:${attack.id}`,clearMotionLine);
      }
    }
    if(feedback?.runeEvent)this.runes?.engine.nativeLanded(target,feedback.runeEvent,result.damage);
    if(feedback?.runeEvent&&result.damage>0)this.runes?.giftLanded(target,feedback.runeEvent,isMeleeFinisher(attack,this.combat.maxStage));
    const at=feedback?.at??this.sim,direction=attack.windDirection??unit({x:target.x-this.state.player.x,y:target.y-this.state.player.y}),point=feedback?.point??{x:target.x-direction.x*12,y:target.y-28-direction.y*6};
    this.hitFeedback(attack.stage,target.kind==='trainingDummy'?'straw':'enemy',feedback?.stop,!!attack.counter,attack.id);
    if(attack.counter&&!result.killed&&!result.guardBroken){this.counterHit(target,attack,result,target.kind==='trainingDummy'?'straw':'hit',feedback);return;}
    this.emitFeedback(hitFeedbackKind(result),`contact:player:${attack.id}:${target.id}:${attack.windLeg??'blade'}`,at,target,attack,{point,incoming:{...direction},blade:{x:-direction.y,y:direction.x},depth:target.y+.15,sourceId:'player',stage:attack.stage,isFinisher:isMeleeFinisher(attack,this.combat.maxStage),actionKind:attack.kind,damage:result.damage,guarded:result.guarded,interrupted:result.interrupted,killed:result.killed,material:result.guarded?'armor':target.kind==='trainingDummy'?'straw':target.type==='slime'||target.type==='spore'?'slime':'leaf'});
    if(this.combatShake>0&&(result.killed||result.guardBroken||result.interrupted))this.cameras.main.shake(65,.0012*this.combatShake);
  }
  strikeTarget(target: CombatTarget, stage: number, attack: Attack,feedback?:StrikeFeedback,feedbackTarget?:CombatTarget) {
    const catScale=(target.kind==='enemy'||target.kind==='defense-enemy')&&this.practice.mode==='off'&&!this.lessons?.trial?this.catCompanion.multiplier(this.state,target):1;
    let base=feedback?.damage;
    if(catScale>1)base=(base??outgoingDamage(this.state,attackConfig(attack).damage))*catScale;
    if(target.kind!=='trainingProjection'&&this.runes){const ev=this.runes.prepare(attack,target,base);feedback={...feedback,damage:ev.amount,runeEvent:ev,catBoost:catScale>1};}
    else if(base!==undefined)feedback={...feedback,damage:base,catBoost:catScale>1};
    if((target.kind==='enemy'||target.kind==='defense-enemy')&&!target.passiveRoot)this.xiaobaoRecent={id:target.id,at:this.sim};
    const origin=isWindAttack(attack)&&attack.windDirection?{x:target.x-attack.windDirection.x*40,y:target.y-attack.windDirection.y*40}:this.state.player;
    if (target.kind === "defense-enemy") {
      const move=attackConfig(attack),guardOpen=target.guardOpenUntil??0,guarded=enemyProtection(target,origin,this.sim).reduction>0&&!isMeleeFinisher(attack,this.combat.maxStage)&&!attack.counter;
      let actualDamage=0;
      if(this.defense.damageEnemy(target,{sourceId:"player",targetId:target.id,attackId:feedback?.runeEvent?.eventId??`player:${attack.id}:${attack.windLeg??'blade'}`,
        amount:feedback?.damage??outgoingDamage(this.state,move.damage),sourceType:isWindAttack(attack)?"player-wind":"player-melee",eventId:target.eventId,origin:{x:origin.x,y:origin.y},breaksGuard:isMeleeFinisher(attack,this.combat.maxStage)||!!attack.counter},this.state.player.hp,receipt=>actualDamage=receipt.damage)) {
        const direction=attack.windDirection??unit({x:target.x-this.state.player.x,y:target.y-this.state.player.y});
        const reaction=reactToEnemyHit(target,this.sim,move,direction,guarded,isMeleeFinisher(attack,this.combat.maxStage)||!!attack.counter,target.type==='guardian'&&(isMeleeFinisher(attack,this.combat.maxStage)||!!attack.counter)&&guardOpen<=this.sim);
        this.settledPlayerHit(target,attack,{...reaction,killed:target.hp===0,damage:actualDamage},feedback);
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
      this.buildTraining.observe(attack,target.id);
      this.settledPlayerHit(feedbackTarget??target,attack,{damage,killed:false,guarded:false,guardBroken:false,interrupted:false},feedback);
      const view =
        target === this.training
          ? this.trainingView
          : this.fieldViews[this.fieldTargets.indexOf(target)];
      view.hit(this.sim, damage,this.combatNumbers);
    }
  }
  strikeEnemy(e: Enemy, stage: number,attack:Attack,feedback?:StrikeFeedback) {
    if (e.hp <= 0) return;
    const move = attackConfig(attack);
    const damage = feedback?.damage??outgoingDamage(this.state,move.damage);
    const guardOpen=e.guardOpenUntil??0;
    const origin=isWindAttack(attack)&&attack.windDirection?{x:e.x-attack.windDirection.x*40,y:e.y-attack.windDirection.y*40}:this.state.player;
    const protection=enemyProtection(e,origin,this.sim,isMeleeFinisher(attack,this.combat.maxStage)||!!attack.counter);
    const hit=resolveDamage({sourceId:"player",targetId:e.id,attackId:feedback?.runeEvent?.eventId??`player:${attack.id}:${attack.windLeg??'blade'}`,
      amount:damage,sourceType:isWindAttack(attack)?"player-wind":"player-melee",eventId:null},
      {id:"player",faction:"village",hp:this.state.player.hp,armor:0},{id:e.id,faction:"hostile",hp:e.hp,armor:0,...protection});
    if(!hit.applied)return;
    const member=unitState(this.combatEncounters,e.id);if(member&&hit.damage>0)member.participated=true;
    e.hp = hit.hp; e.playerAggroUntil=this.sim+2500;
    if(e.hp>0)this.soundFx.creature(e.type,"hurt",Math.hypot(e.x-this.state.player.x,e.y-this.state.player.y),this.sim);
    const direction=attack.windDirection??unit({x:e.x-this.state.player.x,y:e.y-this.state.player.y});
    const reaction=reactToEnemyHit(e,this.sim,move,direction,protection.reduction>0,isMeleeFinisher(attack,this.combat.maxStage)||!!attack.counter,e.type==='guardian'&&(isMeleeFinisher(attack,this.combat.maxStage)||!!attack.counter)&&guardOpen<=this.sim);
    this.settledPlayerHit(e,attack,{...reaction,damage:hit.damage,killed:hit.killed},feedback);
    e.flashUntil = this.sim + move.flash;
    this.float(e.x, e.y, String(Math.round(hit.damage)));
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
  counterHit(target:CombatTarget,attack:Attack,result:{damage:number;guarded:boolean;interrupted:boolean;killed:boolean},legacyHit:'hit'|'straw'='hit',feedback?:StrikeFeedback) {
    if(!attack.counter)return;
    const outcome={sourceId:'player',stage:attack.stage,isFinisher:isMeleeFinisher(attack,this.combat.maxStage),actionKind:attack.kind,damage:result.damage,guarded:result.guarded,interrupted:result.interrupted,killed:result.killed};
    if(attack.delivery==='wind'&&feedback?.point) {
      const d=attack.windDirection!;
      this.emitFeedback('counter-hit',`counter-hit:${attack.id}:${target.id}`,feedback.at??this.sim,target,attack,{point:feedback.point,incoming:{...d},blade:{x:-d.y,y:d.x},depth:target.y+.15,legacyHit,...outcome});
      return;
    }
    const weapon=counterVisual(attack,this.sim,true).weapon!,touch=parryContactPoint(this.state.player,weapon,{x:target.x,y:target.y-28});
    this.emitFeedback('counter-hit',`counter-hit:${attack.id}:${target.id}`,this.sim,target,attack,{point:touch.point,blade:touch.blade,depth:feedbackContactDepth(this.state.player.y,target.y),legacyHit,...outcome});
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
    this.combat.meleeFinisherEnabled=this.state.skills.meleeFinisher;
    const momentum=momentumConfig(this.state);this.combat.momentumWindow=momentum.window;this.combat.momentumChase=momentum.chase;
    if(!momentum.window)this.combat.momentum=null;
    this.swordWind.returnAnchor=()=>({...this.state.player});
  }
  tickAttack(prev:number,now:number) {
    this.syncSwordWindAbility();
    this.combat.update(prev,now,this.battleFacing(),this.state.player,this.combatTargets(),
      (x,y)=>this.playerBlocked(x,y),(x,y,tx,ty,id)=>this.meleeLine(x,y,tx,ty,id),
      (target,stage,attack)=>this.strikeTarget(target,stage,attack),
      (stage,attack)=>{this.runes?.capture(attack);this.training.sync(this.combat.epoch);this.training.begin(attack);if(attack.counter){const m=attackConfig(attack);this.emitFeedback('counter-start',`counter-start:${attack.id}`,attack.start,undefined,attack,{until:attack.start+m.windup+m.active+m.recovery});}if(attack.kind==='swordWind'){attack.returnMode=returnMode(this.state);this.soundFx.play('wind-charge');}},
      stage=>{const a=this.combat.attack!;if(a.counter){if(!feedbackAudio(this.feedback.mode))this.soundFx.play('counter');}else this.soundFx.play(a.kind==='swordWind'?'wind-release':a.isFinisher?'attack-heavy':'attack');},clearMotionLine,
      (attack,root,at)=>{const wind=this.swordWind.launch(attack,root,at,attack.kind==='counter'?outgoingDamage(this.state,attackConfig(attack).damage):attack.swordWind!.damage);if(wind&&attack.kind==='swordWind')this.runes?.engine.windRelease(`attack:${attack.id}`,root,wind.direction,wind.config);});
  }
  clearSwordWind(){this.buildTraining.clear();this.runes?.clear();this.swordWind.clear();this.swordWindView?.clear();this.lessons?.endTrial();}
  resolveSwordWind(events:WindEvent[]){
    for(const wind of this.swordWind.winds)this.runes?.engine.tracePass(wind);
    updateLegacyDevice(this);
    for(const event of events){
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
    this.runes?.advance(now-prev);
    const p=this.state.player,a=this.battleAxis,dt=(now-prev)/1000,length=Math.hypot(a.x,a.y),outside=this.state.life.playerSpace==="village",battlePlayer=outside?p:{x:-10000,y:-10000,hp:0};
    const hazardPrevious={...battlePlayer},companionPrevious=this.xiaobao?.controller?{x:this.xiaobao.controller.x,y:this.xiaobao.controller.y}:null;
    const previousPlayer={...p};
    this.catCompanion.advance(this.state,now-prev,this.cat.sprite,(a,b)=>this.clearLine(a.x,a.y,b.x,b.y));
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
    const movement=this.sprint.update(p.stamina,this.runIntent&&length>0&&!busy,dash?0:dt,prev>=this.combat.regenUntil,playerVitals(this.state).maxStamina,(this.catCompanion.aura?catBenefits(this.state.catBond.score).recovery:0)+giftValue(this.state.windGifts,'breath'));
    p.stamina=movement.stamina;
    const speed=(hurt?0:guard?PARRY.speed:busy?this.combat.attack?55:0:movementSpeed(this.state,movement.speed))*(1+(this.runes?.engine.speedBonus()??0)+giftValue(this.state.windGifts,'stride'));
    if(length&&speed){
      const origin={x:p.x,y:p.y};
      const bodies=this.combatTargets();
      sweepMove(p,a.x/length*speed*dt,a.y/length*speed*dt,(x,y)=>this.playerBlocked(x,y),
        (from,to)=>this.clearLine(from.x,from.y,to.x,to.y),bodies);
      // 紧贴自主奔跑采集，后续攻击、击退和传送绝不能混入里程。
      const gain=recordRunDistance(this.state,origin,p,movement.running&&!busy&&p.hp>0&&!document.hidden&&document.hasFocus());
      if(gain.hp||gain.stamina){
        const vitals=playerVitals(this.state);
        this.ui.message(`旅途锻炼：${[gain.stamina?`体力上限 +${gain.stamina}（${vitals.maxStamina}）`:'',gain.hp?`生命上限 +${gain.hp}（${vitals.maxHp}）`:''].filter(Boolean).join(' · ')}`);
        this.snapshotPending=true;
      }
    }
    this.catCompanion.travel(this.state,previousPlayer,now-prev,!busy&&this.practice.mode==='off'&&!this.lessons?.trial);
    const artCamp=ENCOUNTERS.filter(d=>d.kind==='camp').sort((a,b)=>{const active=(d:typeof a)=>this.combatEncounters.groups[d.id].boss?.stage==='battle'?-100000:0;return active(a)+Math.hypot(a.x-p.x,a.y-p.y)-active(b)-Math.hypot(b.x-p.x,b.y-p.y);})[0];
    if(artCamp&&Math.hypot(artCamp.x-p.x,artCamp.y-p.y)<1500&&!this.enemyView.boss.assets.loading&&!this.enemyView.boss.assets.failure)void this.enemyView.boss.assets.ensure(artCamp.members.find(m=>m.boss)!.boss!).catch(e=>this.ui.message((e as Error).message));
    const camera=this.cameras.main,boss=outside?this.enemies.find(e=>e.boss&&e.hp>0&&Math.hypot(e.x-p.x,e.y-p.y)<650):undefined,baseZoom=this.scale.width/1280;
    camera.setZoom(camera.zoom+(baseZoom*(boss?.82:1)-camera.zoom)*.06);camera.setFollowOffset(boss?(p.x-boss.x)*.45:0,boss?(p.y-boss.y)*.35+220:150);
    const encounterView=this.cameras.main.worldView;
    this.wilderness?.update(now-prev,now,outside?p:this.state.life.outside,{left:encounterView.x,right:encounterView.right,top:encounterView.y,bottom:encounterView.bottom});
    for(const e of this.enemies){if(e.boss)continue;const unit=encounterUnit(e.id);if(!unit)continue;const d=ENCOUNTERS.find(g=>g.id===unit.group)!,way=d.patrol[Math.floor(this.combatEncounters.elapsed/6000)%d.patrol.length];e.patrolTarget={x:unit.x+way.x-d.patrol[0].x,y:unit.y+way.y-d.patrol[0].y};}
    refreshFungalShields([...this.enemies,...this.defense.enemies],now);
    this.syncFungalRoots();
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
      const victim=this.enemyVictim(e),event=this.defense.manages(e)?null:updateEnemy(e,victim.point,now,now-prev,budget,victim.id,(enemy,target)=>this.attackPermit(enemy,target),[...this.enemies,...this.defense.enemies]);
      this.playEnemyAttack(e.attack,now,e);
      const stone=arenaImpact(e,this.state.encounters.broken,now);if(stone){this.state.encounters.broken.push(stone);this.refresh();this.defense.critical=true;this.ui.message("裂岩林豕撞碎石障，正在失衡！");}
      if(event&&victim.id==='xiaobao')this.receiveXiaobao(event,e);else if(event&&outside)contacts.push(event);
    }
    const training=outside?this.practice.update(now,p,this.combat):null;
    this.playEnemyAttack(this.practice.attack,now,this.practice.projection??undefined);
    if(training)contacts.push(training);
    this.syncFungalRoots();
    this.advanceFungalBlasts(now,contacts,outside);
    this.advanceEnemyProjectiles(now,battlePlayer,contacts,outside);
    this.advanceBossHazards(prev,now,battlePlayer,hazardPrevious,companionPrevious,contacts,outside);
    for(const m of motion)m.current={x:m.target.x,y:m.target.y};
    this.resolveSwordWind(this.swordWind.advance(prev,now,motion));
    this.syncXiaobaoEnemies();this.wilderness?.capture(now);
  }
  resolveBattle(now:number,contacts:EnemyContact[],budget:{queries:number}) {
    this.sim=now;
    const p=this.state.player;
    if(this.state.life.playerSpace!=="village"){contacts.length=0;return;}
    for(const action of this.combat.flushActions(now,p)) {
      if(action==="dash"){this.sprint.reset(p.stamina);this.runes?.engine.dashStart(`dash:${this.combat.dashStart}`);}
      else {this.sprint.update(p.stamina,false,0,true,playerVitals(this.state).maxStamina);this.practice.started(now);}
      if(action==='parry')this.emitFeedback('guard-start',`guard:${this.combat.parry!.id}`,now);else this.soundFx.play('dash');
    }
    refreshFungalShields([...this.enemies,...this.defense.enemies],now);
    this.tickAttack(now,now);
    this.resolveSwordWind(this.swordWind.advance(now,now,this.windMotions()));
    for(const e of [...this.enemies].sort((a,b)=>a.id.localeCompare(b.id))) {
      const victim=this.enemyVictim(e),event=this.defense.manages(e)?null:updateEnemy(e,victim.point,now,0,budget,victim.id,(enemy,target)=>this.attackPermit(enemy,target),[...this.enemies,...this.defense.enemies]);
      this.playEnemyAttack(e.attack,now,e);
      const stone=arenaImpact(e,this.state.encounters.broken,now);if(stone){this.state.encounters.broken.push(stone);this.refresh();this.defense.critical=true;this.ui.message("裂岩林豕撞碎石障，正在失衡！");}
      if(event&&victim.id==='xiaobao')this.receiveXiaobao(event,e);else if(event)contacts.push(event);
    }
    const training=this.practice.update(now,p,this.combat);
    this.playEnemyAttack(this.practice.attack,now,this.practice.projection??undefined);
    if(training)contacts.push(training);
    this.advanceFungalBlasts(now,contacts,true);
    this.advanceEnemyProjectiles(now,p,contacts,true);
    this.advanceBossHazards(now,now,p,p,this.xiaobao?.controller??null,contacts,true);
    this.resolveContacts(now,contacts);
  }
  syncFungalRoots(){
    updateBossEnvironment(this);updateSummonSupport(this);
    for(const [id,d] of Object.entries(SOUTH_EVENTS) as [SouthEventId,typeof SOUTH_EVENTS[SouthEventId]][]){
      const key='south-event-'+id,existing=this.enemies.find(e=>e.id===key);
      if(existing){this.state.southEvents[id]=existing.hp;continue;}
      if(this.state.southEvents[id]<=0||Math.hypot(d.x-this.state.player.x,d.y-this.state.player.y)>ENCOUNTER_LIMITS.activateDistance||activeHostileCount(this)>=ENCOUNTER_LIMITS.active)continue;
      const root=this.makeEnemy({id:key,type:'priest',x:d.x,y:d.y});root.hp=this.state.southEvents[id];root.maxHP=d.hp;root.passiveRoot={owner:'event:'+id,index:0,attempt:0};this.enemies.push(root);
    }
    for(const root of this.enemies.filter(e=>e.passiveRoot)){
      const tag=root.passiveRoot!;if(tag.owner.startsWith('event:'))continue;const owner=this.enemies.find(e=>e.id===tag.owner&&e.hp>0&&e.bossAttempt===tag.attempt);
      if(!owner?.bossBattle?.roots){root.hp=0;root.sprite.destroy();root.shadow.destroy();this.enemies=this.enemies.filter(e=>e!==root);continue;}
      const saved=owner.bossBattle.roots[tag.index];if(saved){saved.hp=root.hp;saved.x=root.x;saved.y=root.y;}
    }
    for(const boss of [...this.enemies]){const b=boss.bossBattle;if(!boss.boss||boss.hp<=0||!b)continue;
      b.roots?.forEach((r,index)=>{const id=`${boss.id}:祭根:${boss.bossAttempt??0}:${index}`;
        if(r.hp<=0||this.enemies.some(e=>e.id===id)||activeHostileCount(this)>=ENCOUNTER_LIMITS.active)return;
        const root=this.makeEnemy({id,type:'priest',x:r.x,y:r.y});root.hp=r.hp;root.maxHP=96;root.passiveRoot={owner:boss.id,index,attempt:boss.bossAttempt??0,kind:r.kind??'root'};this.enemies.push(root);
      });
    }
  }
  advanceFungalBlasts(now:number,contacts:EnemyContact[],outside:boolean){
    const peers=[...this.enemies,...this.defense.enemies];
    for(const e of peers){const blast=takeFungalBlast(e,now);if(!blast)continue;
      this.soundFx.play('attack-heavy');
      if(outside){const contact=fungalBlastContact(blast,{...this.state.player,id:'player'});if(contact)contacts.push(contact);}
      const c=this.xiaobao?.controller;if(c?.available){const contact=fungalBlastContact(blast,{x:c.x,y:c.y,id:'xiaobao'});if(contact)this.receiveXiaobao(contact,e);}
      for(const g of this.state.defense.guards){if(g.dead||(g.space??'village')!=='village')continue;const contact=fungalBlastContact(blast,g);if(contact)this.defense.damageGuard({sourceId:e.id,targetId:g.id,attackId:contact.attack.attackId,amount:FUNGAL.blastDamage,sourceScale:this.defense.runeEnemyScale(e.id),sourceType:'enemy-blast',eventId:null},e);}
      for(const person of this.state.life.people){const b=person.body;if(!b||b.hp<=0||b.space!=='village')continue;const contact=fungalBlastContact(blast,{...b,id:person.id});if(contact)this.defense.civilianContact?.(person.id,e,contact);}
      for(const target of peers){if(target===e||target.hp<=0||target.disabled)continue;
        if(!fungalBlastContact(blast,target))continue;
        const hit=resolveBlastDamage({sourceId:e.id,targetId:target.id,attackId:blast.attack.attackId,amount:FUNGAL.friendlyDamage,sourceType:'enemy-blast',eventId:null},
          {id:e.id,hp:e.hp,faction:'hostile',armor:0},{id:target.id,hp:target.hp,faction:'hostile',armor:0,...enemyProtection(target,e,now,true)});
        if(!hit.applied)continue;target.hp=hit.hp;staggerEnemy(target,now,400);if(target.attack)target.attack.cancelled=true;
        if(hit.killed){if(target.kind==='enemy')this.recordEnemyDefeat(target,'guard');else this.defense.settleEnemyDeath(target);}
      }
    }
  }
  advanceBossHazards(prev:number,now:number,p:{x:number;y:number},previous:{x:number;y:number},companionPrevious:{x:number;y:number}|null,contacts:EnemyContact[],outside:boolean){
    for(const e of this.enemies)if(e.hp>0&&!e.disabled){if(e.bossBattle&&now<e.bossBattle.transformUntil)clearBossPendingAttacks(e,prev,this.bossHazards,this.enemyProjectiles);else this.bossHazards.launch(e,now);}
    const c=this.xiaobao?.controller,targets=[...(outside?[{id:'player',...p,previous}]:[]),...(c?.available?[{id:'xiaobao',x:c.x,y:c.y,previous:companionPrevious??c}]:[])];
    for(const event of this.bossHazards.update(prev,now,this.enemies,targets)){
      const source=this.enemies.find(e=>e.id===event.attack.attackerId);
      if(event.targetId==='xiaobao'){if(source)this.receiveXiaobao(event,source);}else contacts.push(event);
    }
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
      const valid=contact.blastId?!!e&&validFungalBlastContact(contact,e,'player'):contact.bossHazardId?!!e&&e.hp>0&&e.bossAttempt===contact.attack.bossAttempt&&(e.type==='geomancer'&&!!e.attack&&!e.attack.cancelled&&contact.bossHazardId.startsWith(e.attack.attackId+':')||!!e.boss&&this.combatEncounters.groups[encounterUnit(e.id)!.group].boss?.stage==='battle'):contact.projectileId?!!projectile&&projectile.state==='contact'&&projectile.attack===contact.attack&&(!contact.training||this.practice.mode!=="off"):
        contact.training?this.practice.mode!=="off":!!e&&e.hp>0&&!e.disabled&&e.attack?.attackId===contact.attack.attackId&&
        (e.kind==="defense-enemy" || enemyAttackPermitted(e,p));
      let result=adjudicateContact(contact,this.combat,p,{valid,maxStamina:playerVitals(this.state).maxStamina,immune:now<this.invulnerable||now<this.respawnInvulnerable||!!this.runes?.engine.immune(),clear:(a,b,id)=>clearMeleeLine(a,b,id),attacker:owner&&owner.hp>0?owner:undefined});
      if(contact.training)this.practice.observe(contact,result,this.combat,p);
      if(contact.projectileId&&contact.attack.parryable&&e&&this.runes?.engine.dash&&valid&&this.runes.engine.reflect(e,contact.attack.attackId)){result='immune';this.runes.engine.fx('mirror-step',contact.origin,42,'r08',350,{end:e});}
      if(result==='hurt'&&!contact.training&&this.runes?.engine.protectHit(e,contact.attack.attackId))result='immune';
      if(result==="normal"||result==="perfect") {
        p.stamina=Math.min(playerVitals(this.state).maxStamina,p.stamina+giftValue(this.state.windGifts,'poise'));
        if(body) {
          if(contact.projectileId&&contact.training&&this.practice.attack)this.practice.attack.cancelled=true;
          body.parried={at:contact.at,until:contact.at+PARRY[result].stagger,direction:{...contact.attack.direction},perfect:result==="perfect"};
          sweepMove(body,-contact.attack.direction.x*PARRY[result].knock,-contact.attack.direction.y*PARRY[result].knock,(x,y)=>this.blocked(x,y),clearMotionLine);
        }
        if(e&&body===e) {
          if(contact.projectileId&&e.attack)e.attack.cancelled=true;
          e.windup=0;
          staggerEnemy(e,contact.at,PARRY[result].stagger);
          if(e.bossBattle)e.bossBattle.exposedUntil=contact.at+PARRY[result].stagger;

          e.nav.path=[];
        }
        if(result==='perfect'&&e&&!contact.training&&this.practice.mode==='off'&&!this.lessons?.trial)this.catCompanion.requestClaw(this.state,this.cat.sprite,e,`parry:${contact.attack.attackId}`,clearMotionLine);
        this.runes?.engine.block(result==='perfect',contact.attack.attackId,contact.origin);
        const guard=this.combat.parry!,w=parryWeapon(guard.facing,1),g=contact.geometry;
        const attackPoint=g?{x:(g.a.x+g.b.x)/2,y:(g.a.y+g.b.y)/2-28}:{x:contact.origin.x,y:contact.origin.y-28};
        const touch=parryContactPoint(p,w,attackPoint),incoming=unit(contact.attack.direction),deflect=deflectDirection(incoming,touch.blade);
        this.emitFeedback(result==='perfect'?'parry-perfect-contact':'parry-contact',`parry:${contact.attack.attackId}`,contact.at,body??undefined,undefined,{attackId:contact.attack.attackId,point:touch.point,incoming,blade:touch.blade,deflect,quality:result,until:contact.at+PARRY[result].stagger,depth:feedbackContactDepth(p.y,body?.y)});
        const legacyTouch=parryContactPoint(p,w,{x:contact.origin.x,y:contact.origin.y-28});
        this.parryEffects.push({at:now,x:legacyTouch.point.x,y:legacyTouch.point.y,perfect:result==='perfect'});
        this.sprint.update(p.stamina,false,0,true,playerVitals(this.state).maxStamina);
        this.ui.update(this.state,this.target?`E · ${this.target.label}`:"");

      } else if(result==="afterguard") {
        this.emitFeedback('afterguard',`afterguard:${contact.attack.attackId}`,contact.at,body??undefined,undefined,{attackId:contact.attack.attackId,point:{x:contact.origin.x,y:contact.origin.y-28},incoming:unit(contact.attack.direction)});
        if(e)e.windup=0;
      } else if(result==="hurt"&&!contact.training) {
        const damage=incomingDamage(this.state,contact.attack.damage)*(this.runes?.engine.incomingScale(contact.attack.attackerId,!!e?.boss)??1);
        const hit=resolveDamage({sourceId:contact.attack.attackerId,targetId:"player",attackId:contact.attack.attackId,
          amount:damage,sourceType:contact.blastId?"enemy-blast":"enemy-melee",eventId:e?.kind==="defense-enemy"?e.eventId:null},
          {id:contact.attack.attackerId,hp:contact.projectileId?1:e?.hp??1,faction:"hostile",armor:0},{id:"player",hp:p.hp,faction:"village",armor:0,flatReduction:giftValue(this.state.windGifts,'armor'),...this.xiaobao?.controller.protection('player')});
        if(hit.applied) {
          const {damage:remaining,hp}=this.catCompanion.protect(this.state,hit);
          p.hp=this.runes?.engine.damaged(e,hp,remaining)??hp;
          if(remaining>0&&this.practice.mode==='off'&&!this.lessons?.trial)this.catCompanion.hurt(this.state);
          this.invulnerable=now+850;
          this.combat.takeHit(now,this.combat.effectiveFacing(now,this.hero.direction),contact.attack.direction,p);
          this.gatherUntil=0;
          this.feedback.cancelRelease();
          this.soundFx.play("hit");
          if(remaining>0)this.float(p.x,p.y,`-${Math.round(remaining)}`);
        }
      }
      this.contactHistory.push({at:contact.at,id:contact.attack.attackId,...contact.attack.boss?{skill:contact.attack.bossSkill,part:contact.attack.bossPart}:{},result,parryAge:this.combat.lastParry?contact.at-this.combat.lastParry.start:null,stamina:p.stamina,hp:p.hp,inputAt:this.combat.lastParryRequestAt,startAt:this.combat.lastParry?.start??null,phase:sampleEnemyAttack(contact.attack,contact.at,contact.origin).phase,predicted:this.warnings.find(w=>w.id===contact.attack.attackId)?.predicted??null,direction:{attack:contact.attack.direction,guard:this.combat.lastParry?.facing},rejection:this.combat.lastRejection});
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
    if(!attack||attack.cancelled)return;
    const runeTarget=[...this.enemies,...this.defense.enemies].find(e=>e.id===attack.attackerId);if(runeTarget){this.runes?.engine.enemyAttempt(runeTarget,attack.attackId);if(runeTarget.hp<=0)return;}
    if(!this.feedback.attackAudible(attack.startedAt,root,this.state.player))return;
    if(!attack.chargeSound){if(root)this.soundFx.creature(attack.type,'charge',Math.hypot(root.x-this.state.player.x,root.y-this.state.player.y),now);this.emitFeedback('enemy-charge',`charge:${attack.attackId}`,now,undefined,undefined,{attackId:attack.attackId,targetId:attack.attackerId,incoming:{...attack.direction}});attack.chargeSound=true;}
    if(now>=attack.contactAt&&!attack.strikeSound){if(root)this.soundFx.creature(attack.type,'strike',Math.hypot(root.x-this.state.player.x,root.y-this.state.player.y),now);this.emitFeedback('enemy-strike',`strike:${attack.attackId}`,attack.contactAt,undefined,undefined,{attackId:attack.attackId,targetId:attack.attackerId,incoming:{...attack.direction}});attack.strikeSound=true;}
  }
  drawEnemyPose(body:AnimatedEnemy&{id:string},attack:EnemyBody["attack"],sprite:Phaser.GameObjects.Sprite) {
    this.enemyView.draw(body,attack,sprite,this.sim,!body.id.startsWith('practice-')&&Math.hypot(body.x-this.state.player.x,body.y-this.state.player.y)<500);
    const impact=this.feedback.impact(body.id,this.sim);if(impact&&body.hp!>0)sprite.setPosition(sprite.x+impact.x,sprite.y+impact.y).setRotation(sprite.rotation+impact.rotation);
    const pose=attack&&!attack.cancelled?sampleEnemyAttack(attack,this.sim,body):null;
    if(!body.boss&&pose?.phase==="active"&&body.type==="leaf"){
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
    this.enemyView.boss.ground(this.bossHazards.hazards,this.state,this.sim);
    for(const e of this.enemies)if(e.boss&&e.hp>0&&e.attack)this.enemyView.boss.warning(e,e.attack,this.sim);
    for(const {root,attack} of sources)if(attack.type==='burrow')this.enemyView.warn(root,attack,this.sim);
    if(!this.practice.indicators){this.enemyView.finishWarnings();return;}
    for(let i=0;i<threats.length;i++){
      const {root,attack:a,predicted}=threats[i],hint=this.warnings[i];if(a.cancelled||a.emitted||this.sim>=a.activeUntil)continue;
      if(!a.boss&&a.type!=='burrow')this.enemyView.warn(root,a,this.sim);
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
    observeCombat(this,delta);
    if(xiaobaoLifeCheck&&this.life){
      let probe=document.getElementById('xiaobao-life-check');
      if(!probe){probe=document.createElement('script');probe.id='xiaobao-life-check';probe.setAttribute('type','application/json');document.body.append(probe);}
      const last=Number(probe.getAttribute('data-at')??-30000);
      if(performance.now()-last>=30000){probe.setAttribute('data-at',String(performance.now()));const nav=this.life.nav('xiaobao');probe.textContent=JSON.stringify({记录时间:new Date().toISOString(),模拟毫秒:this.sim,游戏时间:this.state.time,暂停:this.ui.paused,后台:document.hidden,存档结构:this.state.schema_version,小宝:this.state.xiaobao,居民:this.state.life.people.find(n=>n.id==='xiaobao'),库存:this.state.life.stores,生活耗时:this.life.metrics,寻路:{批次:nav.batches,单批展开:nav.maxExpanded,受阻毫秒:nav.stuck,失败原因:nav.failure,规划中:!!nav.search},对象数:this.children.length,纹理数:this.textures.getTextureKeys().length,来袭:this.state.defense.raid,主线:this.state.quest});}
    }
    this.renderCampRoots();
    const residentTools=document.querySelector<HTMLElement>(".resident-tools");if(residentTools)residentTools.hidden=!this.active||this.ui.paused;
    if (!this.hero) return;
    this.waterEffects?.update(delta, this.active && !this.ui.paused && !document.hidden && !this.defenseSaving && !this.economy.busy);
    this.soundFx.ambience(lightAt(this.state.time).lamps,this.active&&!this.ui.paused&&!document.hidden&&document.hasFocus());
    const flying=this.xiaobao?.controller;this.soundFx.xiaobaoFlight(this.active&&!this.ui.paused&&!document.hidden&&!this.economy.busy&&!this.defenseSaving&&this.state.life.playerSpace==='village'&&!!flying?.airborne,flying?Math.hypot(flying.x-this.state.player.x,flying.y-this.state.player.y):Infinity);
    if (this.keys.take("escape") && this.active && !this.economy.busy && !this.defenseSaving && !this.sessionStarting) {
      this.ui.open("pause");
      this.tweens.pauseAll();
      return;
    }
    if (!this.active || this.ui.paused || this.defenseSaving || this.economy.busy || this.sessionStarting || this.wilderness?.saving || this.wilderness?.checkpointFailed) {
      if(this.active&&!this.ui.paused&&(this.economy.busy||this.defenseSaving))this.commitInputSuspended=true;
      this.pointerAttack = false;
      this.combat.clearInputs(this.sessionStarting?'会话重建':this.economy.busy||this.defenseSaving?'原子事务':'暂停',this.sim);
      this.keys.cancelWind();this.keys.drain();
      this.timeline.reset(performance.now());
      this.tweens.pauseAll();
      return;
    }
    if(this.catSpace!==this.state.life.playerSpace){this.catCompanion.transition();this.catView?.clear();this.catSpace=this.state.life.playerSpace;}
    this.lessons?.checkTrial();
    // 保存冻结期间仍记录物理按键的按下/松开；恢复时只同步方向，不补放攻击。
    if(this.commitInputSuspended){this.battleAxis=this.keys.axis();this.runIntent=this.keys.held.has(" ");this.keys.pressed.clear();this.keys.drain();this.commitInputSuspended=false;}
    this.tweens.resumeAll();
    if(this.keys.take("n")){showNotes(this);return;}
    for (const [k, panel] of [
      ["tab", "bag"],
      ["m", "map"],
      ["q", "quest"],
      ["r", "runes"],
    ])
      if (this.keys.take(k)) {
        this.ui.open(panel);
        return;
      }
    markSaveDirty();
    const p=this.state.player,oldX=p.x,oldY=p.y,prevSim=this.sim;
    const contacts:EnemyContact[]=[];
    const navigationFrame=navigationBudget();
    if(!this.combat.windAuto&&!this.windAim.manual||this.state.life.playerSpace!=="village"||this.state.equipment.head!=="windScope"||!this.state.skills.swordWindStage)this.windAim.clear();
    this.combat.resolveWindAim=(point,config)=>this.state.equipment.head==='windScope'&&this.state.life.playerSpace==='village'?this.windAim.select(point,config,[...this.enemies,...this.defense.enemies].filter(e=>!('passiveRoot' in e&&e.passiveRoot))):null;
    if(this.keys.take(this.ui.hudPreferences.cycleTarget)&&this.keys.held.has('i')&&this.state.equipment.head==='windScope'&&this.state.life.playerSpace==='village'&&this.state.skills.swordWindStage>0&&this.combat.swordWindConfig){this.windAim.cycle(p,this.combat.swordWindConfig,[...this.enemies,...this.defense.enemies].filter(e=>!('passiveRoot' in e&&e.passiveRoot)));}
    this.combat.dashCostMultiplier=(this.runes?.engine.dashCost()??1)*(1-giftValue(this.state.windGifts,'thrift'));
    this.combat.recoveryCancelEnabled=this.runes?.engine.has('r09')??false;
    this.sim=this.timeline.frame(this.sim,performance.now(),delta,this.keys.drain(),this.combat,{
      beforeInput:(now)=>this.resolveContacts(now,contacts,true),
      boundary:(now)=>Math.min(this.combat.nextBoundary(now),this.practice.boundary(now),
        ...this.enemies.flatMap(e=>[e.attack?.lockAt??Infinity,e.attack?.contactAt??Infinity,e.attack?.activeUntil??Infinity,e.attack?.recoveryUntil??Infinity,e.staggerUntil]).filter(t=>t>now+1e-7)),
      advance:(prev,now)=>this.advanceBattle(prev,now,contacts,navigationFrame),
      input:(events,now)=>{
        this.sim=now;
        for(const event of events){this.battleAxis=event.axis;this.runIntent=!!event.running;this.combat.setIntent(event.axis);this.combat.windHeld=!!event.windHeld;this.combat.windAuto=!!event.windAuto;this.inputHistory.push({at:now,wall:event.at,sequence:event.sequence,kind:event.kind,facing:this.combat.intentFacing,rejection:''});}if(this.inputHistory.length>160)this.inputHistory.splice(0,this.inputHistory.length-160);
        const actions=events.filter((e):e is typeof e & {kind:"attack"|"wind"|"parry"|"dash"}=>e.kind!=="axis"&&this.state.life.playerSpace==="village");
        this.combat.requestActions(actions,now,p,this.combat.intentFacing);
        for(const row of this.inputHistory.slice(-events.length))if(row.kind!=='axis')row.rejection=this.combat.lastRejection;
      },
      resolve:(now)=>this.resolveBattle(now,contacts,navigationFrame),
    });
    if(!this.combat.windHeld)this.keys.cancelWind();
    const dt=(this.sim-prevSim)/1000,a=this.battleAxis,length=Math.hypot(a.x,a.y),nextFacing=this.battleFacing();
    // 原始引擎帧间隔包含长帧；性能诊断不能用平滑值或排除慢帧。
    this.fps.push(1000/Math.max(.001,this.game.loop.rawDelta));
    if(this.fps.length>1200)this.fps.shift();
    if(this.combat.hitStopRemaining>0)this.tweens.pauseAll();
    this.feedback.advance(this.sim,this.combat.attack?.counter?`player:${this.combat.attack.id}`:null,!!this.combat.autoCounter||this.combat.parry?.successAt!==undefined);
    const feedbackEvents=this.feedback.drain();
    this.soundFx.feedbackBatch(feedbackEvents,this.feedback.mode);
    this.swordWindView?.draw(this.sim);this.lessons?.draw(this.sim);
    const aimed=[...this.enemies,...this.defense.enemies].find(e=>e.id===this.windAim.target&&e.hp>0&&!e.disabled);
    this.ui.windAimStatus(this.state.skills.swordWindStage===0?'瞄准镜 · 尚未学会剑风':aimed?`I 自动瞄准 · 已锁定 / ${this.ui.hudPreferences.cycleTarget.toUpperCase()} 切换 / 中键手动`:this.combat.windAuto?'无可锁定目标 · 手动剑风':'瞄准镜 · 按住 I 自动瞄准 / 中键手动',this.state.skills.swordWindStage===0?'I 未学习':aimed?'I 已锁定':this.combat.windAuto?'I 手动剑风':'I 自动瞄准',this.state.equipment.head==='windScope');
    if(!this.scopeMarker)this.scopeMarker=this.add.graphics();this.scopeMarker.clear();
    if(aimed&&this.state.equipment.head==='windScope'&&this.combat.windAuto&&feedbackVisual(this.feedback.mode))this.scopeMarker.lineStyle(2,0xc1ffe6,.9).strokeCircle(aimed.x,aimed.y,20).setDepth(aimed.y+.2);

    const hurting=this.combat.hurting(this.sim);
    if (!hurting && !this.combat.attack && !this.combat.parry && this.sim>=this.combat.dashUntil && length)
      this.hero.motion.direction=nextFacing;
    if(length&&!this.combat.attack&&!this.combat.parry&&this.sim>=this.combat.dashUntil)this.combat.leaveReady(this.sim);
    if(!length&&!this.combat.attack&&this.sim<this.combat.readyUntil)this.hero.motion.direction=this.combat.lastFacing;
    const striking = this.combat.attack;
    const arrivingBoss=!length&&!hurting&&!striking&&!this.combat.parry&&this.sim>=this.combat.dashUntil&&this.sim>=this.gatherUntil&&this.state.life.playerSpace==='village'?this.enemies.find(e=>e.boss&&e.hp>0&&e.bossBattle&&this.sim<e.bossBattle.entryUntil&&Math.hypot(e.x-p.x,e.y-p.y)<500):undefined;
    const alert=arrivingBoss?alertVisual(nextFacing,1-(arrivingBoss.bossBattle!.entryUntil-this.sim)/BOSS_RULES.appearance):undefined;
    if(alert)this.hero.motion.direction=alert.facing;
    this.attackSerial = this.combat.serial;
    this.attackUntil = striking
      ? striking.start + this.combat.total(striking.stage)
      : 0;
    this.hero.scopeEquipped=this.state.equipment.head==='windScope';
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
            ...(striking.kind==='swordWind'?swordWindVisual(striking.facing,this.sim-striking.start,attackConfig(striking)):combatVisual(
              striking.stage,
              striking.facing,
              this.sim - striking.start,
              !!striking.enter,
              attackConfig(striking),
            )),
            weapon: striking.kind==='swordWind'?swordWindVisual(striking.facing,this.sim-striking.start,attackConfig(striking)).weapon:weaponSample(
              striking.stage,
              striking.facing,
              this.sim - striking.start,
              attackConfig(striking),
            ),
          }
        : alert ?? (this.sim < this.combat.readyUntil &&
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
            : undefined),
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
    this.hero.setAlpha(
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
    let next = this.follower.update(
      p,
      { x: cat.x, y: cat.y },
      dt,
      (a, b) => this.clearLine(a.x, a.y, b.x, b.y),
      (x, y) => this.blocked(x, y),
    );
    const catTargets=[...this.enemies,...this.defense.enemies].filter(e=>e.hp>0&&!e.disabled);
    this.catCompanion.sniff(this.state,cat,(a,b,ignore)=>this.clearLine(a.x,a.y,b.x,b.y,ignore),this.practice.mode!=='off'||!!this.lessons?.trial||catTargets.some(e=>Math.hypot(e.x-p.x,e.y-p.y)<320));
    let catGoal=this.catCompanion.pounceGoal(this.state,cat,catTargets,clearMotionLine);
    const pouncing=!!this.catCompanion.pounce;
    if(!catGoal&&!length&&this.catCompanion.aura&&this.follower.stationary>1&&!striking&&!this.combat.parry){
      const hint=this.catCompanion.hint;
      if(hint){const gap=Math.hypot(hint.x-p.x,hint.y-p.y)||1;catGoal={x:p.x+(hint.x-p.x)/gap*90,y:p.y+(hint.y-p.y)/gap*90};}
      else if(this.state.catBond.score>=20||this.sim<this.catCareUntil)catGoal={x:p.x+42,y:p.y+18};
    }
    if(catGoal&&!this.blocked(catGoal.x,catGoal.y)&&this.clearLine(cat.x,cat.y,catGoal.x,catGoal.y)){
      const gap=Math.hypot(catGoal.x-cat.x,catGoal.y-cat.y),step=Math.min(gap,(pouncing?420:90)*dt);
      next={x:cat.x,y:cat.y};if(gap>1)sweepMove(next,(catGoal.x-cat.x)/gap*step,(catGoal.y-cat.y)/gap*step,(x,y)=>this.blocked(x,y),(a,b)=>this.clearLine(a.x,a.y,b.x,b.y));
    }
    this.cat.move(
      next.x,
      next.y,
      next.x - cat.x,
      next.y - cat.y,
      this.sim,
      false,
      dt,
    );
    for(const event of this.catCompanion.drain()){
      this.catView?.event(event,this.sim);
      if(event.kind==='unlock'||event.kind==='hint')this.ui.message(event.text);
      else if(event.kind!=='claw')this.float(event.point.x,event.point.y-26,event.text);
      if(['hint','claw','guard'].includes(event.kind))this.soundFx.play('cat-meow');
      if(['bond','unlock','guard','claw','absorb'].includes(event.kind))this.snapshotPending=true;
    }
    this.catView?.draw(this.state,this.catCompanion,this.cat,this.sim,catTargets);
    this.xiaobao?.render(this.state.life.playerSpace===this.state.xiaobao.space,xiaobaoAllies(this));
    if(this.xiaobao){const c=this.xiaobao.controller;this.ui.xiaobaoStatus(`小宝 · ${c.data.task==='follow'?'随行':c.data.task==='guard'?'守村':'生活'} · ${Math.ceil(c.data.hp)}/640${c.data.life.emergency?' · 优先护村':''}${c.data.rest?' · 调息':c.data.flight?` · 飞援${c.snapshot().eta.toFixed(1)}秒`:''}`);}
    if(this.xiaobao)for(const event of this.xiaobao.controller.drain())this.soundFx.xiaobao(event,Math.hypot(event.point.x-p.x,event.point.y-p.y),this.state.life.playerSpace==='village');
    this.target = [...lifeTargets(this),...(this.state.life.playerSpace===this.state.xiaobao.space&&this.xiaobao?[this.xiaobao.controller.target()]:[]),...(this.state.life.playerSpace==="village"?props.filter(p=>p.kind!=="npc"):[]),...(this.state.life.playerSpace==="village"&&canDiscover(this.state)?[{...NIGHT_DISCOVERY,art:"",w:0,h:0,kind:"sign" as const}]:[])]
      .filter(
        (o) =>
          o.kind &&
          Math.hypot(o.x - p.x, o.y - p.y) < 95 &&
          this.clearLine(p.x, p.y, o.x, o.y, o.id),
      )
      .sort(
        (a, b) =>
          Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y) ||
          Number(b.id.startsWith("service-")) - Number(a.id.startsWith("service-")) ||
          Number(b.id.startsWith("life-door:")) - Number(a.id.startsWith("life-door:")) ||
          a.id.localeCompare(b.id),
      )[0];
    const memoryCamp=!this.target&&ENCOUNTERS.find(d=>d.kind==='camp'&&this.state.encounters.groups[d.id].cleared&&Math.hypot(d.x-this.state.player.x,d.y-this.state.player.y)<180);
    if(memoryCamp&&this.keys.take('e'))this.ui.open('wind-memory');
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
    this.enemyView.mechanics([...this.enemies,...this.defense.enemies],this.sim);
    this.enemyView.projectile(this.enemyProjectiles,this.sim,this.state.life.playerSpace==="village");
    this.runes?.update();
    this.hero.setAlpha(this.hero.sprite.alpha*(this.runes?.alpha()??1));
    this.syncDrops();
    const defenseEvents=this.defense.drainNotices();
    this.life.consumeDefense(defenseEvents);
    for(const event of defenseEvents) {
      if(event.kind==="hit"){const e=this.enemies.find(e=>e.id===event.id);if(e&&e.hp>0)this.soundFx.creature(e.type,"hurt",Math.hypot(e.x-p.x,e.y-p.y),this.sim);}
      if(event.kind==="hit"&&event.damage!==undefined&&event.x!==undefined&&Math.hypot(event.x-p.x,event.y!-p.y)<600)
        this.float(event.x,event.y!,`-${Math.round(event.damage)}`);
      if(event.kind==="death"&&this.state.defense.guards.some(g=>g.id===event.id))this.ui.message("守卫阵亡；不会因读档自动复活。");
      if(event.kind==="death"){const enemy=this.enemies.find(e=>e.id===event.id);if(enemy)this.recordEnemyDefeat(enemy,"guard");}
      if(event.kind==="warning")this.ui.message(`${event.id}外发现动静，卫队正在戒备。`);
      if(event.kind==="started")this.ui.message(this.state.defense.raid?.order?.retaliationCamp?`魔王报复部队已从地图边缘出发：${retaliationSummary(this.state.defense.raid.order)}，正向${event.id}行军！`:this.state.defense.raid?.order?.source==='demon-king'?`${event.id}遭遇${DEMON_KING.name}的派遣，共 ${this.state.defense.raid.members.length} 只；防线可能需要支援。`:`${event.id}有小怪接近；卫队会自行拦截。`);
      if(event.kind==="delayed")this.ui.message("防线健康、岗位或路径条件已变化；本次未出生来袭已取消并延期。");
      if(event.kind==="ended")this.ui.message("村门来袭已结束，驻防变化正在保存。");
    }
    const indoorCamera=this.state.life.playerSpace!=="village";
    if(indoorCamera!==this.cameraIndoor){
      this.cameraIndoor=indoorCamera;
      if(indoorCamera)this.cameras.main.stopFollow().centerOn(700,690);
      else this.cameras.main.startFollow(this.hero.sprite,true,0.1,0.1,0,150);
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
    if(this.snapshotPending||this.sim>=this.nextSnapshot){this.snapshotPending=false;this.nextSnapshot=this.sim+5000;void this.persist().catch(()=>{});}
    if (p.hp <= 0) {
      this.catCompanion.transition();this.catView?.clear();this.state.catBond.shield=0;this.state.catBond.shieldTime=0;
      this.wilderness?.resetBosses();
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
      const vitals = playerVitals(this.state);
      p.hp = vitals.maxHp;
      p.stamina = vitals.maxStamina;
      this.sprint.reset(p.stamina);
      p.x = RETURN_WIND_ORB.respawn.x;
      p.y = RETURN_WIND_ORB.respawn.y;
      this.xiaobao?.controller.transitioned(p);
      this.follower.reset(this.state.player);
      this.cat.place(592, 738);
      this.windAim.clear();
      this.hero.place(p.x, p.y);
      this.respawnInvulnerable = this.sim + 2000;
      // 回村反馈由归风珠统一说明，避免随后的一般抵达提示将其覆盖。
      this.lastRegion = this.state.life.playerSpace === "village" ? region(p.x, p.y) : "室内";
      this.ui.message(RETURN_WIND_ORB.message);
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
    const status=attack?.kind==='swordWind'?'I／中键独立剑风 · 松开停止':combat.momentum&&this.sim<=combat.momentum.until?`续势 ${((combat.momentum.until-this.sim)/1000).toFixed(1)}秒 · J 接第${combat.momentum.stage}刀`:attack&&attack.stage<combat.maxStage?combat.pending?`已预约第${attack.stage+1}刀`:`J 接第${attack.stage+1}刀`:!attack&&this.sim<=combat.chainUntil&&combat.nextStage>1?`J 接第${combat.nextStage}刀`:combat.autoCounter?'成功 · 自动反斩；J 接第二刀':p.stamina<PARRY.cost?'K · 体力不足':combat.diagnostic(this.sim).status;
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
    else if(!this.showDemonKingIntroduction()&&this.sim>=this.nextNightAttempt&&!this.economy.busy&&!this.defenseCheckpointPending){
      if(mayStartRetaliation(this.state))void this.startNightRaid(true);
      else if(mayStartNight(this.state))void this.startNightRaid();
    }
  }
}
