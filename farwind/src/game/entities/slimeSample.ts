import Phaser from 'phaser';
import { Actor } from './actor';
import { SLIME_ART, type SlimePose } from '../systems/slimeAnimation';
import { sampleEnemyAttack, type EnemyAttack } from '../systems/enemyAttack';

export const SLIME_SAMPLE_URL = '/docs/enemy-design-v2/slime-animation/slime-sample.png?v=sample-v1-final';
export function loadSlimeSample(scene: Phaser.Scene) {
  scene.load.spritesheet('slime-sample', SLIME_SAMPLE_URL, { frameWidth: 128, frameHeight: 128 });
}
export function drawSlimeSample(sprite: Phaser.GameObjects.Sprite, pose: SlimePose, root: { x: number; y: number }, now: number, attack?: EnemyAttack | null, magnification = 1) {
  const leap = pose.action === 'attack' && attack && pose.phase === 'active' ? sampleEnemyAttack(attack, now, root).offset.y : 0;
  const texture = sprite.texture.key === 'slime-sample-review' ? 'slime-sample-review' : 'slime-sample';
  sprite.setTexture(texture, pose.frame).setOrigin(.5, SLIME_ART.rootY / SLIME_ART.frameSize)
    .setDisplaySize(SLIME_ART.displaySize * magnification, SLIME_ART.displaySize * magnification)
    .setPosition(root.x, root.y + leap * magnification).setDepth(root.y).setRotation(0);
  Actor.mirror(sprite, pose.facing === 2);
}
