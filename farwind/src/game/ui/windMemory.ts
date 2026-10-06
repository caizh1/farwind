import {windMemoryTracked,memoryStrength,memoryCoins} from '../systems/windMemory';
import type {WindMemoryDifficulty} from '../../data/windMemoryDifficulty';
import {ADVENTURE_ROUTES,ENCOUNTERS,waveMembers,type WildernessDirection} from '../../data/maps/windbell/encounters';
import type {Interface} from './interface';
const names={south:'南路',west:'西路',north:'北路',east:'东路'};
const percent=(scale:number)=>`${Math.round((scale-1)*100)}%`;
function strengthDescription(difficulty:WindMemoryDifficulty){
 const ordinary=memoryStrength(difficulty),strong=memoryStrength(difficulty,true);
 return `<table class="memory-stats"><thead><tr><th>强化</th><th>普通</th><th>精英 / 首领</th></tr></thead><tbody>${([['生命','health'],['伤害','damage'],['出手','attack'],['频率','frequency'],['移速','movement']] as const).map(([label,key])=>`<tr><th>${label}</th><td>+${percent(ordinary[key])}</td><td>+${percent(strong[key])}</td></tr>`).join('')}</tbody></table>`;
}
function population(direction:WildernessDirection,level:number){
 return ADVENTURE_ROUTES[direction].map(id=>{const d=ENCOUNTERS.find(d=>d.id===id)!;return waveMembers(d,0,2,level).filter(m=>!m.boss).length;}).join(' / ');
}
function rewards(difficulty?:WindMemoryDifficulty){return `${memoryCoins(4,difficulty)} / ${memoryCoins(8,difficulty)} / ${memoryCoins(16,difficulty)}`;}
function preview(direction:WildernessDirection,difficulty?:WindMemoryDifficulty){
 const power=memoryStrength(difficulty);
 return `<div class="memory-power"><span>生命 <b>+${percent(power.health)}</b></span><span>伤害 <b>+${percent(power.damage)}</b></span></div><div class="memory-values"><span>五处人数</span><b>${population(direction,difficulty?.level??0)}</b><span>场次金币</span><b>${rewards(difficulty)}</b></div>`;
}
export function showWindMemory(ui:Interface,feedback=''){
 const s=ui.state!,active=s.windMemory.active,target=windMemoryTracked(s),difficulty=active?.encounters.memoryDifficulty;ui.mode='wind-memory';
 const routes=(Object.entries(ADVENTURE_ROUTES) as [WildernessDirection,readonly string[]][]).map(([direction,route])=>{
  const camp=ENCOUNTERS.find(d=>d.id===route[4])!,cleared=s.encounters.groups[camp.id].cleared,near=Math.hypot(s.player.x-camp.x,s.player.y-camp.y)<=camp.radius+80,next={version:1,level:s.windMemory.counts[direction]+1} as const;
  return `<article><h2>${names[direction]} <small>下一档 · ${next.level}</small></h2>${preview(direction,next)}<details><summary>强化与路线</summary>${strengthDescription(next)}<small>人数含补援；金币：普通 / 精英 / 首领。</small><ol>${route.map(id=>{const d=ENCOUNTERS.find(d=>d.id===id)!,g=active?.direction===direction?active.encounters.groups[id]:s.encounters.groups[id];return `<li>${d.name} · ${g.cleared?'已完成':g.rewarded?'驻守已清':g.activated?`第${(g.wave??0)+1}波`:'待探索'}</li>`;}).join('')}</ol></details><button data-memory="${direction}" ${!cleared||!near||active&&!active.finished?'disabled':''}>${cleared?near?`开启第 ${next.level} 档`:'前往据点':'清剿后解锁'}</button></article>`;
 }).join('');
 ui.shell('风忆远征',`<div class="memory-content">${active?`<article class="memory-current"><div class="memory-heading"><h2>${names[active.direction]} · ${difficulty?`第 ${difficulty.level} 档`:'旧档'} <small>${active.finished?'已完成':'进行中'}</small></h2><button id="memory-end">${active.finished?'结束远征':'结束本次'}</button></div>${target?`<p class="memory-target">目标：<b>${target.point.name}</b> <small>M 地图</small></p>`:''}${preview(active.direction,difficulty)}<details><summary>强化详情 · 已结算 ${active.receipts.length}/6</summary>${difficulty?strengthDescription(difficulty):'<small>本次保留原强度。</small>'}<small>人数含补援；金币：普通 / 精英 / 首领。</small></details></article><details class="memory-other"><summary>四方远征</summary><div class="memory-routes">${routes}</div></details>`:`<p class="memory-note">每次开启，怪物更强。</p><div class="memory-routes">${routes}</div>`}${feedback?`<p class="memory-feedback" role="status">${feedback}</p>`:''}<button id="memory-close">继续旅途</button></div>`);
 ui.modal.querySelector('.panel')!.classList.add('memory-panel');
 ui.button('memory-close',()=>ui.close(true));
 const run=async(direction?:WildernessDirection)=>{if(ui.economyBusy)return;ui.economyBusy=true;ui.modal.querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.disabled=true);let message='进度已保存。';try{if(direction)await ui.actions.memoryStart?.(direction);else await ui.actions.memoryEnd?.();}catch(e){message=(e as Error).message;}finally{ui.economyBusy=false;}showWindMemory(ui,message);};
 ui.button('memory-end',()=>void run());ui.modal.querySelectorAll<HTMLButtonElement>('[data-memory]').forEach(b=>b.addEventListener('click',()=>void run(b.dataset.memory as WildernessDirection)));
}
