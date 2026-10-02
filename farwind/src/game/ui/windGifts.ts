import {WIND_GIFTS,giftEffect,type WindGiftId} from '../systems/windGifts';
import type {Interface} from './interface';
export function showWindGifts(ui:Interface,feedback=''){
 const s=ui.state!;ui.mode='wind-gifts';const gifts=s.windGifts,pending=gifts.pending[0],saved=!pending||ui.actions.giftSaved?.(pending.receipt)!==false,choice=saved?pending:undefined;
 ui.shell('风赐 · 随旅人长存',`<p>最多六项，每项二级。死亡、回村与换方向均保留，不占符文槽。</p><details class="gift-owned" ${choice?'':'open'}><summary>当前持有 ${gifts.held.length}/6 项风赐 · 查看效果</summary><div class="gift-held">${gifts.held.map(g=>`<article><b>${WIND_GIFTS[g.id].name} · ${g.level}级</b><p>${WIND_GIFTS[g.id].effect}（每级）</p></article>`).join('')||'<p class="gift-empty">尚未持有风赐。清完整场即可选择。</p>'}</div></details>${choice?`<h2>整场胜利 · 三选一</h2><div class="gift-choices">${choice.candidates.map(id=>{const owned=gifts.held.find(g=>g.id===id);return `<article><h3>${WIND_GIFTS[id].name} · ${owned?'升级至二级':'一级'}</h3><p>${WIND_GIFTS[id].effect}（每级）</p>${!owned&&gifts.held.length===6?`<label>替换<select data-replace="${id}"><option value="">请选择被替换的风赐</option>${gifts.held.map(g=>`<option value="${g.id}">${WIND_GIFTS[g.id].name} ${g.level}级：${WIND_GIFTS[g.id].effect}</option>`).join('')}</select></label>`:''}<button data-gift="${id}">${owned?'升级':'选择'}</button></article>`;}).join('')}</div>`:pending?'<p>奖励已保留，候选保存成功后显示。</p><button id="gift-save">保存奖励并继续选择</button>':'<p>没有待选奖励。</p>'}<p id="gift-feedback" role="status">${feedback||'没有倒计时，可以稍后从手记继续领取。'}</p><button id="gift-close">继续旅途 · 保留待选</button>`);
 ui.button('gift-close',()=>ui.close(true));
 ui.modal.querySelectorAll<HTMLSelectElement>('[data-replace]').forEach(select=>{
  const preview=document.createElement('p'),id=select.dataset.replace as WindGiftId;
  preview.className='gift-replacement';select.parentElement!.after(preview);
  const update=()=>{const old=gifts.held.find(g=>g.id===select.value);preview.textContent=old?`替换前：${WIND_GIFTS[old.id].name} ${old.level}级，${giftEffect(old.id,old.level)}。替换后：${WIND_GIFTS[id].name} 1级，${giftEffect(id,1)}。`:`替换后：${WIND_GIFTS[id].name} 1级，${giftEffect(id,1)}。请选择要移除的风赐。`;};
  select.addEventListener('change',update);update();
 });
 if(pending&&!saved)ui.button('gift-save',async()=>{if(ui.economyBusy)return;ui.economyBusy=true;let message='候选已保存。';try{await ui.actions.save();}catch(error){message=(error as Error).message;}finally{ui.economyBusy=false;}showWindGifts(ui,message);});
 ui.modal.querySelectorAll<HTMLButtonElement>('[data-gift]').forEach(button=>button.addEventListener('click',async()=>{
  if(ui.economyBusy||!choice||!ui.actions.giftChoose)return;const id=button.dataset.gift as WindGiftId,replace=ui.modal.querySelector<HTMLSelectElement>(`[data-replace="${id}"]`)?.value as WindGiftId|undefined;
  if(gifts.held.length===6&&!gifts.held.some(g=>g.id===id)&&!replace){ui.modal.querySelector('#gift-feedback')!.textContent='请先指定替换项，原风赐在保存成功后才会替换。';return;}
  ui.economyBusy=true;ui.modal.querySelectorAll<HTMLButtonElement|HTMLSelectElement>('button,select').forEach(b=>b.disabled=true);ui.modal.querySelector('#gift-feedback')!.textContent='正在保存选择……';
  let message='风赐已保存并生效。';try{await ui.actions.giftChoose(choice.receipt,id,replace);}catch(error){message=(error as Error).message;}finally{ui.economyBusy=false;}showWindGifts(ui,message);
 }));
}
