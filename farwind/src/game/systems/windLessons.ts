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
import { completeWindLesson, effectiveWindStage } from "./skills";
import type { World } from "../scenes/World";
import type { State } from "./state";
import { save } from "./save";
import type { WindEvent, WindTarget } from "./swordWind";
import type Phaser from "phaser";

// 投影用于比较真实弹道，风铃属于机关，二者不共享敌方命中名额。
export const lessonTargets: WindTarget[] = [
  {
    id: "lesson-water-bell",
    lessonId: LESSON_IDS[0],
    x: 1310,
    y: 1160,
    windSensitive: true,
    radius: 18,
    hp: 1e9,
  },
  {
    id: "lesson-water-followup",
    lessonId: LESSON_IDS[0],
    x: 1430,
    y: 1240,
    windSensitive: true,
    radius: 18,
    hp: 1e9,
  },
  ...[2570, 2660].map((x, i) => ({
    id: `lesson-serial-bell-${i}`,
    lessonId: LESSON_IDS[1],
    x,
    y: 900,
    windSensitive: true,
    radius: 10,
    hp: 1e9,
  })),
  ...[2570, 2660].map((x, i) => ({
    id: `lesson-double-${i}`,
    lessonId: LESSON_IDS[1],
    x,
    y: 980,
    radius: 14,
    hp: 1e9,
  })),
  ...[2970, 3050, 3130, 3260].map((x, i) => ({
    id: `lesson-through-${i}`,
    lessonId: LESSON_IDS[2],
    x,
    y: 1180,
    radius: 14,
    hp: 1e9,
  })),
  ...[3574, 3646].map((x, i) => ({
    id: `lesson-wide-${i}`,
    lessonId: LESSON_IDS[3],
    x,
    y: 670,
    windSensitive: true,
    radius: 10,
    hp: 1e9,
  })),
  {
    id: "lesson-wide-channel-bell",
    lessonId: LESSON_IDS[3],
    x: 3700,
    y: 930,
    windSensitive: true,
    radius: 10,
    hp: 1e9,
  },
  {
    id: "lesson-three-left",
    lessonId: LESSON_IDS[4],
    x: 3780,
    y: 825,
    radius: 14,
    hp: 1e9,
  },
  {
    id: "lesson-three-center",
    lessonId: LESSON_IDS[4],
    x: 3910,
    y: 790,
    radius: 14,
    hp: 1e9,
  },
  {
    id: "lesson-three-right",
    lessonId: LESSON_IDS[4],
    x: 4000,
    y: 844,
    radius: 14,
    hp: 1e9,
  },
  {
    id: "lesson-three-gap",
    lessonId: LESSON_IDS[4],
    x: 3830,
    y: 730,
    radius: 14,
    hp: 1e9,
  },
  {
    id: "lesson-three-overlap",
    lessonId: LESSON_IDS[4],
    x: 3910,
    y: 975,
    radius: 44,
    hp: 1e9,
  },
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
      image: Phaser.GameObjects.Image;
      label: Phaser.GameObjects.Text;
      at: number;
      hits: number;
      release: number;
      damage: number;
    }
  >();
  private flow: Phaser.GameObjects.Graphics;
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
    }
    this.visuals.push(
      scene.add
        .graphics()
        .setDepth(-1)
        .lineStyle(2, 0xb2d7bd, 0.7)
        .strokeEllipse(3700, 1150, 48, 22),
      scene.add
        .text(3700, 1175, "窄通道对照 · 面向北方", {
          fontSize: "12px",
          color: "#fff2d3",
          stroke: "#264938",
          strokeThickness: 3,
        })
        .setOrigin(0.5, 0)
        .setDepth(1176),
    );
    for (const t of this.targets) {
      const image = scene.add
        .image(t.x, t.y, "rune")
        .setOrigin(0.5, 1)
        .setDisplaySize(t.windSensitive ? 35 : 44, t.windSensitive ? 54 : 62)
        .setAlpha(t.windSensitive ? 0.85 : 0.45)
        .setTint(0xb7e3dd)
        .setDepth(t.y);
      const label = scene.add
        .text(
          t.x,
          t.y + 5,
          t.windSensitive
            ? "风敏铃"
            : t.id.endsWith("gap")
              ? "轨迹空隙"
              : t.id.endsWith("overlap")
                ? "重叠投影"
                : "剑风投影",
          {
            fontSize: "11px",
            color: "#edf7e8",
            stroke: "#284434",
            strokeThickness: 3,
          },
        )
        .setOrigin(0.5, 0)
        .setDepth(t.y + 1);
      this.targetViews.set(t.id, {
        image,
        label,
        at: -1e6,
        hits: 0,
        release: 0,
        damage: 0,
      });
      this.visuals.push(image, label);
    }
    scene.events.once("shutdown", () => {
      this.endTrial();
      for (const v of this.visuals) v.destroy();
      this.visuals = [];
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
      `${l.hint}\n${done ? "这段经历已经记录，重复练习不再提升阶段。" : "成长来自这次具体经历，不需要击杀、材料或重复练习。"}\n${id === LESSON_IDS[0] || id === LESSON_IDS[3] ? "圆形铺垫标示试用站位。J／左键连按完成三连斩，再接第四击；面向北方。临时能力仅用于教学风铃。" : ""}`,
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
            : "临时试用：站上铺垫，面向北方，三连斩后接第四击。离开范围后结束。",
        );
      });
    }
    if (!done && id === LESSON_IDS[1])
      for (const [choice, text] of [
        [0, "关闭旁路"],
        [1, "沿两铃之间导流"],
        [2, "将风分向溪面"],
      ] as const)
        this.button(
          text,
          () =>
            void this.submit({
              id,
              change: (s) => (s.skills.devices.serialValve = choice),
              complete: choice === 1,
            }),
        );
    if (!done && id === LESSON_IDS[2])
      this.button(
        "沿风痕封闭裂开的泄口",
        () =>
          void this.submit({
            id,
            change: (s) => (s.skills.devices.leakClosed = true),
            complete: true,
          }),
      );
    if (!done && id === LESSON_IDS[4])
      for (const side of ["splitLeft", "splitRight"] as const)
        for (const [choice, text] of [
          [0, "关闭"],
          [1, "导向左前"],
          [2, "导向右前"],
        ] as const)
          this.button(
            `${side === "splitLeft" ? "左闸" : "右闸"} · ${text}`,
            () =>
              void this.submit({
                id,
                change: (s) => (s.skills.devices[side] = choice),
                complete: false,
              }),
          );
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
          lessonById(request.id).stage > after
            ? "这处风道已经恢复。前置本领补齐后会自动结算，无需重做。"
            : "这段经历已经补记；当前本领保留，重复学习不会额外升阶。",
          "rune",
        );
      else {
        w.ui.close(true);
        w.ui.message(
          "分流位置已保存。观察场景中的风痕与风铃，再调整另一处闸。",
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
    line(
      [
        { x: 2460, y: 900 },
        { x: 2570, y: 900 },
        { x: 2660, y: 900 },
      ],
      d.serialValve === 1,
    );
    if (d.serialValve === 2)
      line(
        [
          { x: 2460, y: 900 },
          { x: 2530, y: 850 },
          { x: 2610, y: 850 },
        ],
        true,
      );
    line(
      [
        { x: 2760, y: 830 },
        { x: 2920, y: 830 },
        { x: 3160, y: 830 },
      ],
      d.leakClosed,
    );
    line(
      [
        { x: 3910, y: 1080 },
        { x: 3910, y: 790 },
      ],
      true,
    );
    line(
      [
        { x: 3880, y: 1060 },
        { x: 3780, y: 825 },
      ],
      d.splitLeft === 1,
    );
    line(
      [
        { x: 3940, y: 1060 },
        { x: 4000, y: 844 },
      ],
      d.splitRight === 2,
    );
    for (const [id, v] of this.targetViews) {
      const lit = now - v.at < 500;
      v.image.setTint(lit ? 0xfff0aa : 0xb7e3dd);
      v.label.setText(
        lit
          ? `${Math.round(v.damage)} · 本次一次`
          : id.endsWith("gap")
            ? "轨迹空隙"
            : id.endsWith("overlap")
              ? "重叠投影"
              : this.targets.find((t) => t.id === id)!.windSensitive
                ? "风敏铃"
                : "剑风投影",
      );
    }
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
      })),
    };
  }
}
