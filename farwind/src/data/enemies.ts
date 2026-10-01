// 沿用旧敌人ID与掉落类别，新增物种不改变主线或存档结构。
export const ENEMIES = {
  slime: { name: '苔团史莱姆', art: 'moss-slime', hp: 48, speed: 60, reach: 80, height: 44, stride: 32, frames: 48, drop: 'berry' },
  leaf: { name: '裂枝镰灵', art: 'branch-reaper', hp: 72, speed: 95, reach: 80, height: 78, stride: 46, frames: 48, drop: 'crystal' },
  spore: { name: '灰冠孢卫', art: 'ashen-spore', hp: 60, speed: 45, reach: 300, height: 72, stride: 38, frames: 48, drop: 'berry' },
  boar: { name: '棘甲林豕', art: 'armored-boar', hp: 90, speed: 70, reach: 220, height: 65, stride: 52, frames: 40, drop: 'berry' },
  raven: { name: '暮羽鸦妖', art: 'dusk-raven', hp: 64, speed: 85, reach: 140, height: 82, stride: 44, frames: 36, drop: 'berry' },
  wolf: { name: '荆棘狼', art: 'thorn-wolf', hp: 58, speed: 112, reach: 145, height: 64, stride: 46, frames: 24, drop: 'berry' },
  burrow: { name: '潜地虫', art: 'burrow-worm', hp: 62, speed: 42, reach: 150, height: 55, stride: 34, frames: 24, drop: 'herb' },
  guardian: { name: '苔甲守卫', art: 'moss-guardian', hp: 84, speed: 52, reach: 95, height: 84, stride: 38, frames: 24, drop: 'stone' },
  priest: { name: '菌铃祭司', art: 'fungal-priest', hp: 96, speed: 48, reach: 340, height: 66, stride: 36, frames: 24, drop: 'herb' },
  bomber: { name: '爆囊滚兽', art: 'sac-roller', hp: 112, speed: 68, reach: 260, height: 57, stride: 42, frames: 24, drop: 'berry' },
} as const;
export type EnemyKind = keyof typeof ENEMIES;
export const enemyKind = (type: string): EnemyKind => Object.hasOwn(ENEMIES, type) ? type as EnemyKind : 'slime';
export const enemyProfile = (type: string) => ENEMIES[enemyKind(type)];
// 素材分辨率独立于屏幕高度；样片仍保留临时美术标记。
export function enemyArt(type: string) {
  const kind=enemyKind(type),sample=kind==='leaf'||kind==='spore';
  return {path:`/assets/enemies-${sample?'v2':'v1'}/${ENEMIES[kind].art}.png`,frameWidth:sample?384:160,frameHeight:sample?256:160,nativeHeight:sample?160:60,originY:110/128};
}
