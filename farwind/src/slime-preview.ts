import Phaser from 'phaser';
import { World } from './game/scenes/World';
import { SlimeAnimation, slimePose, SLIME_TIMES, type SlimeAction, type SlimeBody, type SlimePose } from './game/systems/slimeAnimation';
import { loadSlimeSample, drawSlimeSample } from './game/entities/slimeSample';
import { createEnemyAttack, type EnemyAttack } from './game/systems/enemyAttack';
import type { Facing } from './game/systems/locomotion';
import './slime-preview.css';

if (!import.meta.env.DEV) throw Error('史莱姆动画样片仅供本地开发审阅');
const params = new URLSearchParams(location.search);
const inGame = params.get('mode') === 'game';
const actions: Record<SlimeAction, string> = { idle: '待机', walk: '移动', attack: '短跳扑击', hurt: '普通受击', parry: '普通弹反', perfect: '精准弹反', death: '死亡' };
const phases: Record<string, string> = { charge: '蓄力', commit: '锁向（前摇内）', active: '出手', recovery: '收招', impact: '受力', stagger: '最大失衡与停滞', recover: '撑稳恢复' };
const directions = ['朝下', '朝上', '朝左（镜像）', '朝右'];
const duration = (action: SlimeAction) => action === 'attack' ? 810 : action === 'walk' ? 32 / 60 * 1000 : SLIME_TIMES[action].reduce((a, b) => a + b, 0);
const read = () => ({ action: document.querySelector<HTMLSelectElement>('#action')!.value as SlimeAction, facing: Number(document.querySelector<HTMLSelectElement>('#direction')!.value) as Facing });

class FixedPreview extends Phaser.Scene {
  elapsed = 0;
  paused = false;
  enlarged!: Phaser.GameObjects.Sprite;
  actual!: Phaser.GameObjects.Sprite;
  background!: Phaser.GameObjects.Image;
  attack!: EnemyAttack;
  action: SlimeAction = 'idle';
  facing: Facing = 0;
  preload() {
    this.load.spritesheet('slime-sample-review', '/docs/enemy-design-v2/slime-animation/slime-sample-review.png?v=sample-v1-final', { frameWidth: 256, frameHeight: 256 });
    this.load.image('forest-day', '/docs/enemy-design-v2/references/forest-day.webp');
    this.load.image('village-night', '/docs/enemy-design-v2/references/village-night.webp');
    this.load.spritesheet('hero-motion', '/assets/animation/round-three/hero-motion.png', { frameWidth: 128, frameHeight: 128 });
  }
  create() {
    if (!this.textures.exists('slime-sample-review')) {
      document.querySelector('#info')!.textContent = '样片图集未装载完成，请在素材生成结束后刷新页面。';
      this.scene.pause(); return;
    }
    this.background = this.add.image(480, 300, 'forest-day').setDisplaySize(960, 600).setAlpha(.65);
    this.add.rectangle(235, 325, 430, 390, 0xf0eadb, .95);
    this.add.rectangle(710, 325, 450, 390, 0xf0eadb, .76);
    this.enlarged = this.add.sprite(235, 420, 'slime-sample-review');
    this.actual = this.add.sprite(630, 410, 'slime-sample-review');
    this.add.sprite(790, 410, 'hero-motion', 9).setOrigin(.5, 124 / 128).setDisplaySize(86, 92);
    this.add.ellipse(235, 422, 160, 42, 0x18392d, .15);
    this.add.ellipse(630, 410, 40, 11, 0x18392d, .2);
    this.add.text(80, 470, '四倍显示 · 检查形变', { fontSize: '20px', color: '#243e35' });
    this.add.text(510, 470, '游戏原尺寸 · 史莱姆与现有主角', { fontSize: '18px', color: '#243e35' });
    const roots = this.add.graphics().setDepth(9999).lineStyle(1, 0x117e87);
    for (const [x, y] of [[235, 420], [630, 410]]) roots.lineBetween(x - 8, y, x + 8, y).lineBetween(x, y - 7, x, y + 7);
    document.querySelector<HTMLButtonElement>('#pause')!.onclick = () => { this.paused = !this.paused; this.paint(); };
    document.querySelector<HTMLButtonElement>('#restart')!.onclick = () => { this.elapsed = 0; this.paint(); };
    document.querySelector<HTMLButtonElement>('#next')!.onclick = () => { this.paused = true; this.elapsed += this.action === 'attack' ? 20 : 25; this.paint(); };
    document.querySelector<HTMLInputElement>('#scrub')!.oninput = e => { this.paused = true; this.elapsed = Number((e.target as HTMLInputElement).value); this.paint(); };
    for (const selector of ['#action', '#direction']) document.querySelector<HTMLSelectElement>(selector)!.onchange = () => { this.elapsed = 0; this.paint(); };
    document.querySelector<HTMLSelectElement>('#background')!.onchange = e => this.background.setTexture((e.target as HTMLSelectElement).value);
    Object.defineProperty(window, '__slimeSample', { configurable: true, value: () => ({ mode: 'fixed', action: this.action, facing: this.facing, elapsed: this.elapsed, paused: this.paused, pose: this.pose(), root: [630, 410], provisional: true }) });
    this.paint();
  }
  pose(): SlimePose {
    const direction = this.facing === 0 ? { x: 0, y: 1 } : this.facing === 1 ? { x: 0, y: -1 } : { x: this.facing === 2 ? -1 : 1, y: 0 };
    this.attack = createEnemyAttack('sample', 1, 'slime', 0, { x: 0, y: 0 }, direction);
    return slimePose(this.action, this.facing, this.elapsed, this.elapsed / 1000 * 60, this.attack);
  }
  paint() {
    const choice = read(); this.action = choice.action; this.facing = choice.facing;
    const pose = this.pose();
    drawSlimeSample(this.enlarged, pose, { x: 235, y: 420 }, this.elapsed, this.attack, 4);
    drawSlimeSample(this.actual, pose, { x: 630, y: 410 }, this.elapsed, this.attack);
    document.querySelector('#info')!.textContent = `${actions[this.action]} · ${directions[this.facing]} · 第 ${pose.index + 1} 帧 · ${phases[pose.phase] ?? actions[this.action]} · ${Math.round(this.elapsed)} / ${Math.round(duration(this.action))} 毫秒`;
    const scrub = document.querySelector<HTMLInputElement>('#scrub')!; scrub.max = String(duration(this.action)); scrub.value = String(Math.min(this.elapsed, duration(this.action)));
    document.querySelector('#pause')!.textContent = this.paused ? '继续播放' : '暂停';
  }
  update(_time: number, delta: number) {
    if (this.paused || document.hidden) return;
    this.elapsed += Math.min(50, delta) * Number(document.querySelector<HTMLSelectElement>('#speed')!.value);
    const end = duration(this.action), loop = this.action === 'idle' || this.action === 'walk';
    if (this.elapsed >= end + (loop ? 0 : 900)) this.elapsed = 0;
    this.paint();
  }
}

