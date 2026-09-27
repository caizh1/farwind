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
import { Actor } from "./actor";
export class NpcLifeView {
  residents = new Map<
    string,
    {
      sprite: Phaser.GameObjects.Sprite;
      label: Phaser.GameObjects.Text;
      tool: Phaser.GameObjects.Graphics;
      shadow: Phaser.GameObjects.Ellipse;
      last: { x: number; y: number };
      facing: number;
    }
  >();
  room: Phaser.GameObjects.Container;
  ink: Phaser.GameObjects.Graphics;
  roomLabel: Phaser.GameObjects.Text;
  furnitureLabels = new Map<string, Phaser.GameObjects.Text>();
  doorLights = new Map<string, Phaser.GameObjects.Graphics>();
  doors = new Map<string, Phaser.GameObjects.Text>();
  maintenance = new Map<
    string,
    { mark: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text }
  >();
  lastSpace = "";
  constructor(private scene: Phaser.Scene) {
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
        shadow = scene.add.ellipse(0, 0, 28, 8, 0x193c32, 0.2);
      this.residents.set(d.id, {
        sprite,
        label,
        tool,
        shadow,
        last: { x: 0, y: 0 },
        facing: 3,
      });
    }
    this.ink = scene.add.graphics();
    this.roomLabel = scene.add.text(420, 444, "", {
      fontSize: "19px",
      color: "#5b3b2b",
    });
    this.room = scene.add
      .container(0, 0, [this.ink, this.roomLabel])
      .setDepth(7000)
      .setVisible(false);
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
    // 木地板与织物用确定性细线；角色继续使用已有手绘图集。
    for (let y = 440; y < 960; y += 28) {
      g.lineStyle(1, 0x886d4c, 0.25).lineBetween(395, y, 1004, y);
      for (let x = 400 + (y % 56); x < 1000; x += 115)
        g.lineBetween(x, y - 26, x, y);
    }
    g.fillStyle(0xeee0bb).fillRoundedRect(400, 430, 600, 70, 8);
    g.lineStyle(3, 0x674d35).strokeRoundedRect(400, 430, 600, 70, 8);
    for (const f of FACILITIES.filter((f) => f.place.space === space)) {
      const x = f.place.x,
        y = f.place.y;
      if (f.kind === "bed") {
        g.fillStyle(0x72513a).fillRoundedRect(x - 40, y - 78, 80, 76, 5);
        g.fillStyle(0xe8d4ac).fillRoundedRect(x - 34, y - 72, 68, 63, 5);
        g.fillStyle(0x809b91).fillRoundedRect(x - 32, y - 48, 64, 40, 4);
        g.fillStyle(0xf3e7cf).fillRoundedRect(x - 26, y - 67, 52, 16, 5);
        g.lineStyle(2, 0x506c61, 0.6).strokeRoundedRect(
          x - 32,
          y - 48,
          64,
          40,
          4,
        );
        const n = life.data.people.find((n) => n.action?.facility === f.id);
        if (n?.action?.kind === "sleep" && n.action.phase === "perform")
          g.fillStyle(0x536f65, 0.65).fillEllipse(x, y - 34, 44, 22);
        if (life.data.unavailable.facilities.includes(f.id))
          g.lineStyle(3, 0x9b5742)
            .lineBetween(x - 20, y - 44, x + 20, y - 16)
            .lineBetween(x + 20, y - 44, x - 20, y - 16);
      } else {
        g.fillStyle(0x6d4c35).fillRoundedRect(x - 44, y - 55, 88, 40, 7);
        g.fillStyle(0xb99160).fillRoundedRect(x - 42, y - 57, 84, 30, 5);
        g.lineStyle(2, 0x66503c).strokeRoundedRect(x - 42, y - 57, 84, 30, 5);
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
    g.fillStyle(0x896e49).fillRect(810, 725, 100, 45);
    g.lineStyle(2, 0x624833).strokeRect(810, 725, 100, 45);
    if (space === "healer-home") {
      for (let i = 0; i < 6; i++) {
        g.fillStyle(
          i < life.data.stores.medicine ? 0x75a58f : 0xab967a,
        ).fillRoundedRect(817 + i * 13, 733, 9, 24, 2);
      }
      g.fillStyle(0xf0e3bc).fillRect(814, 779, 50, 15);
      g.lineStyle(1, 0x587559).lineBetween(836, 780, 840, 792);
    }
    if (space === "elder-home") {
      g.lineStyle(2, 0x806b4b)
        .lineBetween(930, 590, 930, 640)
        .lineBetween(916, 601, 944, 601);
      g.fillStyle(0xad986c).fillEllipse(930, 616, 22, 18);
      g.fillStyle(0xe4d5b2).fillRect(909, 718, 43, 25);
      g.lineStyle(1, 0x698579)
        .lineBetween(916, 724, 945, 724)
        .lineBetween(916, 732, 945, 732);
    }
    if (space === "carpenter-home") {
      const stage = life.data.people.find((n) => n.id === "carpenter")!.project;
      g.fillStyle(0x9b693c).fillEllipse(850, 740, stage >= 33 ? 28 : 15, 13);
      if (stage >= 66) g.fillTriangle(861, 738, 875, 730, 875, 743);
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
  update(life: NpcLife, now: number) {
    const space = life.data.playerSpace,
      indoor = space !== "village";
    this.room.setVisible(indoor);
    for (const f of MAINTENANCE) {
      const v = this.maintenance.get(f.id)!,
        hp = life.data.facilities[f.id],
        show = !indoor && hp < 100;
      v.mark.clear().setVisible(show);
      v.label.setVisible(show).setText(`${f.name} · 待维修 ${Math.round(hp)}%`);
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
    for (const f of FACILITIES.filter((f) => f.kind === "bed"))
      this.furnitureLabels.get(f.id)!.setVisible(f.place.space === space);
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
        `${h.name} · ${life.data.unavailable.homes[h.id] ? "通路暂不可用" : occupants.length ? (awake ? "有人活动" : "休息中") : "外出"} · E`,
      );
    }

    for (const [id, v] of this.residents) {
      const n = life.data.people.find((n) => n.id === id)!,
        p = n.body!,
        visible = p.space === space,
        dx = p.x - v.last.x,
        dy = p.y - v.last.y,
        moved = Math.hypot(dx, dy) > 0.01;
      if (moved)
        v.facing =
          Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 2 : 3) : dy < 0 ? 1 : 0;
      v.last = { x: p.x, y: p.y };
      const working =
          n.action?.phase === "perform" &&
          ["work", "repair", "treat", "habit"].includes(n.action.kind),
        sleeping = n.action?.kind === "sleep" && n.action.phase === "perform",
        depth = (indoor ? 7500 : 0) + p.y;
      // 两帧为既有轻动作素材，行走只切换帧并保留侧向朝向；没有宣称专用职业动画。
      v.sprite
        .setPosition(p.x, p.y)
        .setDepth(depth)
        .setFrame(moved || working ? Math.floor(now / 350) % 2 : 0)
        .setVisible(visible)
        .setAlpha(p.health === "down" ? 0.65 : 1)
        .setRotation(sleeping || p.health === "down" ? 0.35 : 0);
      Actor.mirror(v.sprite, v.facing === 2);
      if (p.health !== "healthy") v.sprite.setTint(0xd5b4a1);
      else v.sprite.clearTint();
      v.shadow
        .setVisible(visible)
        .setPosition(p.x, p.y - 3)
        .setDepth(depth - 0.5);
      v.label
        .setVisible(visible)
        .setPosition(p.x, p.y + 6)
        .setDepth(depth + 1)
        .setText(
          `${person(id)!.name} · ${p.health === "down" ? "需救护" : p.health === "convalescent" ? "休养" : n.action ? ACTION_LABELS[n.action.kind] : "等待"}`,
        );
      v.tool
        .clear()
        .setVisible(visible)
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
      }
      if (life.carrying(n) && id === "carpenter")
        v.tool
          .lineStyle(3, 0x91663a)
          .lineBetween(p.x + 18, p.y - 27, p.x + 28, p.y - 45)
          .lineStyle(5, 0x7c8680)
          .lineBetween(p.x + 22, p.y - 43, p.x + 34, p.y - 40);
      if (life.carrying(n) && id === "elder")
        v.tool
          .fillStyle(0xe2d5af)
          .fillRoundedRect(p.x + 18, p.y - 33, 15, 20, 2)
          .lineStyle(1, 0x748875)
          .lineBetween(p.x + 21, p.y - 27, p.x + 30, p.y - 27);
      if (working && id === "healer" && !life.carrying(n))
        v.tool.fillStyle(0x7eaa85).fillEllipse(p.x + 24, p.y - 30, 10, 18);
    }
    this.lastSpace = space;
  }
}
