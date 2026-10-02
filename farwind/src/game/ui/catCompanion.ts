import { CAT_STAGES, catBenefits, catStage, catMemoryName } from '../systems/catBond';
import { count } from '../systems/state';
import type { Interface } from './interface';

export function showCatCompanion(ui: Interface, feedback = '') {
  const s = ui.state!, c = s.catBond, benefits = catBenefits(c.score), stage = catStage(c.score);
  const day = Math.floor(s.time / 1440), today = c.day === day;
  const reason = ui.actions.catCareReason?.() ?? '';
  const descriptions = [
    `正常随行时，体力恢复提高${Math.round(benefits.recovery * 100)}%；短暂落后保留宽限。`,
    `提示附近视野范围内的未发现宝箱、线索和未采集资源；循着小黑面朝的方向寻找。`,
    `真实连击终结或完美格挡后，小黑扑向敌人并留下爪印；主角下一次命中该敌人，伤害提高${Math.round(benefits.markBonus * 100)}%。印记保留5秒，支援冷却12秒。`,
    `受伤后生命不高于上限的30%时，获得相当于生命上限${benefits.shield}%的护盾，持续5秒；冷却60秒，冷却随存档保留。`,
  ];
  const next = CAT_STAGES[stage + 1];
  ui.shell('小黑 · 同行伙伴', `<div class="cat-companion-panel">
    <div class="cat-bond-heading"><img src="/assets/cat.png" alt="与你同行的小黑猫"><div><small>一起走过的路，都会留下回响</small><h2>${CAT_STAGES[stage].name}</h2><p>默契 ${c.score} / 100 · 已掌握 ${Math.min(stage + 1, 4)} 项能力</p></div></div>
    <progress aria-label="小黑默契度" max="100" value="${c.score}"></progress>
    <p class="cat-next">${next ? `再获得 ${next.score - c.score} 点默契，进入「${next.name}」并解锁${next.skill}。` : '心有灵犀 · 四项能力都已强化。'}</p>
    <div class="cat-abilities">${CAT_STAGES.slice(0, 4).map((a, i) => `<article class="cat-ability ${stage < i ? 'cat-locked' : ''}"><div><h3>${a.skill}</h3><span>${stage >= i ? '已掌握' : `默契 ${a.score} 解锁`}</span></div><p>${descriptions[i]}</p></article>`).join('')}</div>
    <section class="cat-care"><h3>相处一会儿</h3><p>每日摸猫 +2、分享浆果 +3、在旅馆共同休息 +2。探索新路段、首次击退敌人和发现秘密也会提升默契；练习与挂机不计入。</p><div class="cat-care-actions">
      <button id="cat-pet" ${reason || today && c.pet ? 'disabled' : ''}>${today && c.pet ? '今日已摸猫' : c.score===100?'摸摸小黑':'摸摸小黑 · +2'}</button>
      <button id="cat-feed" ${reason || today && c.feed || count(s, 'berry') < 1 || c.score === 100 ? 'disabled' : ''}>${today && c.feed ? '今日已分享' : '分享浆果 ×1 · +3'}</button>
    </div><p id="cat-care-feedback" role="status">${feedback || reason || (count(s, 'berry') < 1 ? '行囊里没有浆果，可以先摸摸小黑。' : '默契永久保留，离线和倒下都不会减少。')}</p></section>
    <p class="cat-recent">最近的共同经历：${c.last ? catMemoryName(c.last) : '旅途刚刚开始'}</p>
    <p class="muted">${ui.actions.catStatus?.() ?? ''}</p><button id="close">继续同行</button>
  </div>`);
  for (const kind of ['pet', 'feed'] as const) ui.button(`cat-${kind}`, async () => {
    if (ui.economyBusy || !ui.actions.catCare) return;
    ui.economyBusy = true;
    ui.modal.querySelectorAll<HTMLButtonElement>('button').forEach(button => button.disabled = true);
    ui.modal.querySelector('#cat-care-feedback')!.textContent = '正在记录你们的共同经历……';
    let result: string;
    try { await ui.actions.catCare(kind); result = kind === 'pet' ? '小黑蹭了蹭你的手，默契已保存。' : '小黑开心地吃下浆果，默契已保存。'; }
    catch (error) { result = error instanceof Error ? error.message : '相处记录尚未保存，请稍后再试。'; }
    finally { ui.economyBusy = false; }
    ui.open('cat', result);
  });
}
