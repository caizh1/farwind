import { items, itemIcon, consumables, type ItemId } from '../../data/content';
import { equipment, isEquipment } from '../../data/economy';
import { count, craft, maxCraftQuantity } from '../systems/state';
import type { EconomyRequest } from '../systems/economy';
import type { Interface } from './interface';

const filters = { all: '全部', material: '材料', consumable: '消耗品', equipment: '装备' };
const category = (id: ItemId) => isEquipment(id) ? 'equipment' : consumables[id] ? 'consumable' : 'material';
const icon = (id: ItemId, cls = '') => `<img class="${cls}" src="${itemIcon(id)}" alt="">`;

export async function bagTrade(ui: Interface, request: EconomyRequest, success: string, focus = '') {
  if (ui.economyBusy || !ui.state || !ui.actions.canMutate()) return;
  ui.economyBusy = true;
  ui.modal.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement>('button,input,select').forEach(el => el.disabled = true);
  ui.modal.querySelector('#craft-feedback')!.textContent = '正在保存……';
  let result: string;
  try {
    await ui.actions.trade(request);
    result = success;
  } catch (error) {
    result = `操作未完成：${(error as Error).message}`;
  } finally { ui.economyBusy = false; }
  ui.open('bag', result);
  if (focus) ui.focusPanel(focus);
}

