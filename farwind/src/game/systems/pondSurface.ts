import Phaser from "phaser";
import { POND } from "../../data/world";
import { WATER } from "./waterMotion";

// 只改变原手绘水面的局部采样位置，没有整体平移、重绘地面或离屏滤镜通道。
const fragmentSource = `
precision highp float;
varying vec2 outTexCoord;
uniform sampler2D uWater;
uniform float uTime;
uniform vec2 uSize;
uniform vec2 uAmplitude;
uniform vec2 uRate;
uniform vec2 uEdge;
uniform float uLight;
void main() {
  vec2 uv = vec2(outTexCoord.x, 1.0-outTexCoord.y);
  float radius = length((uv-0.5)*2.0);
  if (radius >= 1.0) discard;
  float strength = 1.0-smoothstep(uEdge.x, uEdge.y, radius);
  vec2 p = uv*uSize;
  float a = p.x*0.064+p.y*0.031-uTime*uRate.x;
  float b = p.x*0.021-p.y*0.086-uTime*uRate.y;
  vec2 displacement = vec2(
    (sin(a)+0.35*sin(b))/1.35,
    (cos(p.x*0.043+p.y*0.092-uTime*uRate.y)+0.3*sin(p.x*0.091+p.y*0.024-uTime*uRate.x))/1.3
  )*uAmplitude*strength;
  vec4 water = texture2D(uWater, uv+displacement/uSize);
  // 光照沿已有的手绘浅色笔触缓慢变化；不额外生成白色条带或焦散网格。
  float reflection = smoothstep(0.42, 0.78, water.r);
  water.rgb *= 1.0+reflection*strength*uLight*(sin(a)*0.6+sin(b)*0.4);
  float coverage = 1.0-smoothstep(1.0-1.0/min(uSize.x,uSize.y), 1.0, radius);
  gl_FragColor = water*coverage;
}`;

export function createPondSurface(scene: Phaser.Scene, time: () => number) {
  const width = POND.rx*2, height = POND.ry*2, config = WATER.pond.surface, minRadius = Math.min(POND.rx,POND.ry);
  const surface = new Phaser.GameObjects.Shader(scene, {
    name: "FarwindPondSurfaceV1", fragmentSource,
    setupUniforms: (set: (name: string, value: unknown) => void) => set("uTime", time()/1000),
    initialUniforms: { uWater: 0, uSize: [width,height], uAmplitude: config.amplitude,
      uRate: config.rate, uEdge: [1-(config.fixedInset+config.fadeWidth)/minRadius,1-config.fixedInset/minRadius], uLight: config.lightAmplitude },
  }, POND.x,POND.y,width,height,["pond-water"]).setDepth(WATER.depth.pond);
  scene.add.existing(surface);
  // Phaser 4.2.1的Shader.preDestroy仅清引用。释放本对象的顶点缓冲和VAO；
  // 编译程序由渲染器缓存共享，池水PNG和通用索引缓冲不属于本模块。
  const node = surface.renderNode, renderer = scene.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
  surface.once(Phaser.GameObjects.Events.DESTROY, () => {
    for (const suite of Object.values(node.programManager.programs) as {vao: Phaser.Renderer.WebGL.Wrappers.WebGLVAOWrapper}[]) {
      Phaser.Utils.Array.Remove(renderer.glVAOWrappers, suite.vao);
      suite.vao.destroy();
    }
    renderer.deleteBuffer(node.vertexBufferLayout.buffer);
  });
  return surface;
}
