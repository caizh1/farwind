import {giftEffect, WIND_GIFTS, GIFT_RESONANCES, type WindGiftId} from '../systems/windGifts';
import type {GiftVisualId} from '../entities/windGiftArt';

export type DemoAction = 'I' | 'J' | '终结' | 'K' | 'L' | '移动' | '药剂' | '受击' | '等待' | '小宝' | '清场';
type Demo = {setup:string; actions:DemoAction[]; result:string; target:'hero'|'enemy'|'companion'|'path'; enemies:number; delay:number};
const demo=(setup:string,actions:DemoAction[],result:string,target:Demo['target']='enemy',enemies=1,delay=0):Demo=>({setup,actions,result,target,enemies,delay});
// 每项先演出真实前置条件，再演出收益；次数与顺序不能用通用粒子动画代替。
export const GIFT_DEMOS = {
 blade:demo('面对近处敌人',['J'],'剑锋强化 · 近战伤害提高'),
 gale:demo('面对远处敌人',['I'],'剑风命中 · 远程伤害提高'),
 blackHole:demo('I施放有概率触发；此处展示触发成功的情况',['I'],'裂缝牵引普通敌人并持续伤害','enemy',3),
 shock:demo('完成连段，准备终结',['J','J','终结'],'终结命中 · 周围敌人受到冲击','enemy',3),
 chain:demo('目标身边还有两名敌人',['J'],'命中后附伤依次跳向另两名敌人','enemy',3),
 stride:demo('向右移动',['移动'],'脚下流风 · 移动更快','path'),
 thrift:demo('准备风步',['L'],'完成风步 · 体力消耗减少','path'),
 breath:demo('体力已经消耗',['等待'],'停止消耗 · 体力恢复更快','hero'),
 armor:demo('敌人即将攻击主角',['受击'],'攻击落在风甲上 · 生命损失减少','hero'),
 potion:demo('主角生命未满',['药剂'],'使用恢复药剂 · 治疗量提高','hero'),
 spring:demo('最后一名敌人即将被击败',['清场'],'整场遭遇结束 · 恢复生命','hero'),
 poise:demo('敌人攻击接近',['K'],'成功弹反 · 恢复体力','hero'),
 riposte:demo('先挡住来袭攻击，再挥剑反击',['K','J'],'强化反击 · 扇形剑气击中前方敌人','enemy',3),
 windBone:demo('被动风赐，获得后常驻',['等待'],'最大生命增加','hero'),
 longBreath:demo('被动风赐，获得后常驻',['等待'],'最大体力增加','hero'),
 fullWind:demo('主角生命至少80%',['J'],'高生命状态 · 原生攻击增伤'),
 longEdge:demo('敌人站在更远的位置',['I'],'剑风飞得更远 · 远处目标被命中'),
 broadWind:demo('两名敌人错开站位',['I'],'剑风变宽 · 覆盖两侧目标','enemy',2),
 pierceCurtain:demo('已解锁双穿，敌人排成一线',['I'],'穿过第一名敌人 · 后续目标伤害提高','enemy',2),
 clearPath:demo('瞄准远程或支援敌人',['I'],'剑风命中优先目标 · 额外增伤'),
 windRhythm:demo('连续I，间隔不超过1秒',['I','I','I'],'第三次I · 收招更快'),
 echoWind:demo('连续施放四次I',['I','I','I','I'],'第四次I之后 · 追加回声剑风','enemy',1,160),
 stillWind:demo('至少1.2秒没有施放I',['等待','I'],'蓄势后的第一道剑风 · 伤害提高'),
 focusWind:demo('2秒内连续命中同一目标',['I','I','I'],'第三次命中 · 聚焦增伤'),
 roamEdge:demo('先用I命中目标',['I','移动'],'命中后的一秒 · 移动更快','path'),
 chainedEdge:demo('连续近战挥剑',['J','J'],'第二段起 · 近战伤害提高'),
 catchEdge:demo('第一刀后保持衔接',['J','J'],'衔接窗口延长 · 更容易接上下一刀'),
 guardStance:demo('连段期间敌人发起攻击',['J','J'],'第二段起的攻击期间 · 受伤减少','hero'),
 stepEdge:demo('先风步，再接近战',['L','J'],'风步后三秒内 · 下一刀强化'),
 heavyEdge:demo('完成连段，准备终结',['J','J','终结'],'重刃终结 · 伤害提高'),
 openGap:demo('终结后继续命中同一目标',['终结','J'],'消耗终结标记 · 下一击增伤'),
 aftershock:demo('完成连段，准备终结',['J','J','终结'],'终结命中300毫秒后 · 余震冲击','enemy',3,300),
 finalBreath:demo('体力已消耗，终结需要实际命中',['终结'],'终结命中 · 体力返还','hero'),
 firstVeil:demo('敌人即将击中主角',['受击'],'受击前生成护盾 · 护盾吸收伤害','hero'),
 softenWound:demo('来袭伤害达到最大生命20%',['受击'],'大伤害触发缓创 · 伤害被削弱','hero'),
 guardedBreath:demo('体力至少一半',['受击'],'体力充足 · 受伤减少','hero'),
 unyielding:demo('生命已经不超过30%',['受击'],'低生命触发不屈 · 受伤减少','hero'),
 clearMirror:demo('在精准窗口内架剑',['K'],'精准弹反 · 判定窗口更宽','hero'),
 breakStance:demo('在精准窗口内挡住普通敌人',['K'],'精准弹反 · 敌人失衡更久'),
 borrowWind:demo('先弹反，再施放I',['K','I'],'三秒内的下一次I · 借风增伤'),
 drinkDew:demo('主角生命未满',['J'],'实际命中 · 翠露回流恢复生命','hero'),
 stopBleeding:demo('主角受到生命伤害',['受击','等待'],'受伤后四秒 · 持续恢复生命','hero'),
 lingeringGrace:demo('使用药剂，治疗超出缺失生命',['药剂'],'溢出治疗 · 转化为护盾','hero'),
 skimShadow:demo('用风步无敌帧躲过来袭攻击',['L','J'],'实际躲避后 · 下一次攻击强化'),
 residualWind:demo('敌人位于风步路径上',['L'],'穿过敌人 · 路径造成伤害','path',2),
 escapeCircle:demo('风步起点附近至少三名敌人',['L','移动'],'成功脱围 · 两秒走速提高','path',3),
 holdWind:demo('用I命中敌人',['I'],'目标被定风包裹 · 移动减速'),
 curledWind:demo('连续三次I实际命中',['I','I','I'],'第三次命中 · 附近敌人向中心聚拢','enemy',3),
 suppressField:demo('面对普通敌人，完成近战终结',['终结'],'终结命中 · 敌人额外失衡'),
 returningTide:demo('风步落地',['L'],'落点留下风潮 · 进入的敌人减速','path',2),
 delayedEdge:demo('目标已被风赐减速',['I','J'],'命中受控目标 · 原生伤害提高'),
 sharedHeart:demo('小宝在场并参与同行战斗',['J'],'主角与伙伴同行 · 原生伤害提高'),
 protectCompanion:demo('敌人正在攻击小宝',['J'],'命中威胁小宝的敌人 · 为小宝加盾','companion'),
 relayEdge:demo('主角先标记目标，小宝接力',['J','小宝'],'伙伴消耗标记 · 这一击增伤'),
 returningBreath:demo('主角体力未满，小宝在场',['小宝'],'伙伴实际命中 · 主角恢复体力','hero'),
 sideBySide:demo('小宝先命中，主角接力',['小宝','J'],'主角消耗伙伴标记 · 这一击增伤'),
 duet:demo('两秒内对同一目标交替J与I',['J','I'],'交替命中 · 伤害提高'),
 storedTurn:demo('终结后，在三秒内接I',['终结','I'],'消耗终结蓄势 · I伤害提高'),
 guidingEdge:demo('I先标记目标，再接第一段J',['I','J'],'近战消耗剑风标记 · 第一刀强化'),
 cyclicBreath:demo('两秒内对同一目标交替J与I',['J','I'],'交替命中 · 体力恢复','hero'),
 duality:demo('三秒内对同一目标完成J／I／J',['J','I','J'],'两仪成立 · 周围敌人受到冲击','enemy',3),
 oneLineArmy:demo('一发I至少贯穿两名敌人',['I'],'末目标触发破军 · 追加伤害','enemy',2),
 unbrokenWind:demo('先打出回声，再继续I',['I','I','I','I','I'],'回声命中后 · 下一次I强化'),
 quietSky:demo('蓄势或聚焦强化I命中后再追击',['等待','I','J'],'消耗强化标记 · 追加伤害'),
 hundredCuts:demo('同一连段前两刀都命中',['J','J','终结'],'第三刀终结 · 追加伤害'),
 mountainEcho:demo('完成连段，以重刃终结',['J','J','终结'],'余震范围扩大 · 追加冲击','enemy',3,300),
 breathCycle:demo('终结命中并返还体力',['终结','等待'],'返还体力后 · 恢复速度短暂提高','hero'),
 riposteFormation:demo('先精准弹反，再挥剑反击',['K','J'],'回锋剑气成阵 · 追加伤害','enemy',3),
 borrowedBlade:demo('精准弹反后施放强化I',['K','I'],'强化剑风之后 · 追加回声','enemy',1,160),
 armoredVeil:demo('初幕护盾已存在，来袭攻击将击破它',['受击'],'护盾破碎 · 向外释放伤害冲击','hero',3),
 springGrace:demo('最后一敌将倒下，生命接近满值',['清场'],'整场结束 · 溢出回血转为护盾','hero'),
 dewSpring:demo('受伤触发止血，再攻击敌人',['受击','J'],'止血期间命中 · 饮露治疗提高','hero'),
 shadowChase:demo('风步实际躲过攻击，再挥剑',['L','J'],'强化追斩命中 · 追加剑气'),
 residualTide:demo('用风步经过敌人并落地',['L'],'落点风潮300毫秒后 · 追加伤害','path',2,300),
 windHunt:demo('三次I命中，牵引已减速的敌人',['I','I','I'],'减速与牵引成立 · 追加猎刃伤害','enemy',3),
 relayTogether:demo('主角标记，小宝接力，再由主角出剑',['J','小宝','J'],'伙伴消耗递锋后 · 主角追加伤害'),
 guardedReturn:demo('攻击威胁小宝的敌人，再由小宝命中',['J','小宝'],'小宝在护盾中命中 · 自身恢复生命','companion'),
 bladeDance:demo('三秒内同一目标完成终结／I／J',['终结','I','J'],'第三次命中 · 追加轮舞剑气'),
 dualityFlow:demo('三秒内同一目标完成J／I／J',['J','I','J'],'两仪冲击命中 · 恢复体力并获得护盾','hero',3),
} satisfies Record<GiftVisualId,Demo>;