export function showBag(ui: Interface, feedback = '') {
  const s = ui.state!;
  const scrollTop = ui.modal.querySelector('.bag-panel')?.scrollTop ?? 0;
  if (!Object.hasOwn(filters, ui.bagFilter)) ui.bagFilter = 'all';
  const visible = s.bag.map((slot, index) => ({ slot, index })).filter(({ slot }) => ui.bagFilter === 'all' || (slot && category(slot.id) === ui.bagFilter));
  if (!visible.some(({ slot, index }) => slot && index === ui.bagSelectedSlot))
    ui.bagSelectedSlot = visible.find(({ slot }) => slot?.id === ui.selected)?.index ?? visible.find(({ slot }) => slot?.id === 'potion')?.index ?? visible.find(({ slot }) => slot)?.index ?? -1;
  const selected = s.bag[ui.bagSelectedSlot];
  ui.selected = selected?.id ?? null;
  const id = ui.selected;
  const max = maxCraftQuantity(s);
  ui.potionQuantity = Math.max(1, Math.min(ui.potionQuantity, max || 1));
  const equipmentSlot = id && isEquipment(id) ? equipment[id].slot : null;
  const usable = id && consumables[id];
  ui.shell('旅人的行囊', `<div class="bag-layout"><section class="bag-storage" aria-label="行囊物品"><div class="bag-heading"><div><h1 id="panel-title">旅人的行囊</h1><p>装下旅途的收获，也装下下一段远方。</p></div><div class="bag-meta"><span><img src="/assets/commission/coin.webp" alt="">金币 ${s.coins}</span><span>容量 ${s.bag.filter(Boolean).length} / 24</span></div></div><nav class="bag-filters" aria-label="物品分类">${Object.entries(filters).map(([key, name]) => `<button data-bag-filter="${key}" aria-pressed="${ui.bagFilter === key}">${icon(key === 'material' ? 'herb' : key === 'consumable' ? 'potion' : key === 'equipment' ? 'ironSword' : 'charm')}${name}</button>`).join('')}</nav><div class="bag">${visible.map(({ slot, index }) => `<button class="slot ${!slot ? 'empty' : ''}" data-slot="${index}" ${!slot ? 'disabled' : ''} aria-label="${slot ? `${items[slot.id].name}，${slot.count}件` : `空格 ${index + 1}`}" aria-pressed="${index === ui.bagSelectedSlot}">${slot ? `${icon(slot.id, 'item-icon')}<span>${items[slot.id].name}</span><strong>×${slot.count}</strong>` : ''}</button>`).join('')}</div>${!visible.length ? '<p class="bag-empty">还没有这一类物品。</p>' : ''}<div class="bag-storage-footer"><span>材料与消耗品每格 20 件 · 装备每格 1 件</span><nav aria-label="旅人物品页"><button id="bag-equipment">装备</button><button data-panel="runes">符文</button></nav></div></section><aside class="bag-sidebar"><section class="bag-detail" aria-label="物品详情"><h2 class="bag-section-heading">物品详情</h2>${id ? `<div class="bag-item-overview">${icon(id, 'bag-item-art')}<div><div class="bag-item-heading"><h2>${items[id].name}</h2><span>${filters[category(id)]}</span></div><p id="item-info">${items[id].description}</p><small>行囊共持有 ${count(s, id)} 件</small></div></div><div class="bag-item-actions">${usable ? '<button id="consume" class="bag-primary">使用一件</button><details class="bag-binding"><summary>加入快捷栏</summary><div><select id="bind" aria-label="快捷栏位置">' + Array.from({ length: 8 }, (_, i) => `<option value="${i}">${i + 1} · ${s.hotbar[i] ? items[s.hotbar[i]!].name : '空位'}</option>`).join('') + '</select><button id="bind-button">绑定</button></div></details>' : equipmentSlot ? `<button id="equip" class="bag-primary">穿戴装备</button>` : '<span class="bag-item-note">随身材料，可用于制作或旅途交付。</span>'}</div>${id !== 'crystal' ? '<button id="discard" class="bag-discard">丢弃一件</button><div id="discard-confirmation" class="bag-discard-confirmation" hidden><p>确定丢弃一件？</p><div><button id="discard-confirm">确认丢弃</button><button id="discard-cancel">取消</button></div></div>' : '<small class="bag-item-note">重要任务材料 · 不可丢弃</small>'}` : '<p id="item-info">选择一件物品，查看用途与随身操作。</p>'}</section><section class="bag-crafting" aria-label="旅途配药"><div class="bag-section-heading"><h2>旅途配药</h2><span>恢复药剂 · 每瓶恢复 50 生命</span></div><div class="bag-ingredients"><div>${icon('herb')}<span><strong>药草</strong><small>持有 ${count(s, 'herb')}</small></span></div><div>${icon('berry')}<span><strong>浆果</strong><small>持有 ${count(s, 'berry')}</small></span></div></div><p class="bag-recipe">配方：药草 ×2 + 浆果 ×1 = 恢复药剂 ×1</p><div class="bag-quantity"><button id="craft-minus" aria-label="减少制作数量">−</button><input id="craft-quantity" type="number" min="1" max="${max || 1}" step="1" value="${ui.potionQuantity}" aria-label="制作数量" ${!max ? 'disabled' : ''}><button id="craft-plus" aria-label="增加制作数量">+</button><button id="craft-max">最大 ${max}</button></div><div class="bag-cost" id="craft-cost"></div><button id="craft" class="bag-primary">制作 ${ui.potionQuantity} 瓶</button><p id="craft-feedback" role="status" aria-live="polite"></p></section></aside></div><footer class="bag-footer"><button id="close"><kbd>Esc</kbd> 收好行囊</button></footer>`);
  const panel = ui.modal.querySelector('.panel')!;
  panel.classList.add('bag-panel');
  panel.querySelector(':scope > header')!.remove();
  ui.modal.classList.add('bag-modal');
  ui.modal.querySelector('#craft-feedback')!.textContent = feedback;
  const input = ui.modal.querySelector<HTMLInputElement>('#craft-quantity')!;
  const refreshQuantity = () => {
    const q = input.valueAsNumber;
    const valid = Number.isSafeInteger(q) && q >= 1 && q <= max;
    const fits = valid && craft({ ...s }, q);
    if (valid) ui.potionQuantity = q;
    ui.modal.querySelector<HTMLButtonElement>('#craft')!.disabled = !fits;
    ui.modal.querySelector('#craft')!.textContent = !max ? '暂时无法制作' : `制作 ${valid ? q : '—'} 瓶`;
    ui.modal.querySelector('#craft-cost')!.innerHTML = !max ? (count(s, 'herb') < 2 || count(s, 'berry') < 1 ? '材料不足，采集药草与浆果后再来配药。' : '成品空间不足，请先腾出行囊格子。') : !valid ? `请输入 1～${max} 的整数。` : !fits ? '本批成品放不下；可尝试最大数量，消耗材料后会腾出格子。' : `<span>需要材料</span>${icon('herb')}<span>药草 ×${q * 2}</span>${icon('berry')}<span>浆果 ×${q}</span>`;
    ui.modal.querySelector<HTMLButtonElement>('#craft-minus')!.disabled = !max || (valid && q <= 1);
    ui.modal.querySelector<HTMLButtonElement>('#craft-plus')!.disabled = !max || (valid && q >= max);
    ui.modal.querySelector<HTMLButtonElement>('#craft-max')!.disabled = !max;
  };
  input.oninput = refreshQuantity;
  const setQuantity = (quantity: number) => { input.value = String(Math.max(1, Math.min(max || 1, quantity))); refreshQuantity(); };
  ui.button('craft-minus', () => setQuantity(ui.potionQuantity - 1));
  ui.button('craft-plus', () => setQuantity(ui.potionQuantity + 1));
  ui.button('craft-max', () => setQuantity(max));
  ui.button('craft', () => void ui.makePotion());
  refreshQuantity();
  ui.modal.querySelectorAll<HTMLButtonElement>('[data-slot]').forEach(button => button.onclick = () => {
    ui.bagSelectedSlot = Number(button.dataset.slot);
    ui.open('bag');
    ui.modal.querySelector<HTMLButtonElement>(`[data-slot="${ui.bagSelectedSlot}"]`)?.focus({ preventScroll: true });
  });
  ui.modal.querySelectorAll<HTMLButtonElement>('[data-bag-filter]').forEach(button => button.onclick = () => {
    ui.bagFilter = button.dataset.bagFilter!;
    ui.open('bag');
    ui.modal.querySelector<HTMLButtonElement>(`[data-bag-filter="${ui.bagFilter}"]`)?.focus({ preventScroll: true });
  });
  const request = (body: Omit<Extract<EconomyRequest, { kind: 'consume' | 'discard' }>, 'sequence'> | { kind: 'bind'; item: ItemId; slot: number } | { kind: 'equip'; item: ItemId; slot: NonNullable<typeof equipmentSlot> }, success: string, focus = '') => void bagTrade(ui, { ...body, sequence: ui.state!.economyRevision + 1 } as EconomyRequest, success, focus);
  ui.button('bag-equipment', () => ui.open('equipment'));
  if (id) {
    ui.button('consume', () => request({ kind: 'consume', item: id }, `${items[id].name}已使用并保存。`, 'consume'));
    ui.button('equip', () => { if (equipmentSlot) request({ kind: 'equip', slot: equipmentSlot, item: id }, '装备已更新并保存。'); });
    ui.button('bind-button', () => request({ kind: 'bind', item: id, slot: Number(ui.modal.querySelector<HTMLSelectElement>('#bind')!.value) }, '快捷栏已绑定并保存。'));
    ui.button('discard', () => {
      const confirmation = ui.modal.querySelector<HTMLElement>('#discard-confirmation')!;
      confirmation.hidden = false;
      confirmation.querySelector('p')!.textContent = `确定丢弃一件${items[id].name}？`;
      ui.focusPanel('discard-cancel');
    });
    ui.button('discard-cancel', () => { ui.modal.querySelector<HTMLElement>('#discard-confirmation')!.hidden = true; ui.focusPanel('discard'); });
    ui.button('discard-confirm', () => request({ kind: 'discard', item: id }, '已丢弃一件并保存。'));
  }
  panel.scrollTop = scrollTop;
}
