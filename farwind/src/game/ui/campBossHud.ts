import {CAMP_BOSSES,BOSS_RULES,BOSS_PHASE_HINTS} from '../../data/maps/windbell/campBosses';
import {ENCOUNTERS} from '../../data/maps/windbell/encounters';
import type {State} from '../systems/state';
import {enemyLeashRadius} from '../../data/enemyPursuit';
import {WORLD} from '../../data/world';

export function updateCampBossHud(root:HTMLElement,s:State){
 s=s.windMemory.active?{...s,encounters:s.windMemory.active.encounters}:s;
 const candidates=ENCOUNTERS.filter(d=>{
  const b=s.encounters.groups[d.id].boss,dist=Math.hypot(s.player.x-d.x,s.player.y-d.y);
  return d.kind==='camp'&&(b?.stage==='battle'?(dist<=enemyLeashRadius({boss:true,leashRadius:d.radius})||b.away>0):b?.stage==='warning'&&dist<d.radius+200);
 }).sort((a,b)=>Math.hypot(s.player.x-a.x,s.player.y-a.y)-Math.hypot(s.player.x-b.x,s.player.y-b.y));
 const d=candidates[0];root.hidden=!d||s.life.playerSpace!=='village';if(root.hidden)return;
 const g=s.encounters.groups[d.id],b=g.boss!,m=d.members.find(m=>m.boss)!,i=g.members.findIndex(u=>u.id===(s.encounters.instance?`${s.encounters.instance}|${m.id}`:m.id)),info=CAMP_BOSSES[m.boss!],combat=b.combat?.battle;
 // 镜头在地图边缘无法居中，生命栏留在首领所在半屏的另一侧。
 // 按固定场地判断，避免扑猎过程中界面来回跳动。
 root.dataset.vitalsSide=d.x-WORLD.left<1280/(2*.82)?'right':'left';
 root.querySelector('b')!.textContent=info.name;
 const bar=root.querySelector('progress')!;bar.max=info.hp;bar.value=g.members[i].hp;bar.setAttribute('aria-label',`${info.name}生命 ${Math.ceil(bar.value)} / ${info.hp}`);
 root.querySelector('[data-boss-health]')!.textContent=b.stage==='warning'?'首领尚未击败':`${Math.ceil(bar.value)} / ${info.hp} · 第${combat?.phase??1}阶段`;
 const arriving=!!combat&&combat.entryUntil>0,roots=m.boss==='spore-heart'?combat?.roots?.filter(r=>r.hp>0&&(r.kind??'root')==='root').length??0:0;
 const status=b.stage==='warning'?b.warning>0?`地面异动 · ${(b.warning/1000).toFixed(1)}秒`:'首领待入场 · 等待安全位置':b.away>0?`撤战倒计时 · ${((BOSS_RULES.retreat-b.away)/1000).toFixed(1)}秒`:arriving?'首领现身 · 保持距离':combat&&(combat.transformUntil>0)?`${info.phaseName} · ${info.lesson}`:combat?.phase===1&&bar.value<=info.hp*.55?'半血变化 · 本招结束后转换':combat&&(combat.exposedUntil>0)?'弱点暴露 · 反击窗口':roots?`祭根×${roots} · 拆根削弱护心`:m.boss==='spore-heart'&&combat?.phase===2?'祭根已断 · 识招反击核心':'观察前摇 · 锁向后横移 · 收招时反击';
 const a=b.combat?.attack,phaseChange=!!combat&&combat.transformUntil>0;
 const move=a&&!a.cancelled&&a.recoveryUntil>0?`${info.skills[a.bossSkill??0]} · ${a.contactAt>0?'蓄力':a.activeUntil>0?'出手':'收招'} · ${a.bossCocoon?'重击或绕后破茧':a.damage===0?'召唤与机关':a.parryable?'可弹反':'须躲避'}`:'';
 root.querySelector('[data-boss-state]')!.textContent=phaseChange?`${info.phaseName} · ${BOSS_PHASE_HINTS[m.boss!]}`:status+(move&&!arriving&&!(combat&&combat.exposedUntil>0)&&!b.away?` · ${move}`:'');root.dataset.exposed=String(!!combat&&combat.exposedUntil>0);root.dataset.arriving=String(arriving);root.setAttribute('aria-description',info.lesson);
}
