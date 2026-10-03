import {describe,it,expect} from 'vitest';
import {GIFT_DEMOS,DEMO_INTRO,DEMO_ACTION_TIME,DEMO_CONTACT,demoSample,demoTimeline,demoEffect} from '../src/game/ui/windGiftDemo';
import {WIND_GIFTS,GIFT_RESONANCES,giftEffect} from '../src/game/systems/windGifts';
import type {GiftVisualId} from '../src/game/entities/windGiftArt';
describe('风赐主角教学时间轴',()=>{
 it('完整目录都有前置条件、主角行动和结果，收益晚于动作接触且留足观察时间',()=>{
  expect(Object.keys(GIFT_DEMOS).sort()).toEqual([...Object.keys(WIND_GIFTS),...Object.keys(GIFT_RESONANCES)].sort());
  for(const id of Object.keys(GIFT_DEMOS) as GiftVisualId[]){
   const plan=GIFT_DEMOS[id],t=demoTimeline(id);expect(plan.actions.length).toBeGreaterThan(0);expect(plan.setup).toMatch(/[\u4e00-\u9fff]/);expect(plan.result).toMatch(/[\u4e00-\u9fff]/);
   expect(demoSample(id,0).phase).toBe('prepare');expect(demoSample(id,t.effectAt-1).phase).not.toBe('result');expect(demoSample(id,t.effectAt).caption).toBe(plan.result);
   expect(t.contact).toBe(DEMO_INTRO+(plan.actions.length-1)*DEMO_ACTION_TIME+DEMO_CONTACT);expect(t.effectAt).toBeGreaterThanOrEqual(t.contact);expect(t.total-t.effectAt).toBeGreaterThanOrEqual(2500);
  }
 });
 it('条件次数、弹反接力、终结和混合顺序取自对应规则',()=>{
  expect(GIFT_DEMOS.windRhythm.actions).toEqual(['I','I','I']);expect(GIFT_DEMOS.echoWind.actions).toEqual(['I','I','I','I']);expect(GIFT_DEMOS.focusWind.actions).toEqual(['I','I','I']);
  expect(GIFT_DEMOS.riposte.actions).toEqual(['K','J']);expect(GIFT_DEMOS.borrowWind.actions).toEqual(['K','I']);expect(GIFT_DEMOS.shadowChase.actions).toEqual(['L','J']);
  expect(GIFT_DEMOS.relayEdge.actions).toEqual(['J','小宝']);expect(GIFT_DEMOS.sideBySide.actions).toEqual(['小宝','J']);expect(GIFT_DEMOS.bladeDance.actions).toEqual(['终结','I','J']);expect(GIFT_DEMOS.duality.actions).toEqual(['J','I','J']);
  expect(GIFT_DEMOS.aftershock.delay).toBe(300);expect(GIFT_DEMOS.echoWind.delay).toBe(160);expect(GIFT_DEMOS.oneLineArmy.enemies).toBeGreaterThanOrEqual(2);expect(GIFT_DEMOS.escapeCircle.enemies).toBeGreaterThanOrEqual(3);
  expect(GIFT_DEMOS.blackHole.setup).toContain('概率');expect(GIFT_DEMOS.spring.actions).toEqual(['清场']);
 });
 it('已获得等级与正式数值一致，共鸣沿用正式效果文字',()=>{
  expect(demoEffect('potion',4)).toBe(giftEffect('potion',4));expect(demoEffect('armor',25)).toContain('25%');expect(demoEffect('bladeDance')).toBe(GIFT_RESONANCES.bladeDance.effect);
 });
});
