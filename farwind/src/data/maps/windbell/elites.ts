import {enemyProfile} from '../../enemies';
import {CAMP_BOSSES,type CampBossKind} from './campBosses';
// 精英共享原物种的身体、伤害与素材；变化来自招式和场地。
export const ELITES={
 alpha:{name:'荆棘头狼',type:'wolf',hp:150,reach:215},
 ram:{name:'裂岩林豕',type:'boar',hp:180,reach:290},
 brood:{name:'灰冠母孢',type:'spore',hp:160,reach:340},
} as const;
export type EliteKind=keyof typeof ELITES;
export const creatureMaxHP=(type:string,elite?:EliteKind,boss?:CampBossKind)=>boss?CAMP_BOSSES[boss].hp:elite?ELITES[elite].hp:enemyProfile(type).hp;
export const creatureReach=(type:string,elite?:EliteKind)=>elite?ELITES[elite].reach:enemyProfile(type).reach;
export const ARENA_STONES=[
 {id:'echo-stone-west',x:880,y:-900,w:100,h:115,solid:[72,58] as const},
 {id:'echo-stone-east',x:1280,y:-900,w:100,h:115,solid:[72,58] as const},
 {id:'echo-stone-south',x:1080,y:-770,w:100,h:115,solid:[72,58] as const},
] as const;
export type ArenaStoneId=typeof ARENA_STONES[number]['id'];
