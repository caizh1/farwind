import {VILLAGE_ANCHORS,buildingLot} from './maps/windbell/layout';
export const DAY_NIGHT = {
  day: 1440, speed: 1.5, dawn: 360, daylight: 480, dusk: 1020, night: 1140,
  raidStart: 1200, raidEnd: 1440, sleepCost: 12, maxTime: 1e8,
} as const;
export type DayPhase = "dawn" | "day" | "dusk" | "night";
export const PHASE_NAMES: Record<DayPhase, string> = {dawn:"黎明",day:"白天",dusk:"黄昏",night:"夜晚"};
// 首尾相同，午夜表现连续；灯火只由采样亮度驱动。
export const LIGHT_KEYS = [
  {minute:0,color:[22,30,55],shade:.34,lamps:1},
  {minute:300,color:[22,30,55],shade:.34,lamps:1},
  {minute:360,color:[78,67,85],shade:.22,lamps:.65},
  {minute:480,color:[255,236,201],shade:0,lamps:0},
  {minute:960,color:[255,236,201],shade:0,lamps:0},
  {minute:1080,color:[173,92,54],shade:.13,lamps:.4},
  {minute:1140,color:[74,54,81],shade:.24,lamps:.85},
  {minute:1200,color:[22,30,55],shade:.34,lamps:1},
  {minute:1440,color:[22,30,55],shade:.34,lamps:1},
] as const;
export const WORLD_LIGHTS = [
  {x:670,y:785,r:180}, {x:550,y:564,r:105}, {x:326,y:841,r:95},
  {...buildingLot('resident-cottage-2').door,r:100}, {x:1630,y:1520,r:130}, {x:1685,y:1640,r:140},
  {...VILLAGE_ANCHORS.general,r:100}, {...VILLAGE_ANCHORS.smith,r:100},
  {x:2012,y:1080,r:135}, {x:2190,y:1080,r:135},
  {x:2030,y:796,r:105}, {x:730,y:220,r:130}, {x:910,y:220,r:130},
  {x:680,y:270,r:100}, {x:930,y:1750,r:130}, {x:1100,y:1750,r:130},
  {x:1140,y:1650,r:100},
] as const;
export const NIGHT_DISCOVERY={id:"waterside-night",x:1330,y:1470,radius:90,label:"临水夜风"} as const;
