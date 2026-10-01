import {CAMP_BOSSES,BOSS_RULES} from '../../data/maps/windbell/campBosses';
import {ENCOUNTERS} from '../../data/maps/windbell/encounters';
import type {State} from '../systems/state';
import {enemyLeashRadius} from '../../data/enemyPursuit';

export function updateCampBossHud(root:HTMLElement,s:State){
 const candidates=ENCOUNTERS.filter(d=>{
  const b=s.encounters.groups[d.id].boss,dist=Math.hypot(s.player.x-d.x,s.player.y-d.y);
  return d.kind==='camp'&&(b?.stage==='battle'?(dist<=enemyLeashRadius({boss:true,leashRadius:d.radius})||b.away>0):b?.stage==='warning'&&dist<d.radius+200);
 }).sort((a,b)=>Math.hypot(s.player.x-a.x,s.player.y-a.y)-Math.hypot(s.player.x-b.x,s.player.y-b.y));
 const d=candidates[0];root.hidden=!d||s.life.playerSpace!=='village';if(root.hidden)return;
 const g=s.encounters.groups[d.id],b=g.boss!,m=d.members.find(m=>m.boss)!,i=d.members.indexOf(m),info=CAMP_BOSSES[m.boss!],combat=b.combat?.battle;
 root.querySelector('b')!.textContent=info.name;
 const bar=root.querySelector('progress')!;bar.max=info.hp;bar.value=g.members[i].hp;bar.setAttribute('aria-label',`${info.name}生命 ${Math.ceil(bar.value)} / ${info.hp}`);
 root.querySelector('[data-boss-health]')!.textContent=b.stage==='warning'?'首领尚未击败':`${Math.ceil(bar.value)} / ${info.hp} · 第${combat?.phase??1}阶段`;
 const arriving=!!combat&&combat.entryUntil>0,roots=m.boss==='spore-heart'?combat?.roots?.filter(r=>r.hp>0).length??0:0;
 const status=b.stage==='warning'?b.warning>0?`地面异动 · ${(b.warning/1000).toFixed(1)}秒`:'首领待入场 · 等待安全位置':b.away>0?`撤战倒计时 · ${((BOSS_RULES.retreat-b.away)/1000).toFixed(1)}秒`:arriving?'首领现身 · 保持距离':combat&&(combat.transformUntil>0)?'半血变化 · 第二阶段':combat?.phase===1&&bar.value<=info.hp*.5?'半血变化 · 本招结束后转换':combat&&(combat.exposedUntil>0)?'弱点暴露 · 反击窗口':roots?`祭根×${roots} · 拆根削弱护心`:m.boss==='spore-heart'&&combat?.phase===2?'祭根已断 · 识招反击核心':'护体中 · 识招后反击';
 root.querySelector('[data-boss-state]')!.textContent=status;root.dataset.exposed=String(!!combat&&combat.exposedUntil>0);root.dataset.arriving=String(arriving);root.setAttribute('aria-description',info.lesson);
}
