import {
  WIND_LESSONS,
  LESSON_IDS,
  lessonById,
  WIND_NAMES,
  WIND_EFFECTS,
  type LessonId,
} from "../../data/windLessons";
import {
  resolveSwordWindConfig,
  type SwordWindConfig,
} from "../../data/swordWind";
import { completeWindLesson, effectiveWindStage, windLessonStatus } from "./skills";
import type { World } from "../scenes/World";
import type { State } from "./state";
import { save } from "./save";
import type { WindEvent, WindTarget } from "./swordWind";
import type Phaser from "phaser";
import { WindChimeView } from "../entities/windChimeView";

// 风铃是世界中的独立悬挂机关，不占敌人的命中名额。
const target=(lessonId:LessonId,id:string,dx:number,dy:number,radius=14):WindTarget=>({id,lessonId,x:lessonById(lessonId).stand.x+dx,y:lessonById(lessonId).stand.y+dy,windSensitive:true,radius,hp:1e9});
export const lessonTargets:WindTarget[]=[
  target(LESSON_IDS[0],'lesson-water-bell',0,-240,18),
  target(LESSON_IDS[0],'lesson-water-followup',120,-160,18),
  ...[110,200].map((x,i)=>target(LESSON_IDS[1],`lesson-serial-bell-${i}`,x,-20,10)),
  ...[80,160,240,370].map((x,i)=>target(LESSON_IDS[2],`lesson-through-${i}`,x,0)),
  ...[-36,36].map((x,i)=>target(LESSON_IDS[3],`lesson-wide-${i}`,x,-440,10)),
  target(LESSON_IDS[4],'lesson-three-left',-130,-225),
  target(LESSON_IDS[4],'lesson-three-center',0,-260),
  target(LESSON_IDS[4],'lesson-three-right',90,-206),
];
type Request = { id: LessonId; change?: (s: State) => void; complete: boolean };
export class WindLessons {
  trial: LessonId | null = null;
  pending: Request | null = null;
  private saving = false;
  private visuals: Phaser.GameObjects.GameObject[] = [];
  private targetViews = new Map<
    string,
    {
      chime: WindChimeView;
      at: number;
      hits: number;
      release: number;
      damage: number;
    }
  >();
  private flow: Phaser.GameObjects.Graphics;
  private siteLabels:{x:number;y:number;text:Phaser.GameObjects.Text}[]=[];
  private vines:Phaser.GameObjects.Image;
  private branches:Phaser.GameObjects.Image;
  private sails:Phaser.GameObjects.Image[]=[];
  static preload(scene:Phaser.Scene){WindChimeView.preload(scene);}
  readonly targets = lessonTargets.map((t) => ({ ...t }));
  constructor(private world: World) {
    const scene = world;
    this.flow = scene.add.graphics().setDepth(-2);
    this.visuals.push(this.flow);
    for (const l of WIND_LESSONS) {
      const marker = scene.add
        .graphics()
        .setDepth(-1)
        .lineStyle(2, 0xb2d7bd, 0.7)
        .strokeEllipse(l.stand.x, l.stand.y, 48, 22);
      const text = scene.add
        .text(l.x, l.y + 12, l.name, {
          fontSize: "13px",
          color: "#fff2d3",
          stroke: "#264938",
          strokeThickness: 4,
        })
        .setOrigin(0.5, 0)
        .setDepth(l.y + 2);
      this.visuals.push(marker, text);
      this.siteLabels.push({x:l.x,y:l.y,text});
    }
    const serial=lessonById(LESSON_IDS[1]).stand,long=lessonById(LESSON_IDS[2]).stand;
    this.vines=scene.add.image(serial.x+110,serial.y-38,'bush').setDisplaySize(40,26).setDepth(serial.y+.4);
    this.branches=scene.add.image(long.x+130,long.y,'wood').setDisplaySize(80,32).setDepth(long.y+.4);
    this.sails=['left','right'].map(side=>world.propImages.get(`lesson-sail-${side}`)!);
    this.visuals.push(this.vines,this.branches);
    const wSound=(t:WindTarget,index:number)=>world.soundFx.chime(index%3,Math.hypot(world.state.player.x-t.x,world.state.player.y-t.y),world.sim);
    for(const [index,t] of this.targets.entries()){
      const order=index-this.targets.findIndex(other=>other.lessonId===t.lessonId);
      const chime=new WindChimeView(scene,t.x,t.y,order*220,()=>wSound(t,order));
      this.targetViews.set(t.id,{chime,at:-1e6,hits:0,release:0,damage:0});
    }
    scene.events.once("shutdown", () => {
      this.endTrial();
      for (const v of this.visuals) v.destroy();
      this.visuals = [];
      for(const v of this.targetViews.values())v.chime.destroy();
      this.targetViews.clear();
    });
  }
  endTrial() {
    this.trial = null;
  }
  reset() {
    this.trial = null;
    this.pending = null;
    this.saving = false;
    for (const v of this.targetViews.values()) {
      v.at = -1e6;
      v.hits = 0;
      v.release = 0;
      v.damage = 0;
      v.chime.reset();
    }
  }
  config(): SwordWindConfig | null {
    const stage = this.trial
      ? lessonById(this.trial).stage
      : effectiveWindStage(this.world.state);
    if (!stage) return null;
    const config = resolveSwordWindConfig(stage);
    if (this.trial) config.trialLesson = this.trial;
    return config;
  }
  checkTrial() {
    if (!this.trial) return;
    const l = lessonById(this.trial),
      p = this.world.state.player;
    if (
      this.world.state.life.playerSpace !== "village" ||
      p.hp <= 0 ||
      Math.abs(p.x - l.stand.x) > 170 ||
      Math.abs(p.y - l.stand.y) > 150
    ) {
      this.endTrial();
      this.world.clearSwordWind();
      this.world.combat.cancelAttack();
      this.world.ui.message("已离开教学范围，临时试用结束；正式本领保留。");
    }
  }
  private button(text: string, run: () => void) {
    const b = document.createElement("button");
    b.textContent = text;
    b.onclick = run;
    let group = this.world.ui.modal.querySelector(".lesson-actions");
    if (!group) {
      group = document.createElement("div");
      group.className = "lesson-actions";
      this.world.ui.modal.querySelector(".dialog-copy")!.append(group);
    }
    group.append(b);
  }
  open(id: LessonId) {
    const w = this.world,
      l = lessonById(id),
      done = w.state.skills.completedLessons.includes(id);
    if (Math.hypot(w.state.player.x - l.x, w.state.player.y - l.y) > 110)
      return;
    w.ui.dialog(
      l.name,
      `${l.hint}\n${done ? windLessonStatus(w.state.skills, id) : "成长来自这次具体经历，不需要击杀、材料或重复练习。"}\n${!done && (id === LESSON_IDS[0] || id === LESSON_IDS[3]) ? "圆形铺垫标示试用站位。按 I／中键独立送风；按住可持续施放；面向北方。临时能力仅用于教学风铃。" : ""}`,
      "rune",
    );
    if (this.pending?.id === id) {
      this.button(
        "重试保存已完成的经历",
        () => void this.submit(this.pending!),
      );
      return;
    }
    if (!w.state.skills.discoveredLessons.includes(id)) void this.discover(id);
    if (id === LESSON_IDS[0] || id === LESSON_IDS[3]) {
      this.button(done ? "重看动作与用途" : "开始限定试用", () => {
        if (!done) this.trial = id;
        w.ui.close(true);
        w.ui.message(
          done
            ? WIND_EFFECTS[w.state.skills.swordWindStage]
            : "临时试用：站上铺垫，面向北方，按 I／中键独立送风。离开范围后结束。",
        );
      });
    }
    if (!done && id === LESSON_IDS[1])
      this.button("解开缠住铃绳的藤蔓",()=>void this.submit({id,change:s=>s.skills.devices.serialValve=1,complete:true}));
    if (!done && id === LESSON_IDS[2])
      this.button("清走挡风的落枝",()=>void this.submit({id,change:s=>s.skills.devices.leakClosed=true,complete:true}));
    if (!done && id === LESSON_IDS[4]) {
      if(w.state.skills.devices.splitLeft!==1)this.button("扶正左侧风帆",()=>void this.submit({id,change:s=>s.skills.devices.splitLeft=1,complete:false}));
      if(w.state.skills.devices.splitRight!==2)this.button("扶正右侧风帆",()=>void this.submit({id,change:s=>s.skills.devices.splitRight=2,complete:false}));
    }
    if (this.trial)
      this.button("结束临时试用", () => {
        this.endTrial();
        w.clearSwordWind();
        w.combat.cancelAttack();
        w.ui.close(true);
      });
  }
  private async discover(id: LessonId) {
    const w = this.world;
    if (w.economy.busy) return;
    try {
      await w.economy.run(
        () => w.state,
        (s) => {
          const next = structuredClone(s);
          if (!next.skills.discoveredLessons.includes(id))
            next.skills.discoveredLessons.push(id);
          return next;
        },
        save,
        (next) => w.publishState(next),
      );
    } catch (e) {
      w.ui.message(`线索尚未保存：${(e as Error).message}；重新阅读可重试。`);
    }
  }
  adjustSail(side:'left'|'right'){
    const l=lessonById(LESSON_IDS[4]),d=this.world.state.skills.devices,p=this.world.state.player;
    if(Math.hypot(p.x-l.stand.x-(side==='left'?-70:70),p.y-l.stand.y)>110)return;
    if(side==='left'?d.splitLeft===1:d.splitRight===2){this.world.ui.message('这面风帆已经立稳，铜铃正在随风鸣响。');return;}
    void this.submit({id:l.id,complete:false,change:s=>{if(side==='left')s.skills.devices.splitLeft=1;else s.skills.devices.splitRight=2;}});
  }
  async submit(request: Request) {
    const w = this.world;
    if (this.saving) return;
    this.pending = request;
    if (w.economy.busy) {
      w.ui.message(
        "有效经历待保存；当前提交完成后，重新阅读装置即可重试，无需重复解谜。",
      );
      return;
    }
    this.saving = true;
    const before = w.state.skills.swordWindStage;
    try {
      await w.economy.run(
        () => w.state,
        (s) => {
          let next = structuredClone(s);
          request.change?.(next);
          if (!next.skills.discoveredLessons.includes(request.id))
            next.skills.discoveredLessons.push(request.id);
          const split =
            request.id === LESSON_IDS[4] &&
            next.skills.devices.splitLeft === 1 &&
            next.skills.devices.splitRight === 2;
          if (request.complete || split)
            next = completeWindLesson(next, request.id);
          return next;
        },
        save,
        (next) => w.publishState(next),
      );
      this.pending = null;
      const after = w.state.skills.swordWindStage;
      if (after > before) {
        this.endTrial();
        const lines = Array.from({ length: after - before }, (_, i) => {
          const stage = before + i + 1;
          return `学会 ${WIND_NAMES[stage]}\n${WIND_EFFECTS[stage]}`;
        }).join("\n\n");
        w.ui.dialog(
          "风记住了这段经历",
          `${lines}\n\n正式进度已保存。${WIND_LESSONS[after - 1].next}`,
          "rune",
        );
        w.soundFx.play("success");
      } else if (w.state.skills.completedLessons.includes(request.id))
        w.ui.dialog(
          "经历已经记录",
          windLessonStatus(w.state.skills, request.id),
          "rune",
        );
      else {
        w.ui.close(true);
        w.ui.message(
          "这侧风帆已扶正，铜铃开始随风鸣响。另一侧仍然歪倒，再扶正它便能让三铃齐响。",
        );
      }
    } catch (e) {
      w.ui.dialog(
        "经历尚未保存",
        `刚才的有效应用仍可安全重试保存；正式阶段尚未发布。\n${(e as Error).message}`,
        "rune",
      );
      this.button("重试保存已完成的经历", () => void this.submit(request));
    } finally {
      this.saving = false;
    }
  }
  hit(event: WindEvent) {
    const t = event.target;
    if (!t?.lessonId) return;
    const view = this.targetViews.get(t.id)!;
    if (view.release !== event.wind.releaseId) {
      view.release = event.wind.releaseId;
      view.hits++;
      view.damage = event.wind.config.damage;
      view.at = event.at;
      view.chime.ring(event.at);
    }
    if (!event.wind.config.trialLesson || this.pending || this.saving) return;
    const id = event.wind.config.trialLesson as LessonId;
    const valid =
      (id === LESSON_IDS[0] && t.id === "lesson-water-bell") ||
      (id === LESSON_IDS[3] &&
        ["lesson-wide-0", "lesson-wide-1"].every((id) =>
          event.wind.hit.has(id),
        ));
    if (valid && !this.world.state.skills.completedLessons.includes(id))
      void this.submit({ id, complete: true });
  }
  draw(now: number) {
    const d = this.world.state.skills.devices,
      view = this.world.cameras.main.worldView;
    this.flow.clear();
    const line = (points: { x: number; y: number }[], active: boolean) => {
      if (
        !points.some(
          (p) =>
            p.x > view.x - 50 &&
            p.x < view.right + 50 &&
            p.y > view.y - 50 &&
            p.y < view.bottom + 50,
        )
      )
        return;
      this.flow
        .lineStyle(
          active ? 4 : 2,
          active ? 0xbce8d4 : 0x74938c,
          active ? 0.55 : 0.28,
        )
        .beginPath()
        .moveTo(points[0].x, points[0].y);
      for (const p of points.slice(1)) this.flow.lineTo(p.x, p.y);
      this.flow.strokePath();
      if (active)
        for (let i = 1; i < points.length; i++) {
          const a = points[i - 1],
            b = points[i],
            t = (now / 1500 + i * 0.3) % 1;
          this.flow
            .fillStyle(0xecfff0, 0.7)
            .fillCircle(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, 3);
        }
    };
    const serial=lessonById(LESSON_IDS[1]).stand,long=lessonById(LESSON_IDS[2]).stand,split=lessonById(LESSON_IDS[4]).stand;
    line([{x:serial.x,y:serial.y-20},{x:serial.x+110,y:serial.y-20},{x:serial.x+200,y:serial.y-20}],d.serialValve===1);
    line([{x:long.x-80,y:long.y},{x:long.x+160,y:long.y},{x:long.x+240,y:long.y}],d.leakClosed);
    for(const id of ['lesson-three-left','lesson-three-center','lesson-three-right']){
      const t=this.targets.find(t=>t.id===id)!;
      line([{x:split.x,y:split.y+25},{x:t.x,y:t.y}],id.endsWith('center')||id.endsWith('left')&&d.splitLeft===1||id.endsWith('right')&&d.splitRight===2);
    }
    this.vines.setVisible(d.serialValve!==1);this.branches.setVisible(!d.leakClosed);
    this.sails.forEach((s,i)=>s.setRotation((i===0?d.splitLeft===1:d.splitRight===2)?Math.sin(now*.003+i)*.08:(i===0?-.9:.9)));
    const p=this.world.state.player;
    for(const label of this.siteLabels)label.text.setVisible(Math.hypot(p.x-label.x,p.y-label.y)<220);
    for(const t of this.targets){
      const v=this.targetViews.get(t.id)!,distance=Math.hypot(p.x-t.x,p.y-t.y);
      const visible=t.x>view.x-90&&t.x<view.right+90&&t.y>view.y-30&&t.y<view.bottom+130;
      v.chime.draw(now,this.powered(t),visible,distance<180);
      v.chime.label.setText(now-v.at<700?'叮——':this.powered(t)?'随风鸣响':'铜风铃');
    }
  }
  private powered(t:WindTarget){
    const d=this.world.state.skills.devices;
    return t.lessonId===LESSON_IDS[1]?d.serialValve===1:t.lessonId===LESSON_IDS[2]?d.leakClosed&&!t.id.endsWith('-3'):t.lessonId===LESSON_IDS[4]?t.id.endsWith('center')||t.id.endsWith('left')&&d.splitLeft===1||t.id.endsWith('right')&&d.splitRight===2:false;
  }

  snapshot() {
    return {
      trial: this.trial,
      pending: this.pending?.id ?? null,
      saving: this.saving,
      targets: this.targets.map((t) => ({
        id: t.id,
        x: t.x,
        y: t.y,
        windSensitive: !!t.windSensitive,
        hits: this.targetViews.get(t.id)!.hits,
        damage: this.targetViews.get(t.id)!.damage,
        powered:this.powered(t),
        animation:this.targetViews.get(t.id)!.chime.snapshot(),
      })),
    };
  }
}
