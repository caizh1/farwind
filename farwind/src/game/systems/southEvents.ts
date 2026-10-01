import type {EncounterState} from './encounterState';
export const SOUTH_EVENTS={
  herb:{name:'洼地净根',x:740,y:2460,hp:96,resources:['wild-resource-1','wild-resource-2'],hint:'拆除药草洼地的菌根，恢复两处药草采集。'},
  orchard:{name:'果园清障',x:1840,y:2450,hp:64,resources:['wild-resource-4'],hint:'把滚兽诱到果园菌障旁；爆炸能拆障，也可直接攻击。'},
} as const;
export type SouthEventId=keyof typeof SOUTH_EVENTS;
export type SouthEventState={herb:number;orchard:number;claimed:SouthEventId[]};
export const initialSouthEvents=():SouthEventState=>({herb:96,orchard:64,claimed:[]});
export function validateSouthEvents(raw:unknown,encounters:EncounterState):SouthEventState{
  if(raw===undefined){const s=initialSouthEvents();if(encounters.groups['south-herb-patrol'].activated)s.herb=0;if(encounters.groups['south-orchard-burrows'].activated)s.orchard=0;
    if(encounters.groups['south-spore-camp'].cleared){s.herb=s.orchard=0;s.claimed=['herb','orchard'];}return s;}
  const s=raw as SouthEventState;
  if(!s||!Number.isFinite(s.herb)||s.herb<0||s.herb>96||!Number.isFinite(s.orchard)||s.orchard<0||s.orchard>64||!Array.isArray(s.claimed)||s.claimed.length>2||new Set(s.claimed).size!==s.claimed.length||s.claimed.some(id=>!Object.hasOwn(SOUTH_EVENTS,id)||s[id]!==0))throw Error('南线事件存档无效，上一份有效存档仍保留。');
  return {herb:s.herb,orchard:s.orchard,claimed:[...s.claimed]};
}
export function southResourceBlock(s:SouthEventState,id:string){
  return (Object.keys(SOUTH_EVENTS) as SouthEventId[]).find(key=>s[key]>0&&(SOUTH_EVENTS[key].resources as readonly string[]).includes(id));
}