// 独立试玩场景继承正式世界；仅替换本页面的史莱姆绘制，正常入口继续使用 World。
class SlimeSampleWorld extends World {
  samples = new Map<string, { motion: SlimeAnimation; sprite: Phaser.GameObjects.Sprite; pose?: SlimePose }>();
  history: { id: string; action: SlimeAction; frame: number; phase: string; at: number; root: number[] }[] = [];
  preload() { super.preload(); loadSlimeSample(this); }
  create() {
    if (!this.textures.exists('slime-sample')) { this.ui.shell('样片素材未就绪', '<p>动画图集未装载成功，请检查开发服务后刷新。</p>'); this.scene.pause(); return; }
    super.create();
    this.add.text(12, this.scale.height - 116, '史莱姆动画样片 · 独立试玩存档 · 待美术验收', { fontSize: '14px', color: '#fff4cf', backgroundColor: '#263e36' }).setScrollFactor(0).setDepth(100001);
    Object.defineProperty(window, '__slimeSample', { configurable: true, value: () => ({ mode: 'game', sim: this.sim, provisional: true, history: this.history.slice(-500), enemies: [...this.samples].map(([id, item]) => ({ id, pose: item.pose, root: [item.motion.last?.x, item.motion.last?.y], displayed: item.sprite.visible, frame: item.sprite.frame.name, flip: item.sprite.flipX, origin: [item.sprite.originX, item.sprite.originY], scale: [item.sprite.scaleX, item.sprite.scaleY] })) }) });
  }
  async start(continued: boolean) { this.samples.clear(); this.history = []; await super.start(continued); }
  drawEnemyPose(body: Parameters<World['drawEnemyPose']>[0] & SlimeBody, attack: EnemyAttack | null | undefined, sprite: Phaser.GameObjects.Sprite) {
    if (body.type !== 'slime') { super.drawEnemyPose(body, attack, sprite); return; }
    let item = this.samples.get(body.id);
    if (!item || item.sprite !== sprite) { item = { motion: new SlimeAnimation(), sprite }; this.samples.set(body.id, item); }
    const pose = item.motion.sample(body, attack, this.sim);
    if (!item.pose || item.pose.frame !== pose.frame || item.pose.action !== pose.action) {
      this.history.push({ id: body.id, action: pose.action, frame: pose.index, phase: pose.phase, at: this.sim, root: [body.x, body.y] });
      if (this.history.length > 1000) this.history.splice(0, 500);
    }
    item.pose = pose;
    drawSlimeSample(sprite, pose, body, this.sim, attack);
  }
  update(time: number, delta: number) {
    super.update(time, delta);
    if (!this.active || this.ui.paused) return;
    for (const body of this.enemies) {
      if (body.type !== 'slime') continue;
      if (body.hp <= 0 && this.samples.has(body.id)) {
        this.drawEnemyPose(body, null, body.sprite);
        const elapsed = this.samples.get(body.id)!.pose!.elapsed;
        const alpha = Math.max(0, 1 - Math.max(0, elapsed - 2000) / 400);
        body.sprite.setVisible(alpha > 0).setAlpha(alpha);
        body.shadow.setVisible(alpha > 0).setAlpha(alpha);
      }
      // 普通受击已有真实凹陷帧；样片不用原先红色闪烁覆盖形体。
      body.sprite.clearTint();
    }
  }
}

if (inGame) {
  if (location.port !== '5174') throw Error('真实试玩请使用独立本地端口 5174，保护常用 5173 的存档');
  // 验证专用服务已经隔离存档，误用普通开发服务时不启动真实世界。
  const storageSource = await fetch('/src/game/systems/save.ts').then(r => r.text());
  if (!storageSource.includes('farwind-slime-animation-sample')) throw Error('请使用样片专用开发配置启动；存档隔离未建立');
  await import('./style.css');
  document.body.className = '';
  document.body.innerHTML = '<div id="game"></div><div id="ui"></div>';
  const game = new Phaser.Game({ type: Phaser.WEBGL, parent: 'game', width: innerWidth, height: innerHeight, scene: [SlimeSampleWorld], audio: { noAudio: true }, render: { antialias: true }, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH } });
  window.addEventListener('resize', () => game.scale.resize(innerWidth, innerHeight));
} else {
  new Phaser.Game({ type: Phaser.WEBGL, parent: 'preview', width: 960, height: 600, backgroundColor: '#eee8d8', scene: [FixedPreview], audio: { noAudio: true }, render: { antialias: true }, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH } });
}
