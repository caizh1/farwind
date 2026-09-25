import Phaser from "phaser";
import { World } from "./game/scenes/World";
import "./style.css";
const root = document.querySelector("#game")!;
try {
  const probe = document.createElement("canvas");
  if (!probe.getContext("webgl2") && !probe.getContext("webgl"))
    throw Error("当前浏览器无法使用 WebGL。请启用硬件加速后重新打开。");
  const width = Math.min(
      1920,
      Math.round(window.innerWidth * Math.min(devicePixelRatio, 1.5)),
    ),
    height = Math.round((width * window.innerHeight) / window.innerWidth);
  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent: "game",
    width,
    height,
    backgroundColor: "#90ac6f",
    render: {
      antialias: true,
      antialiasGL: true,
      pixelArt: false,
      roundPixels: false,
    },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [World],
    audio: { noAudio: true },
  });
  window.addEventListener("resize", () => {
    const w = Math.min(
      1920,
      Math.round(window.innerWidth * Math.min(devicePixelRatio, 1.5)),
    );
    game.scale.resize(
      w,
      Math.round((w * window.innerHeight) / window.innerWidth),
    );
  });
} catch (e) {
  root.textContent = `游戏启动失败：${(e as Error).message}`;
}
window.addEventListener("error", (e) => {
  console.error("游戏运行错误", e.error);
});
