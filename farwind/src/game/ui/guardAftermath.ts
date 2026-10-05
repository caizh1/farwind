import { GUARD_DEFS } from '../../data/defense';
import { GUARD_CARE, guardName, memorialName, currentMemorial, funeralTime, guardCareSnapshot } from '../systems/guardAftermath';
import { save } from '../systems/save';
import type { State } from '../systems/state';
import type { GuardMemorial } from '../systems/guardAftermath';
import type { World } from '../scenes/World';
const date = (time: number) => `第${Math.floor(time/1440)+1}日 ${String(Math.floor(time%1440/60)).padStart(2,'0')}:${String(Math.floor(time%60)).padStart(2,'0')}`;
const stage = (r: GuardMemorial) => r.arrivedAt !== null ? '已有新卫兵补岗' : r.recruitAt !== null ?
  `招募已登记；${date(r.recruitAt+GUARD_CARE.recruitMinutes)}起，村门和营房安全时到岗` : r.buriedAt !== null ? '已安葬，可招募补岗' :
  r.collectedAt !== null ? `已收殓；${date(funeralTime(r))}起，安全时举行悼念` : '等待战斗结束、营房可用，并连续安全12秒后收殓';
export function guardMemorialJournal(state: State) {
  const records = state.defense.memorials ?? [];
  if (!records.length) return '';
  return `<section aria-label="卫队纪念"><h2>卫队纪念</h2><p>纪念碑在风铃营房西南侧。招募可到营房门牌或室内守备地图办理。</p>${records.map(r=>
    `<p>${memorialName(r)} · ${r.legacy?'阵亡日期不详（旧档记录）':date(r.diedAt)+'阵亡'} · ${stage(r)}${r.flowers?' · 已献花':''}</p>`).join('')}</section>`;
}
export function openGuardCare(world: World, memorial = false) {
  world.ui.dialog(memorial?'卫队纪念碑':'风铃营房 · 卫队事务',
    memorial?'晨风会记住守护村庄的人。安葬后可从庭院取一束风铃花献给他们。':
      `四门卫队共十二个岗位。阵亡者安全后收殓，次日06:00起安全时举行悼念。\n安葬后招募新卫兵需要${GUARD_CARE.recruitCost}枚金币，等待${GUARD_CARE.recruitMinutes/60}个游戏小时；村门或营房仍有危险时延后报到。新卫兵从营房沿路返岗，原卫兵的纪念永久保留。`);
  const panel = document.createElement('section'); panel.className = 'guard-care';
  panel.setAttribute('aria-label','卫队名单与纪念记录');
  const roster=document.createElement('details');
  const summary=document.createElement('summary');summary.textContent=`在队卫兵（${world.state.defense.guards.filter(g=>!g.dead).length}/12）`;roster.append(summary);
  if (!memorial) for (const g of world.state.defense.guards) {
    const def = GUARD_DEFS.find(d=>d.id===g.id)!, r = currentMemorial(world.state.defense,g);
    const row = document.createElement('p');
    row.textContent = `${guardName(g)} · ${def.role==='archer'?'弓卫':'近战卫兵'} · ${g.dead?r?stage(r):'等待收殓登记':g.mode==='return'?'报到后前往岗位':`在队，生命${Math.ceil(g.hp)}/${def.maxHP}`}`;
    (g.dead||g.mode==='return'?panel:roster).append(row);
    if (g.dead && r?.buriedAt != null && r.recruitAt === null) button(`招募补充${memorialName(r)}的岗位（${GUARD_CARE.recruitCost}金币）`,'recruit',r.id);
  }
  const records = [...world.state.defense.memorials ?? []].reverse();
  const title = document.createElement('h2'); title.textContent = '永久纪念'; panel.append(title);
  if (!records.length) { const empty=document.createElement('p'); empty.textContent='尚无阵亡记录。'; panel.append(empty); }
  for (const r of records) {
    const row = document.createElement('p'); row.textContent = `${memorialName(r)} · ${r.legacy?'阵亡日期不详（旧档记录）':date(r.diedAt)+'阵亡'}\n${stage(r)}${r.flowers?' · 已献花':''}`; panel.append(row);
    if (r.buriedAt !== null && !r.flowers) button(`为${memorialName(r)}献一束庭院风铃花`,'flowers',r.id);
  }
  if(!memorial)panel.append(roster);
  world.ui.modal.querySelector('.dialog-copy')!.append(panel);
  function button(label: string, action: 'recruit'|'flowers', id: string) {
    const b = document.createElement('button'); b.textContent=label;
    b.onclick=async()=>{
      if(world.economy.busy||world.defenseSaving||world.defenseCheckpointPending||!world.active)return;
      const sequence=world.state.economyRevision+1;
      panel.querySelectorAll('button').forEach(b=>b.disabled=true);
      let writing=false;
      try {
        await world.economy.run(()=>world.state,s=>guardCareSnapshot(s,action,id,sequence),s=>{writing=true;return save(s);},next=>world.publishState(next));
        openGuardCare(world,memorial);
        world.ui.message(action==='recruit'?'招募已保存，等待新卫兵报到。':'风铃花已献上，纪念记录已保存。');
      } catch(error) {
        panel.querySelectorAll('button').forEach(b=>b.disabled=false);
        if(writing)world.ui.saveFailed(error);
        world.ui.message(error instanceof Error?error.message:'卫队事务保存失败，未扣款。');
      }
    };
    panel.append(b);
  }
}
