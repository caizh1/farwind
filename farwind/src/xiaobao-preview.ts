import Phaser from "phaser";
import { XIAOBAO, XIAOBAO_CLIPS, xiaobaoPose, type XiaobaoClip } from "./data/xiaobao";
import { XiaobaoView } from "./game/entities/xiaobaoView";
import { Actor } from "./game/entities/actor";
import "./xiaobao-preview.css";

const select = document.querySelector<HTMLSelectElement>("#action")!;
const keys = Object.keys(XIAOBAO_CLIPS) as XiaobaoClip[];
for (const key of keys) {
  const option = document.createElement("option"); option.value = key; option.textContent = XIAOBAO_CLIPS[key].name; select.append(option);
  const button = document.createElement("button"); button.dataset.clip = key; button.textContent = XIAOBAO_CLIPS[key].name;
  document.querySelector("#clips")!.append(button);
}
class Preview extends Phaser.Scene {
  elapsed = 0; paused = false; all = false;
  large!: XiaobaoView; actual!: XiaobaoView;
  preload() {
    XiaobaoView.preload(this);
    this.load.image("preview-grass", "/assets/grass.png");
    this.load.spritesheet("preview-hero", "/assets/animation/round-three/hero-motion.png", { frameWidth: 128, frameHeight: 128 });
  }
  create() {
    this.add.tileSprite(490, 206, 980, 412, "preview-grass").setAlpha(0.42);
    this.add.rectangle(249, 205, 464, 374, 0xf1ecd9, 0.94);
    this.add.rectangle(731, 205, 464, 374, 0xf1ecd9, 0.91);
    this.large = new XiaobaoView(this); this.actual = new XiaobaoView(this);
    this.large.controller.x = 249; this.large.controller.y = 328;
    this.actual.controller.x = 653; this.actual.controller.y = 305;
    this.large.sprite.setDisplaySize(XIAOBAO.displaySize * 3, XIAOBAO.displaySize * 3);
    this.large.shadow.setSize(81, 20);
    this.add.sprite(797, 305, "preview-hero", 9).setOrigin(0.5, 124 / 128).setDisplaySize(86, 92).setDepth(305);
    this.add.text(797, 319, "现有旅人", { fontSize: "12px", color: "#476151" }).setOrigin(0.5);
    this.add.text(249, 370, "三倍显示 · 查看神态与手脚", { fontSize: "16px", color: "#476151" }).setOrigin(0.5);
    this.add.text(731, 370, "游戏尺寸 · 与旅人对照", { fontSize: "16px", color: "#476151" }).setOrigin(0.5);
    const ink = this.add.graphics().lineStyle(1, 0x7d9e86, 0.6);
    for (const [x, y] of [[249, 328], [653, 305]]) ink.lineBetween(x - 14, y, x + 14, y).lineBetween(x, y - 6, x, y + 6);
    select.onchange = () => { this.elapsed = 0; this.all = false; this.paint(); };
    document.querySelector<HTMLSelectElement>("#direction")!.onchange = () => this.paint();
    document.querySelector<HTMLButtonElement>("#pause")!.onclick = () => { this.paused = !this.paused; this.paint(); };
    document.querySelector<HTMLButtonElement>("#restart")!.onclick = () => { this.elapsed = 0; this.paint(); };
    document.querySelector<HTMLButtonElement>("#show-all")!.onclick = () => { this.all = true; this.paused = false; this.elapsed = 0; select.value = keys[0]; this.paint(); };
    document.querySelector<HTMLInputElement>("#scrub")!.oninput = (e) => { this.all = false; this.paused = true; this.elapsed = Number((e.target as HTMLInputElement).value); this.paint(); };
    for (const button of document.querySelectorAll<HTMLButtonElement>("[data-clip]")) button.onclick = () => { select.value = button.dataset.clip!; this.elapsed = 0; this.all = false; this.paint(); };
    Object.defineProperty(window, "__xiaobaoPreview", { configurable: true, value: () => ({ action: select.value, elapsed: this.elapsed, paused: this.paused, pose: xiaobaoPose(select.value as XiaobaoClip, this.elapsed, this.elapsed / 1000 * 36), roots: [[249, 328], [653, 305]], objects: this.children.length }) });
    this.paint();
  }
  paint() {
    const action = select.value as XiaobaoClip, duration = XIAOBAO_CLIPS[action].duration, time = Math.min(this.elapsed, duration - 1);
    const left = document.querySelector<HTMLSelectElement>("#direction")!.value === "left";
    for (const view of [this.large, this.actual]) {
      view.controller.action = action; view.controller.elapsed = time; view.controller.motion.distance = time / 1000 * 36;
      view.render(true); Actor.mirror(view.sprite, left); view.wind.setVisible(view === this.actual);
      view.label.setVisible(false);
    }
    this.large.sprite.y = 328 - xiaobaoPose(action, time).lift * 3;
    document.querySelector("#info")!.textContent = `${XIAOBAO_CLIPS[action].name} · 第${xiaobaoPose(action, time, time / 1000 * 36).frameIndex + 1}帧 · ${Math.round(time)}／${duration}毫秒`;
    const range = document.querySelector<HTMLInputElement>("#scrub")!; range.max = String(duration - 1); range.value = String(time);
    document.querySelector("#pause")!.textContent = this.paused ? "继续播放" : "暂停";
    for (const b of document.querySelectorAll<HTMLButtonElement>("[data-clip]")) b.setAttribute("aria-pressed", String(b.dataset.clip === action));
  }
  update(_time: number, delta: number) {
    if (this.paused || document.hidden) return;
    this.elapsed += Math.min(delta, 100);
    if (this.elapsed > XIAOBAO_CLIPS[select.value as XiaobaoClip].duration + 550) {
      this.elapsed = 0;
      if (this.all) select.value = keys[(keys.indexOf(select.value as XiaobaoClip) + 1) % keys.length];
    }
    this.paint();
  }
}
new Phaser.Game({ type: Phaser.WEBGL, parent: "preview", width: 980, height: 412, scene: [Preview], audio: { noAudio: true }, backgroundColor: "#e9ead7", render: { antialias: true }, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH } });
