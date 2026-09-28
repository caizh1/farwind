import {LESSON_IDS,type LessonId} from '../../data/windLessons';
import {lifeInteract,offerHelp} from '../ui/npcLife';
import type {ResidentId} from '../../data/npcLife';
import type { ShopId } from "../../data/economy";
import { type Prop } from "../../data/world";
import { items } from "../../data/content";
import { add, remove, count, reward } from "./state";
import type { World } from "../scenes/World";

export function interact(this: World, p: Prop) {
  if(p.id === "xiaobao"){this.xiaobao?.open(this);return;}
  if(p.id.startsWith("lesson-")&&LESSON_IDS.includes(p.id.slice(7) as LessonId)){this.lessons?.open(p.id.slice(7) as LessonId);return;}
  if(p.id==="waterside-night"){void this.discoverNight();return;}
  if(lifeInteract(this,p))return;
  const s = this.state;
  this.soundFx.play("talk");
  if (p.id === "healer" || p.id.startsWith("service-")) {
    this.state.dashCooldownRemaining = Math.max(
      0,
      this.combat.dashCooldown - this.sim,
    );
    if (p.id === "healer") {
      this.ui.dialog(
        p.label!,
        `${this.life.dialogue("healer")}\n带来药草×2和浆果×1，我可以替你调制恢复药剂。先查看药师服务，核对材料并确认后才调药；只是交谈不会消耗材料。`,
        p.id,
      );
      this.ui.offerShop("healer");offerHelp(this,"healer");
    } else this.ui.shop(p.id.slice(8) as ShopId);
    return;
  }
  if (p.id === "barracks-sign") {
    this.ui.dialog(
      "风铃营房",
      "这里是卫队驻地。九名卫兵分守东、北、南门。遇到普通来袭会自行拦截；目前没有招募或复活服务。",
    );
    return;
  }
  if(p.id === "east-gate-sign") { this.openDefenseDrill(); return; }
  if (p.id === "north-gate-sign" || p.id === "south-gate-sign") {
    this.ui.dialog(p.label!,p.id === "north-gate-sign" ? "松岚、石泉与林弦守望山路。门外道路属于巡逻近郊，远处才是荒野。卫队会拦截逼近者，威胁退出后归岗，不会追进深林。" : "麦川、望禾与晴羽照看门外巡逻近郊，远处才是荒野。夜间少量来袭由卫队拦截，虚弱或缺员时延期，门洞保持开放。");return;
  }
  if (p.kind === "npc") {
    const talk = (text: string) => {this.ui.dialog(p.label!, `${text}\n${this.life.dialogue(p.id as ResidentId)}`, p.id);offerHelp(this,p.id as ResidentId);};
    if (p.id === "elder") {
      if (s.quest === 0) {
        s.quest = 1;
        talk(
          "东边的森林昨夜传来奇怪的风声。替我去看看吧。先找些药草和浆果，路上记得照顾好自己。南侧木桥的守风教本记着送风之法：面向北方，三连斩后再送出第四击，便能触到水面远铃。你也可以先去读教本，不必等我。",
        );
      } else if (s.quest === 6) {
        if (reward(s)) {
          talk(
            "风铃又响起来了！你和小黑做到了。带上这三瓶药剂，远方还有许多故事。",
          );
          void this.persist().catch(() => {});
        } else this.ui.message("请先腾出行囊空间领取奖励。");
      } else
        talk(
          s.quest === 7
            ? "风会记住你的脚步。随时回来坐坐。"
            : "顺着东边的石路走。古碑说：晨风起，林风和，暮风归。",
        );
    }
    if (p.id === "carpenter") {
      if (s.side === 0) {
        s.side = 1;
        talk("栅栏要修一修。能替我带来四份木材吗？森林路边的枯枝就很好。");
      } else if (s.side === 1 && count(s, "wood") >= 4) {
        const next = structuredClone(s);
        remove(next, "wood", 4);
        if (add(next, "berry", 5)) {
          s.bag = next.bag;
          s.side = 2;
          talk("正好！这些浆果给你，路上慢慢吃。");
        } else this.ui.message("行囊空间不足，尚未扣除木材。");
      } else
        talk(
          s.side === 2
            ? "新的栅栏很结实。谢谢你，旅人。"
            : "四份木材就够了，不必砍活着的树。",
        );
    }
  }
  if (p.kind === "npc") void this.persist().catch(() => {});
  if (p.kind === "resource") {
    if (s.collected[p.id] !== undefined && s.time - s.collected[p.id] < 180) {
      this.ui.message("这里已采集，三个游戏小时后再生。");
      return;
    }
    if (add(s, p.item!, p.item === "herb" ? 2 : 2)) {
      s.collected[p.id] = s.time;
      this.soundFx.play("pick");
      this.gatherUntil = this.sim + 260;
      this.float(p.x, p.y, `${items[p.item!].name} +2`);
      this.ui.message(`获得${items[p.item!].name} ×2`);
      this.refresh();
    } else this.ui.message("行囊已满，请先使用或整理物品。");
  }
  if (p.kind === "chest" && !s.chests.includes(p.id)) {
    const id = p.id === "hidden-chest" ? "charm" : "potion";
    if (add(s, id, 1)) {
      s.chests.push(p.id);
      this.soundFx.play("success");
      this.ui.message(`宝箱奖励：${items[id].name} ×1`);
      this.refresh();
      void this.persist().catch(() => {});
    } else this.ui.message("行囊已满，宝箱保留未打开。");
  }
  if (p.kind === "stone") {
    if (s.quest < 4) {
      this.ui.message("风石没有回应。先帮助森林恢复平静。");
      return;
    }
    const expected = s.stones.length;
    if (p.index === expected) {
      s.stones.push(p.index);
      this.soundFx.play("success");
      this.ui.message(`第 ${expected + 1} 道风声已回应`);
      if (s.stones.length === 3) {
        s.quest = 5;
        this.ui.message("三风相和！现在修复中央的风之路标。");
      }
      this.refresh();
    } else if (!s.stones.includes(p.index!)) {
      s.stones = [];
      this.refresh();
      this.ui.message("风声散去了。碑文：晨风起，林风和，暮风归。");
    }
  }
  if (p.id === "village-guide")
    this.ui.dialog(
      "东村口路牌",
      "向东：翡翠森林与风之遗迹。向西：风铃广场。\n北面练习场可练三连击与风步，南面环湖小径经过果园回到广场。",
    );
  if (p.id === "training-guide")
    this.ui.dialog(
      "练习场须知",
      "J / 左键挥剑，连续按下接三连击；从木桩四面靠近练习朝向。L 风步可快速移动，不能穿过木桩与围栏。练习不消耗任务物品、不掉落战利品。",
    );
  if (
    [
      "north-gate-sign",
      "south-gate-sign",
      "east-gate-sign",
      "west-gate-sign",
    ].includes(p.id)
  )
    this.ui.dialog(
      p.label!,
      p.id === "west-gate-sign"
        ? "西侧预留出口尚未开放，木栅仍封闭。请走北门、南门或东门。"
        : p.id === "east-gate-sign"
          ? "沿石路穿过东门进入翡翠森林，原主线仍从这里出发。"
          : "门外的山路与荒野尚未深入探明。谨慎前行，沿路返回。",
    );
  if (p.id.startsWith("parcel-") && p.id.endsWith("-sign"))
    this.ui.dialog(
      p.label!,
      "这座小院留给未来村庄建设，目前可以散步，没有商店或委托服务。",
    );
  if (p.id === "clue")
    this.ui.dialog(
      "被风磨亮的碑文",
      "晨风自西方醒来，林风在北方低吟，暮风向东方归去。循此顺序，三风相和。修复需要风之结晶、木材 ×2、石材 ×2。",
      "rune",
    );
  if (p.id === "waymark") {
    if (s.quest === 5) {
      if (
        count(s, "wood") >= 2 &&
        count(s, "stone") >= 2 &&
        count(s, "crystal") >= 1
      ) {
        remove(s, "wood", 2);
        remove(s, "stone", 2);
        remove(s, "crystal", 1);
        s.shortcut = true;
        s.quest = 6;
        this.soundFx.play("success");
        this.refresh();
        this.ui.dialog(
          "风之路标",
          "沉睡的风再次流动。南面的归乡风径已经开放，回村告诉岚爷爷吧。",
          "rune",
        );
        void this.persist().catch(() => {});
      } else this.ui.message("修复需要：木材 ×2、石材 ×2、风之结晶 ×1。");
    } else
      this.ui.message(
        s.shortcut ? "风之路标正轻轻歌唱。" : "先依照古碑线索唤醒三块风石。",
      );
  }
  if (p.kind === "shortcut") {
    if (s.shortcut) {
      this.combat.reset(this.combat.dashCooldown);
      this.pointerAttack = false;
      this.attackUntil = 0;
      this.slash?.clear();
      s.player.x = 740;
      s.player.y = 780;
      this.xiaobao?.controller.transitioned(s.player);
      this.cat.place(662, 798);
      this.hero.place(s.player.x, s.player.y);
      this.follower.reset(s.player);
      this.ui.message("归乡的风把你送回了广场。");
      void this.persist().catch(() => {});
    } else this.ui.message("归乡风径尚未开放。");
  }
}
