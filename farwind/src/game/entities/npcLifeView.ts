import {INTERIOR_FURNITURE,INTERIOR_BEDS} from '../../data/villageInteriors';
import Phaser from "phaser";
import {
  PEOPLE,
  PRIVATE_STORAGE,
  HOMES,
  FACILITIES,
  MAINTENANCE,
  ROOM,
  ACTION_LABELS,
  person,
  type SpaceId,
} from "../../data/npcLife";
import type { NpcLife } from "../systems/npcLife";
import { TOWERS, GUARD_DEFS } from "../../data/defense";
import { distance, spaceClear } from "../systems/npcNavigation";
import { Actor } from "./actor";
import { LIFE_ART, NPC_WALK, NpcMotion, residentPose } from "../systems/npcAnimation";
import {groundShadows} from '../rendering/groundShadows';
export class NpcLifeView {
  residents = new Map<
    string,
    {
      sprite: Phaser.GameObjects.Sprite;
      label: Phaser.GameObjects.Text;
      tool: Phaser.GameObjects.Graphics;
      shadow: Phaser.GameObjects.Ellipse;
      motion: NpcMotion;
      facing: number;
    }
  >();
  room: Phaser.GameObjects.Container;
  ink: Phaser.GameObjects.Graphics;
  roomLabel: Phaser.GameObjects.Text;
  furnitureLabels = new Map<string, Phaser.GameObjects.Text>();
  furniture: { space: SpaceId; sprite: Phaser.GameObjects.Image }[] = [];
  workInk: Phaser.GameObjects.Graphics;
  doorLights = new Map<string, Phaser.GameObjects.Graphics>();
  doors = new Map<string, Phaser.GameObjects.Text>();
  maintenance = new Map<
    string,
    { mark: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text }
  >();
  lastSpace = "";
  speechText: Phaser.GameObjects.Text;
  speechInk: Phaser.GameObjects.Graphics;
  constructor(private scene: Phaser.Scene) {
    this.speechInk = scene.add.graphics().setDepth(9900).setVisible(false);
    this.speechText = scene.add
      .text(0, 0, "", {
        fontSize: "13px",
        color: "#493f31",
        wordWrap: { width: 235 },
        align: "center",
        padding: { x: 9, y: 7 },
      })
      .setOrigin(0.5, 1)
      .setDepth(9901)
      .setVisible(false);
    for (const d of PEOPLE.slice(0, 3)) {
      const sprite = scene.add
          .sprite(0, 0, d.art, 0)
          .setOrigin(0.5, 1)
          .setDisplaySize(76, 92),
        label = scene.add
          .text(0, 0, "", {
            fontSize: "12px",
            color: "#fff5d6",
            stroke: "#365348",
            strokeThickness: 3,
          })
          .setOrigin(0.5, 0),
        tool = scene.add.graphics(),
        shadow = scene.add.ellipse(0, 0, 52, 17, 0x193c32, 0.2);
      groundShadows(scene).add(sprite,shadow,{label:d.name});
      this.residents.set(d.id, {
        sprite,
        label,
        tool,
        shadow,
        motion: new NpcMotion(),
        facing: 0,
      });
    }
    this.ink = scene.add.graphics();
    this.workInk = scene.add.graphics().setDepth(8283.1).setVisible(false);
    this.roomLabel = scene.add
      .text(700, ROOM.top - 62, "", {
        fontSize: "15px",
        align: "center",
        color: "#eee0bb",
      })
      .setOrigin(0.5, 0);
    this.room = scene.add
      .container(0, 0, [this.ink, this.roomLabel])
      .setDepth(7000)
      .setVisible(false);
    // 家具与人物按脚底排序，避免所有桌椅都绘制在人物背后。
    const addFurniture = (
      space: SpaceId,
      texture: string,
      x: number,
      y: number,
      width: number,
      height: number,
    ) => {
      const source = scene.textures.get(texture).getSourceImage();
      this.furniture.push({
        space,
        sprite: scene.add
          .image(x, y, texture)
          .setOrigin(0.5, 1)
          .setScale(Math.min(width / source.width, height / source.height))
          .setDepth(7500 + y)
          .setVisible(false),
      });
      const furniture=this.furniture.at(-1)!.sprite;
      groundShadows(scene).add(furniture,undefined,{label:'室内家具',width:Math.max(24,furniture.displayWidth*.8),height:16});
    };
    for(const f of INTERIOR_FURNITURE){
      addFurniture(f.space, `interior-${f.asset}`, f.x, f.y, f.width, f.height);
      if(f.ground){const sprite=this.furniture.at(-1)!.sprite;sprite.setDepth(7001);groundShadows(scene).entries.get(sprite)?.cleanup();}
    }
    for(const bed of INTERIOR_BEDS) addFurniture(bed.space,LIFE_ART.bed,bed.x,bed.y-15,64,110);
    for (const f of FACILITIES.filter((f) => f.place.space !== "village")) {
      if (f.kind === "bed")
        addFurniture(
          f.place.space,
          LIFE_ART.bed,
          f.place.x,
          f.place.y - 15,
          64,
          110,
        );
      else if (f.id !== "pharmacy")
        addFurniture(
          f.place.space,
          LIFE_ART.table,
          f.place.x,
          f.place.y - 17,
          88,
          55,
        );
    }
    for (const h of HOMES.filter(h=>!INTERIOR_FURNITURE.some(f=>f.space===h.id&&f.asset==="counter")))
      addFurniture(
        h.id,
        LIFE_ART.table,
        830,
        h.id === "healer-home" ? 783 : 778,
        104,
        62,
      );
    for (const f of FACILITIES.filter((f) => f.kind === "bed")) {
      const label = scene.add
        .text(f.place.x, f.place.y + 12, f.label, {
          fontSize: "10px",
          color: "#59472f",
        })
        .setOrigin(0.5, 0);
      this.furnitureLabels.set(f.id, label);
      this.room.add(label);
    }
    for (const box of PRIVATE_STORAGE) {
      const label = scene.add
        .text(box.x, box.y + 12, "", { fontSize: "9px", color: "#59472f" })
        .setOrigin(0.5, 0);
      this.furnitureLabels.set(box.id, label);
      this.room.add(label);
    }
    for (const h of HOMES) {
      this.doorLights.set(h.id, scene.add.graphics().setDepth(h.door.y + 1));
      const t = scene.add
        .text(h.door.x, h.door.y + 12, `${h.name} · E 敲门`, {
          fontSize: "12px",
          color: "#fff3cf",
          stroke: "#4f493a",
          strokeThickness: 3,
        })
        .setOrigin(0.5, 0)
        .setDepth(h.door.y + 1);
      this.doors.set(h.id, t);
    }
    for (const f of MAINTENANCE)
      this.maintenance.set(f.id, {
        mark: scene.add.graphics().setDepth(f.place.y + 2),
        label: scene.add
          .text(f.place.x, f.place.y + 24, "", {
            fontSize: "12px",
            color: "#f9ddbd",
            stroke: "#503c30",
            strokeThickness: 3,
          })
          .setOrigin(0.5, 0)
          .setDepth(f.place.y + 3),
      });
    const bell=MAINTENANCE.find(f=>f.id==='wind-bell');
    if(bell)groundShadows(scene).add(this.maintenance.get(bell.id)!.mark,undefined,{label:'风铃挂架',width:56,height:15,projection:false,root:()=>({x:bell.place.x,y:bell.place.y-3,depth:bell.place.y-.5})});
  }
  drawRoom(space: SpaceId, life: NpcLife) {
    const g = this.ink.clear();
    g.fillStyle(0x263b37).fillRect(-4000, -4000, 12000, 12000);
    g.fillStyle(0x765840).fillRoundedRect(
      ROOM.left - 16,
      ROOM.top - 18,
      672,
      574,
      18,
    );
    g.fillStyle(0xd5bc90).fillRoundedRect(ROOM.left, ROOM.top, 640, 540, 12);
    // 木梁、墙板与窗户留在边界内；家具按脚底与角色共同排序。
    g.fillStyle(0x91704c).fillRect(ROOM.left,ROOM.top,640,30);
    for(const x of [395,1004]) g.fillStyle(0x674a33).fillRect(x-5,ROOM.top,10,540);
    for(const x of [480,860]) {
      g.fillStyle(0x634d38).fillRoundedRect(x,438,95,62,6);
      g.fillStyle(0xb8d4ba).fillRect(x+7,445,81,47);
      g.lineStyle(4,0x76573a).lineBetween(x+47,445,x+47,492).lineBetween(x+7,469,x+88,469);
    }
    for (let y = 440; y < 960; y += 28) {
      g.lineStyle(1, 0x886d4c, 0.25).lineBetween(395, y, 1004, y);
      for (let x = 400 + (y % 56); x < 1000; x += 115)
        g.lineBetween(x, y - 26, x, y);
    }
    for (const f of FACILITIES.filter((f) => f.place.space === space)) {
      const x = f.place.x,
        y = f.place.y;
      if (f.kind === "bed") {
        if (life.data.unavailable.facilities.includes(f.id))
          this.workInk
            .lineStyle(3, 0x9b5742)
            .lineBetween(x - 20, y - 44, x + 20, y - 16)
            .lineBetween(x + 20, y - 44, x - 20, y - 16);
      }
    }
    for (const box of PRIVATE_STORAGE.filter((box) => box.space === space)) {
      const n = life.data.people.find((n) => n.id === box.owner)!,
        stored = !life.carrying(n);
      g.fillStyle(0x795239).fillRoundedRect(box.x - 10, box.y - 12, 20, 22, 3);
      g.lineStyle(2, 0xb19a61)
        .strokeRoundedRect(box.x - 10, box.y - 12, 20, 22, 3)
        .lineBetween(box.x - 8, box.y - 5, box.x + 8, box.y - 5);
      g.fillStyle(0xd4b85c).fillRect(box.x - 2, box.y - 5, 4, 6);
      if (stored)
        g.fillStyle(box.owner === "healer" ? 0x7da28c : 0xd7c898).fillRect(
          box.x - 6,
          box.y - 9,
          12,
          5,
        );
      else
        g.lineStyle(2, 0x705038).lineBetween(
          box.x - 10,
          box.y - 12,
          box.x + 5,
          box.y - 22,
        );
      this.furnitureLabels
        .get(box.id)!
        .setText(
          `${person(box.owner)!.name} · ${stored ? box.item : "已取出"}`,
        );
    }
    const work = this.workInk;
    if (space === "healer-home") {
      for (let i = 0; i < 6; i++) {
        work
          .fillStyle(i < life.data.stores.medicine ? 0x75a58f : 0xab967a)
          .fillRoundedRect(794 + i * 13, 746, 9, 15, 2);
      }
      work.fillStyle(0xf0e3bc).fillRect(802, 739, 20, 8);
      const n = life.data.people.find((n) => n.id === "healer")!,
        a = n.action;
      if (
        a?.kind === "work" &&
        a.facility === "pharmacy" &&
        a.phase === "perform"
      ) {
        // 未完成的药草与研钵跟随真实进度；只有事务完成后公共药瓶数量才改变。
        const stroke = Math.sin(a.progress / 180) * 5;
        work
          .fillStyle(0x65885f)
          .fillEllipse(803, 757, 17, 6)
          .fillEllipse(801, 749, 12, 5);
        work.fillStyle(0xb3a180).fillEllipse(850, 761, 23, 10);
        work.lineStyle(4, 0x66513b).lineBetween(848, 757, 852 + stroke, 742);
        work.fillStyle(0xe4d7ad).fillRect(873, 751, 19, 12);
        work
          .lineStyle(2, 0x799367)
          .lineBetween(876, 756, 876 + (13 * a.progress) / a.duration, 756);
      }
    }
    if (space === "elder-home") {
      g.lineStyle(2, 0x806b4b)
        .lineBetween(930, 590, 930, 640)
        .lineBetween(916, 601, 944, 601);
      g.fillStyle(0xad986c).fillEllipse(930, 616, 22, 18);
      work.fillStyle(0xe4d5b2).fillRect(817, 740, 32, 17);
      work
        .lineStyle(1, 0x698579)
        .lineBetween(823, 745, 843, 745)
        .lineBetween(823, 751, 843, 751);
    }
    if (space === "carpenter-home") {
      const stage = life.data.people.find((n) => n.id === "carpenter")!.project;
      work.fillStyle(0x9b693c).fillEllipse(850, 748, stage >= 33 ? 28 : 15, 13);
      if (stage >= 66) work.fillTriangle(861, 746, 875, 738, 875, 751);
    }
    g.fillStyle(0x3b5147).fillRect(ROOM.entry.x - 36, ROOM.bottom - 18, 72, 20);
    g.lineStyle(2, 0x9e784b).strokeRect(
      ROOM.entry.x - 36,
      ROOM.bottom - 18,
      72,
      20,
    );
    this.roomLabel.setText(
      `${HOMES.find((h) => h.id === space)!.name}\n${HOMES.find((h) => h.id === space)!.private}　·　南侧门口 E 返回`,
    );
  }
  snapshot() {
    return {
      residents: [...this.residents].map(([id, v]) => ({
        id,
        texture: v.sprite.texture.key,
        frame: v.sprite.frame.name,
        visible: v.sprite.visible,
        depth: v.sprite.depth,
        cropped: v.sprite.isCropped,
        x: v.sprite.x,
        y: v.sprite.y,
        motion: { action: v.motion.action, speed: v.motion.speed, distance: v.motion.distance, direction: v.motion.direction },
        origin: [v.sprite.originX, v.sprite.originY],
        flip: v.sprite.flipX,
      })),
      furniture: this.furniture
        .filter((f) => f.sprite.visible)
        .map((f) => ({
          space: f.space,
          texture: f.sprite.texture.key,
          x: f.sprite.x,
          y: f.sprite.y,
          depth: f.sprite.depth,
        })),
    };
  }
  update(life: NpcLife, now: number) {
    const space = life.data.playerSpace,
      indoor = space !== "village";
    this.room.setVisible(indoor);
    this.workInk.clear().setVisible(indoor);
    for (const f of this.furniture) f.sprite.setVisible(f.space === space);
    for (const f of MAINTENANCE) {
      const v = this.maintenance.get(f.id)!,
        hp = life.data.facilities[f.id],
        show = !indoor && hp < 100;
      v.mark.clear().setVisible(!indoor && (show || f.id === "wind-bell"));
      v.label.setVisible(show).setText(`${f.name} · 待维修 ${Math.round(hp)}%`);
      // 小型公共挂架沿用场景线绘，不更换人物素材；损坏不改变既有通行几何。
      if (f.id === "wind-bell") {
        const x = f.place.x,
          y = f.place.y;
        v.mark
          .lineStyle(5, 0x806345, 1)
          .lineBetween(x - 24, y - 4, x - 22, y - 62)
          .lineBetween(x + 24, y - 4, x + 22, y - 62)
          .lineBetween(x - 26, y - 59, x + 26, y - 61)
          .lineStyle(1, 0xc5a274, 0.8)
          .lineBetween(x - 23, y - 6, x - 21, y - 55)
          .lineStyle(2, 0x705943, 1)
          .lineBetween(x, y - 59, x, y - 49)
          .fillStyle(hp > 0 ? 0xb5b7a0 : 0x8c8170, 1)
          .fillEllipse(x, y - 40, 22, 19)
          .lineStyle(2, 0x626e66, 1)
          .strokeEllipse(x, y - 40, 22, 19)
          .lineBetween(x - 13, y - 32, x + 13, y - 32)
          .lineBetween(x, y - 31, x, y - 18)
          .fillStyle(0xc5ad83, 1)
          .fillRect(x - 3, y - 23, 6, 13);
      }
      if (show)
        v.mark
          .lineStyle(3, 0x6f3e2d, 0.85)
          .lineBetween(
            f.place.x - 18,
            f.place.y - 52,
            f.place.x - 3,
            f.place.y - 35,
          )
          .lineBetween(
            f.place.x - 3,
            f.place.y - 35,
            f.place.x + 9,
            f.place.y - 45,
          )
          .lineBetween(
            f.place.x + 9,
            f.place.y - 45,
            f.place.x + 20,
            f.place.y - 29,
          );
    }
    if (indoor) this.drawRoom(space, life);
    for (const f of FACILITIES.filter((f) => f.kind === "bed")) {
      const sleeping = life.data.people.some(
        (n) =>
          n.action?.facility === f.id &&
          n.action.kind === "sleep" &&
          n.action.phase === "perform",
      );
      this.furnitureLabels
        .get(f.id)!
        .setVisible(f.place.space === space)
        .setText(`${f.label}${sleeping ? " · 休息中" : ""}`);
    }
    for (const box of PRIVATE_STORAGE)
      this.furnitureLabels.get(box.id)!.setVisible(box.space === space);
    for (const [id, t] of this.doors) {
      const h = HOMES.find((h) => h.id === id)!,
        occupants = life.data.people.filter(
          (n) => life.body(n.id)?.space === id,
        ),
        awake = occupants.some(
          (n) => !(n.action?.kind === "sleep" && n.action.phase === "perform"),
        ),
        night = life.state.time % 1440 >= 1140 || life.state.time % 1440 < 360,
        lamp = this.doorLights.get(id)!.clear().setVisible(!indoor);
      if (awake && night)
        lamp
          .fillStyle(0xffd992, 0.14)
          .fillEllipse(h.door.x, h.door.y - 12, 90, 45)
          .fillStyle(0xf3c678, 0.7)
          .fillCircle(h.door.x + 32, h.door.y - 28, 5);
      t.setVisible(!indoor).setText(
        `${h.name} · ${life.data.unavailable.homes[h.id] ? "通路暂不可用" : occupants.length ? (awake ? "有人活动" : "休息中") : h.owners.length ? "外出" : "开放"} · E`,
      );
    }

    for (const [id, v] of this.residents) {
      const n = life.data.people.find((n) => n.id === id)!,
        p = n.body!,
        visible = p.space === space;
      v.motion.sample(p, now, p.health !== "down");
      v.facing = v.motion.direction;
      const working =
          n.action?.phase === "perform" &&
          ["work", "repair", "treat", "habit"].includes(n.action.kind),
        sleeping = n.action?.kind === "sleep" && n.action.phase === "perform",
        depth = (indoor ? 7500 : 0) + p.y,
        pose = residentPose(n, v.motion),
        walkingArt = pose.texture.startsWith("npc-motion-"),
        bed =
          sleeping &&
          FACILITIES.find(
            (f) =>
              f.id === n.action?.facility &&
              f.kind === "bed" &&
              distance(f.place, p) < 6,
          );
      // 职业四帧按真实进度推进；睡眠仅露出原角色头部，身体由被褥遮挡。
      v.sprite
        .setTexture(pose.texture, bed ? 1 : pose.frame)
        .setOrigin(0.5, walkingArt ? NPC_WALK.footY / NPC_WALK.frameSize : 1)
        .setDisplaySize(walkingArt ? NPC_WALK.frameSize * 78 / NPC_WALK.bodyHeight : 76,
          walkingArt ? NPC_WALK.frameSize * 78 / NPC_WALK.bodyHeight : 92)
        .setCrop()
        .setPosition(p.x, p.y - (bed ? 29 : 0))
        .setDepth(depth)
        .setVisible(visible)
        .setAlpha(p.health === "down" ? 0.65 : 1)
        .setRotation(p.health === "down" ? 0.35 : 0);
      if (bed) v.sprite.setCrop(0, 0, 128, 54);
      Actor.mirror(v.sprite, v.facing === 2);
      if (p.health !== "healthy") v.sprite.setTint(0xd5b4a1);
      else v.sprite.clearTint();
      v.shadow
        .setVisible(visible && !bed)
        .setPosition(p.x, p.y - 3)
        .setDepth(depth - 0.5);
      v.label
        .setVisible(visible && !bed)
        .setPosition(p.x, p.y + 6)
        .setDepth(depth + 1)
        .setText(
          `${person(id)!.name} · ${p.health === "hurt" ? "受伤 · " : ""}${p.health === "down" ? "需救护" : p.health === "convalescent" ? "休养" : n.action ? (n.action.phase === "stock" ? (id === "healer" ? "装药" : "取木料") : n.action.phase === "collect" ? "取物" : ACTION_LABELS[n.action.kind]) : "等待"}`,
        );
      v.tool
        .clear()
        .setVisible(visible && !bed)
        .setDepth(depth + 2);
      if (life.carrying(n) && id === "healer") {
        v.tool
          .fillStyle(0xe1d2ac)
          .fillRoundedRect(p.x + 17, p.y - 39, 20, 17, 3);
        v.tool
          .lineStyle(2, 0x546b57)
          .strokeRoundedRect(p.x + 17, p.y - 39, 20, 17, 3);
        v.tool
          .lineStyle(2, 0x99644a)
          .lineBetween(p.x + 27, p.y - 35, p.x + 27, p.y - 27)
          .lineBetween(p.x + 23, p.y - 31, p.x + 31, p.y - 31);
        for (let i = 0; i < n.supplies.medicine; i++)
          v.tool
            .fillStyle(0x7ca38c)
            .fillRoundedRect(p.x + 18 + i * 8, p.y - 42, 6, 8, 2);
      }
      if (life.carrying(n) && id === "carpenter" && !working)
        v.tool
          .lineStyle(3, 0x91663a)
          .lineBetween(p.x + 18, p.y - 27, p.x + 28, p.y - 45)
          .lineStyle(5, 0x7c8680)
          .lineBetween(p.x + 22, p.y - 43, p.x + 34, p.y - 40);
      if (life.carrying(n) && id === "carpenter")
        for (let i = 0; i < n.supplies.wood; i++)
          v.tool
            .lineStyle(5, 0xb48b53)
            .lineBetween(
              p.x - 25 - i * 6,
              p.y - 31,
              p.x - 20 - i * 6,
              p.y - 48,
            );
      if (life.carrying(n) && id === "elder" && pose.texture !== "elder-work")
        v.tool
          .fillStyle(0xe2d5af)
          .fillRoundedRect(p.x + 18, p.y - 33, 15, 20, 2)
          .lineStyle(1, 0x748875)
          .lineBetween(p.x + 21, p.y - 27, p.x + 30, p.y - 27);
      if (working && n.action && !pose.texture.endsWith("-work")) {
        const phase = Math.sin(n.action.progress / 160),
          x = p.x + (v.facing === 2 ? -23 : 23);
        if (id === "healer" && n.action.kind === "treat")
          v.tool
            .fillStyle(0xede1bc)
            .fillRect(x - 7, p.y - 34 + phase * 2, 14, 9)
            .lineStyle(1, 0x99694e)
            .lineBetween(x, p.y - 33, x, p.y - 27);
        if (id === "carpenter")
          v.tool
            .lineStyle(3, 0x95683e)
            .lineBetween(x - 6, p.y - 29, x + 5, p.y - 43 + phase * 5)
            .lineStyle(5, 0x828b82)
            .lineBetween(
              x + 1,
              p.y - 42 + phase * 5,
              x + 13,
              p.y - 41 + phase * 5,
            )
            .fillStyle(0xb7925d)
            .fillEllipse(x, p.y - 22, 22, 7);
        if (id === "elder")
          v.tool
            .lineStyle(1.5, 0x69533c)
            .lineBetween(x, p.y - 30, x + 8, p.y - 37 + phase * 2);
      }
    }
    const speech = life.speech,
      speaker = speech && life.body(speech.speaker),
      n = speech && life.data.people.find((n) => n.id === speech.speaker),
      showSpeech =
        !!speech &&
        !!speaker &&
        !!n &&
        speaker.space === space &&
        life.live(speech.speaker) &&
        speech.until > life.data.elapsed &&
        (speech.urgent || n.action?.id === speech.actionId) &&
        distance(speaker, life.state.player) < 280 &&
        spaceClear(space, speaker, life.state.player);
    this.speechInk.clear().setVisible(showSpeech);
    this.speechText.setVisible(showSpeech);
    if (showSpeech && speech && speaker) {
      const guard = life.state.defense.guards.find(
          (g) => g.id === speech.speaker,
        ),
        archer =
          GUARD_DEFS.find((g) => g.id === speech.speaker)?.role === "archer",
        anchor =
          guard && archer && !guard.offDuty
            ? TOWERS.find((t) => t.occupantGuardId === guard.id)!.perch
            : speaker;
      this.speechText
        .setText(speech.text)
        .setPosition(anchor.x, anchor.y - 107);
      const bounds = this.speechText.getBounds();
      this.speechInk
        .fillStyle(speech.urgent ? 0xf6ddb5 : 0xeee5c9, 0.96)
        .fillRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, 8)
        .lineStyle(1.5, 0x71593f, 0.9)
        .strokeRoundedRect(bounds.x, bounds.y, bounds.width, bounds.height, 8)
        .fillTriangle(
          anchor.x - 5,
          bounds.bottom - 1,
          anchor.x + 5,
          bounds.bottom - 1,
          anchor.x,
          bounds.bottom + 6,
        );
    }
    this.lastSpace = space;
  }
}
