import type { World } from "../scenes/World";
import { GUARD_DEFS, RAID_GATES } from "../../data/defense";
import { zoneFor, locallyProtected } from "../../data/defenseZones";
import { MAINTENANCE } from "../../data/npcLife";
import { DAY_NIGHT } from "../../data/dayNight";
import { regionAt } from "../../data/village";
import { clearMeleeLine, motionBlocked, type Point } from "./obstacles";
import { predictEnemyContact } from "./enemyAttack";
import { type XiaobaoAlly, type XiaobaoEnvironment, type XiaobaoFront } from "./xiaobaoCombat";
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
export function xiaobaoEnvironment(w: World): XiaobaoEnvironment {
  const c=w.xiaobao!.controller,outside=w.state.life.playerSpace==='village',p=outside?w.state.player:{...w.state.life.outside,hp:0};
  const enemies=[...w.enemies,...w.defense.enemies];
  const allies: XiaobaoAlly[]=[
    ...(outside&&p.hp>0?[{...p,id:'player',maxHP:100,role:'player' as const,threatAt:null}]:[]),
    {id:'xiaobao',x:c.x,y:c.y,hp:c.data.hp,maxHP:640,role:'self',threatAt:null},
    ...w.state.defense.guards.filter(g=>!g.dead&&(g.space??'village')==='village').map(g=>({id:g.id,x:g.x,y:g.y,hp:g.hp,maxHP:GUARD_DEFS.find(d=>d.id===g.id)!.maxHP,role:'guard' as const,threatAt:null})),
    ...w.state.life.people.flatMap(n=>n.body?.space==='village'&&n.body.hp>0&&n.body.health!=='down'?[{...n.body,id:n.id,maxHP:100,role:'resident' as const,threatAt:null}]:[]),
    ...MAINTENANCE.filter(f=>w.state.life.facilities[f.id]>0).map(f=>({...f.place,id:f.id,hp:w.state.life.facilities[f.id],maxHP:100,role:'facility' as const,threatAt:null})),
  ];
  for(const e of enemies){if(e.hp<=0||e.disabled||!e.attack||e.attack.cancelled||e.attack.resolved)continue;
    const victim=allies.find(a=>a.id===e.targetId);if(!victim||e.attack.contactAt>w.sim+600)continue;
    const at=predictEnemyContact(e.attack,e,victim,w.sim);
    if(at!==null&&at<=w.sim+600)victim.threatAt=Math.min(victim.threatAt??Infinity,at);
  }
  return { now:w.sim,minute:w.state.time,player:{...p,outside,region:regionAt(p).id},enemies,allies,recent:w.xiaobaoRecent,
    fronts:()=>xiaobaoFronts(w,allies),move:(...args)=>w.defense.move(...args),hit:(...args)=>w.xiaobaoHit(...args),
    blocked:p=>motionBlocked(p.x,p.y),takeoffClear:p=>!w.xiaobaoUnderRoof(p),message:s=>w.ui.message(s) };
}
export function xiaobaoFronts(w: World, allies: XiaobaoAlly[]): XiaobaoFront[] {
  const defense=w.defense,now=w.sim,live=defense.allHostiles().filter(e=>e.hp>0&&!e.disabled);
  const recent=w.state.life.events.filter(e=>!e.debug&&['injury','down','damage','death'].includes(e.kind)&&
    (w.state.time-e.time)/DAY_NIGHT.speed*1000<=1500&&e.place.space==='village');
  const grouped=RAID_GATES.flatMap(g=>{
    const threats=live.filter(e=>{
      const record=defense.threats.get(e.id),reason=defense.threatReason(g.id,e),hurt=recent.some(r=>r.source===e.id);
      const actual=allies.find(a=>a.id===e.targetId&&a.threatAt!==null&&a.role!=='self'&&a.role!=='player');
      const reported=record?.gateId===g.id&&now-record.lastSeen<=1500;
      const seen=allies.some(a=>a.role==='resident'&&distance(a,e)<=450&&clearMeleeLine(a,e));
      const nearest=RAID_GATES.reduce((a,b)=>distance(e,a.inside)<=distance(e,b.inside)?a:b).id===g.id;
      return !!reason||nearest&&(hurt||!!actual||seen&&locallyProtected(g.id,e))||reported;
    });
    if(!threats.length)return [];
    const urgent=allies.filter(a=>['resident','facility'].includes(a.role)&&a.threatAt!==null&&threats.some(e=>e.targetId===a.id));
    const injured=recent.some(r=>threats.some(e=>e.id===r.source));
    const intrusion=threats.some(e=>defense.threatReason(g.id,e)==='intrusion'||regionAt(e).id==='village');
    const battle=threats.some(e=>['intrusion','attack'].includes(defense.threatReason(g.id,e)??'')||e.attack&&!e.attack.cancelled&&!e.attack.resolved);
    const failed=battle&&w.state.defense.guards.filter(d=>d.id.startsWith(g.id.split('-')[0])&&!d.dead&&!d.offDuty&&(d.space??'village')==='village'&&d.hp/GUARD_DEFS.find(f=>f.id===d.id)!.maxHP>=.35).length<2;
    const breach=intrusion&&threats.some(e=>distance(e,g.inside)<260&&((e.x-g.inside.x)*(g.inside.x-g.entry.x)+(e.y-g.inside.y)*(g.inside.y-g.entry.y))/distance(g.inside,g.entry)>80||distance(e,{x:760,y:740})<380);
    const low=allies.some(a=>a.hp/a.maxHP<.3&&a.threatAt!==null&&threats.some(e=>e.targetId===a.id));
    const key=w.state.defense.raid?.gateId===g.id?w.state.defense.raid.id:`front:${g.id}`;
    return [{key,gate:g.id,major:injured||urgent.length>0||failed||breach,priority:injured||urgent.length?5:low?4:intrusion?3:failed?2:1,
      point:urgent[0]??zoneFor(g.id).intercept,enemies:threats.map(e=>e.id),injured,battle}];
  });
  if(grouped.filter(g=>g.battle).length>=2)for(const g of grouped)if(g.battle)g.major=true;
  return grouped;
}