export const DEMO_INTRO=850, DEMO_ACTION_TIME=760, DEMO_CONTACT=350;
export function demoTimeline(id:GiftVisualId){
 const plan=GIFT_DEMOS[id];
 const contact=DEMO_INTRO+(plan.actions.length-1)*DEMO_ACTION_TIME+DEMO_CONTACT;
 const effectAt=contact+plan.delay;
 return {contact,effectAt,total:Math.max(DEMO_INTRO+plan.actions.length*DEMO_ACTION_TIME,effectAt+ (id==='blackHole'?2400:1500))+1200};
}
export function demoSample(id:GiftVisualId,age:number){
 const plan=GIFT_DEMOS[id],timeline=demoTimeline(id),elapsed=age-DEMO_INTRO,index=Math.floor(elapsed/DEMO_ACTION_TIME);
 const action=index>=0&&index<plan.actions.length?plan.actions[index]:undefined;
 const local=action?elapsed-index*DEMO_ACTION_TIME:0;
 const phase=age<DEMO_INTRO?'prepare':age<timeline.effectAt?'action':'result';
 const caption=phase==='prepare'?plan.setup:phase==='result'?plan.result:`${index+1} / ${plan.actions.length} · ${action==='I'?'I 施放剑风':action==='J'?'J 近战挥剑':action==='终结'?'J 近战终结':action==='K'?'K 架剑弹反':action==='L'?'L 风步闪避':action==='移动'?'方向键 · 移动':action==='药剂'?'使用恢复药剂':action==='受击'?'来袭攻击接触':action==='小宝'?'小宝接力攻击':action==='清场'?'击败最后一敌':'等待被动生效'}`;
 return {plan,...timeline,action,index,local,phase,caption};
}
export function demoEffect(id:GiftVisualId,level=1){return Object.hasOwn(WIND_GIFTS,id)?giftEffect(id as WindGiftId,level):GIFT_RESONANCES[id as keyof typeof GIFT_RESONANCES].effect;}
