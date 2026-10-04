import type {World} from '../scenes/World';
import type {Prop} from '../../data/world';
import {CITY_STOCK,CITY_PRICES,CITY_SERVICES} from '../../data/maps/windwhisper';
import {items} from '../../data/content';
import {add,validate,type State} from './state';
import {save} from './save';
import {playerVitals} from './journeyTraining';
import {renewTradeRoad} from './tradeRoadState';
import {randomSeed} from './windGifts';
// 普通商馆、工坊只在七点到二十点办理；驿站、茶馆和药坊的急救补给通宵。
export function cityBusinessOpen(s:State){const minute=s.time%1440;return minute>=420&&minute<1200;}
export function cityCounterPurchase(s:State,item:keyof typeof CITY_STOCK){
 const space=s.life.playerSpace,goods=space==='city:market'?Object.keys(CITY_STOCK):space==='city:clinic'?['potion','herb','berry']:space==='city:inn'||space==='city:tea'?['bread','tea','potion']:[];
 if(!goods.includes(item))throw Error('请到经营这件商品的柜台办理。');
 if(space==='city:market'&&!cityBusinessOpen(s))throw Error('商馆七点至二十点营业，夜间可到驿站、茶馆或药坊补给。');
 return cityPurchase(s,item);
}
export function cityPurchase(s:State,item:keyof typeof CITY_STOCK){
  const next=validate(s),price=CITY_PRICES[item];if(!Object.hasOwn(CITY_STOCK,item))throw Error('补给商品无效。');
  if(next.city.stock[item]<1)throw Error('这一趟补给已售罄。');if(next.coins<price)throw Error('金币不足，未扣款。');if(!add(next,item,1))throw Error('行囊已满，未扣款。');next.coins-=price;next.city.stock[item]--;next.economyRevision++;return validate(next);
}
export async function restCityRoad(w:World){
  try{const safety=w.sleepSafety();if(safety.action||safety.threat||safety.projectile||safety.conflict||w.cityDefense?.arrows.length)throw Error('附近仍有交战，请先脱离危险再休整。');
    w.tradeRoad?.capture();await w.economy.run(()=>w.state,s=>{const next=validate(s);renewTradeRoad(next,randomSeed());const vitals=playerVitals(next);next.player.hp=vitals.maxHp;next.player.stamina=vitals.maxStamina;return next;},save,next=>w.publishState(next));
    w.tradeRoad?.releaseAll();w.afterSleep();w.ui.close(true);w.ui.message('已明确休整：商路重新排布；风赐、待领候选和城内库存保留。');
  }catch(e){w.ui.message((e as Error).message);}
}
export function cityInteraction(w:World,p:Prop){
  if(p.id==='road-rest-west'||p.id==='road-rest-east'||p.id==='city-person-innkeeper'){
    w.ui.mode='city-service';w.ui.shell('候风驿站','<p>恢复生命与体力，重新安排六段商路遭遇。已经获得的永久风赐和待领候选保留。往返或交谈不会重排。</p><p>休整不会补回已售出的库存。</p><button id="city-rest">确认休整商路</button><button id="close">继续赶路</button>');w.ui.button('city-rest',()=>void restCityRoad(w));w.ui.button('close',()=>w.ui.close(true));return true;
  }
  if(p.id==='city-person-merchant'){
    const show=()=>{w.ui.mode='city-service';w.ui.shell('城西补给铺',`<p>风语城独立库存，购买保存成功后才扣款并入袋。</p><div class="city-stock">${Object.keys(CITY_STOCK).map(k=>{const item=k as keyof typeof CITY_STOCK;return `<p>${items[item].name} · ${CITY_PRICES[item]}金币 · 库存 ${w.state.city.stock[item]} <button id="city-buy-${item}">购买一份</button></p>`;}).join('')}</div><button id="close">收起补给</button>`);w.ui.button('close',()=>w.ui.close(true));for(const item of Object.keys(CITY_STOCK) as (keyof typeof CITY_STOCK)[])w.ui.button('city-buy-'+item,()=>{void w.economy.run(()=>w.state,s=>cityPurchase(s,item),save,next=>w.publishState(next)).then(()=>{show();w.ui.message('补给已保存并放入行囊。');}).catch(e=>w.ui.message(e.message));});};show();return true;
  }
  const service=CITY_SERVICES.find(n=>n.id===p.id);if(service){w.ui.dialog(service.name,p.id.endsWith('captain')?'四名近卫在门外拦截，六名弓卫掩护，八名巡逻卫与六名内城岗哨轮值。敌人不会凭空消失，请给正在交战的卫队留下空间。城门自由通行。':'中央风塔记着这座城的风。西侧是集市与驿站，东南是居民区，东北是议事与档案区。议事厅办理城案登记后，可以调查档案、维护地下风阀，再进入风塔挑战。');return true;}
  if(p.id.startsWith('city-building-')||p.id==='city-underground'){w.ui.dialog(p.label??'风语城',p.id.includes('inn')?'驿站服务在门前接待处。请到实际房门旁进入。':p.id.includes('market')?'补给商在铺前接待。请到实际房门旁进入。':'本城公共设施及十二处住宅均已登记门点；住宅先敲门拜访。');return true;}
  if(p.id==='road-entry-sign'){w.ui.dialog('林间商路','往东经过密林、溪谷与石桥，抵达风语城西门。六段道路的怪物依次增强；你可以绕行，不需要清理才能进城。');return true;}return false;
}
