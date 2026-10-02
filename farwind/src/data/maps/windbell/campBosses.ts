import type {EnemyKind} from '../../enemies';
import {BOSS_PURSUIT} from '../../enemyPursuit';

// 首领沿用物种的阵营与掉落，但拥有独立造型、生命上限和技能。
export const CAMP_BOSSES = {
  'spore-heart': {phaseName:'双根共鸣',name:'孢心巢母',camp:'south-spore-camp',type:'spore',hp:2300,height:220,speed:48,color:0xd7ae6b,
    skills:['错拍孢雨','追根三刺','菌冠横扫','孢环回涌','祭根共鸣','孢囊播种'],lesson:'孢雨留有间隙；根刺锁定后离开；爆裂环可向内穿越。'},
  'thorn-crown': {phaseName:'月痕追猎',name:'荆冠猎王',camp:'west-wolf-den',type:'wolf',hp:2800,height:210,speed:108,color:0xc8b897,
    skills:['连段扑猎','交叉爪击','甩尾荆刺','侧跃反扑','荆狼呼唤','月痕围猎'],lesson:'每次扑击独立锁向；看清最后一扑，再进入反击窗口。'},
  'crag-tusk': {phaseName:'断岩怒踏',name:'崩岩獠王',camp:'north-boar-camp',type:'boar',hp:2500,height:240,speed:62,color:0xe3ad76,
    skills:['裂地冲锋','半月甩角','三连震踏','环形震地','断岩筑阵','碎岩投掷'],lesson:'横移避开冲锋；真实撞墙会失衡；震地环可用风步穿越。'},
  'bound-branch': {phaseName:'双印仪式',name:'缚枝祭主',camp:'east-thorn-camp',type:'leaf',hp:2500,height:250,speed:68,color:0xa8d6bd,
    skills:['十字镰斩','棘针齐射','缠根封路','护心结茧','移步换阵','缚枝仪式'],lesson:'交叉斩分两段；重击或绕后破开护心茧，风核暴露时反击。'},
} as const satisfies Record<string,{phaseName:string;name:string;camp:string;type:EnemyKind;hp:number;height:number;speed:number;color:number;skills:readonly string[];lesson:string}>;
export type CampBossKind=keyof typeof CAMP_BOSSES;
export const BOSS_PHASE_HINTS:Record<CampBossKind,string>={
 'spore-heart':'拆除两处祭根削弱保护；双根全断，核心暴露两秒。',
 'thorn-crown':'三次扑猎分别锁向；击败两只护猎狼，使猎王失衡两秒。',
 'crag-tusk':'诱导冲锋撞墙或岩柱，破甲一点八秒；绕背攻击。',
 'bound-branch':'根带中央留有通道；拆除两处祭印，中止仪式并露出风核。',
};
// 实体弹丸采用亮色核心和深色边缘；两类弹丸用圆形与针形区分，色觉差异也能识别。
export const BOSS_PROJECTILES={
  'spore-heart':{color:0xffa13e,core:0xfff5cc,outline:0x442139,size:36},
  'crag-tusk':{color:0xf6b17d,core:0xfff5cc,outline:0x433025,size:36},
  'thorn-crown':{color:0xdacaad,core:0xfff5cc,outline:0x394d36,size:30},
  'bound-branch':{color:0xff668e,core:0xfff5df,outline:0x39213d,size:40},
} as const;
export const BOSS_RULES={entry:2500,appearance:1800,retreat:BOSS_PURSUIT.lostDelay,retreatMargin:80,damage:22,heavyDamage:30,reduction:0,exposed:1500,control:400,controlImmunity:3000,transform:800,maxHazards:3,ringInner:24,ringWidth:22} as const;
export const bossForCamp=(id:string)=>Object.entries(CAMP_BOSSES).find(([,d])=>d.camp===id)?.[0] as CampBossKind|undefined;
