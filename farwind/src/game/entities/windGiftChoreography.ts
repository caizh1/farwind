import type {GiftVisualId} from './windGiftArt';
export type GiftShape='crescent'|'spear'|'wing'|'curtain'|'focus'|'echo'|'charge'|'combo'|'pressure'|'plates'|'cushion'|'mirror'|'water'|'spring'|'repair'|'breath'|'trail'|'spiral'|'link'|'duality'|'growth'|'brackets'|'chain';
export type GiftRecipe={shape:GiftShape;count:number;width:number;spread:number;turn:number;material:number;delay:number;reach:number;inward:boolean};
// 每项编排对应重设计图的形体；组件是材质，运动由连续时间决定。
const r=(shape:GiftShape,count=2,width=1,spread=1,turn=1,material=0,delay=0,reach=1,inward=false):GiftRecipe=>({shape,count,width,spread,turn,material,delay,reach,inward});
export const GIFT_CHOREOGRAPHY={
 gale:r('crescent',3,.8,.85,.7,0),longEdge:r('spear',3,.45,.45,.2,1,0,1.65),broadWind:r('wing',3,1.2,1.45,.6,5),pierceCurtain:r('curtain',4,.7,1,.5,8),clearPath:r('spear',2,.6,.8,.2,22,0,1.3),focusWind:r('focus',3,.65,1,1,6,0,1,true),
 windRhythm:r('echo',3,.5,.6,.3,22,.13),echoWind:r('echo',2,.85,.8,.5,0,.24),stillWind:r('charge',3,1.1,.8,.5,1,0,1.2,true),roamEdge:r('trail',2,.6,.55,.8,18),borrowWind:r('echo',2,.8,1,-.7,8,.18),delayedEdge:r('curtain',3,.65,.7,-.5,6),
 blade:r('crescent',2,1,.8,1.3,2),chainedEdge:r('combo',2,.85,1,1.15,2,.14),catchEdge:r('combo',3,.6,.85,1.4,3,.1),guardStance:r('plates',2,.65,.8,-.4,9),stepEdge:r('combo',2,.9,.85,1.5,2,.15,1.25),heavyEdge:r('pressure',2,1.5,.6,.25,7),
 shock:r('pressure',3,1,1,.8,7),openGap:r('brackets',2,.5,.8,.2,8),aftershock:r('pressure',2,.75,1,.65,7,.28),finalBreath:r('breath',3,.5,.9,-1,19,0,1,true),suppressField:r('pressure',3,.65,.8,.1,10,.12),storedTurn:r('charge',2,.75,.7,-1,2,0,.75,true),
 armor:r('plates',4,.8,.8,.5,9),firstVeil:r('plates',6,.8,1.05,.7,9,.035),softenWound:r('cushion',2,1.25,1,.3,9),guardedBreath:r('cushion',2,.7,1,-.4,5),unyielding:r('plates',5,.8,.8,-.65,11),protectCompanion:r('plates',3,.9,1,.5,10),
 riposte:r('mirror',3,.7,1,1,8),poise:r('breath',2,.45,.8,-1,19,0,1,true),clearMirror:r('mirror',5,.65,.8,1.5,8),breakStance:r('mirror',4,.55,.85,-1,8),skimShadow:r('trail',3,.7,.9,1,18),residualWind:r('trail',3,.8,.85,.8,0),
 potion:r('water',4,.7,.8,-.8,12,0,1,true),spring:r('spring',5,.65,.9,1,15),drinkDew:r('water',2,.6,.55,-1,12,0,1,true),stopBleeding:r('repair',3,.5,.7,-.7,20,0,.8,true),lingeringGrace:r('plates',3,.7,.9,.5,10),breath:r('breath',2,.45,.75,.8,19,0,.8,true),
 stride:r('trail',2,.45,.6,.7,18),thrift:r('trail',3,.45,.5,-.8,18,0,.7,true),windBone:r('growth',4,.55,.7,.4,7),longBreath:r('breath',2,.65,.9,-.6,19,0,1.25,true),fullWind:r('wing',3,.6,.85,.5,10),escapeCircle:r('brackets',4,.65,1,.5,18),
 holdWind:r('curtain',4,.5,.65,-.4,6,0,.7,true),curledWind:r('spiral',3,.8,1,1.8,18,0,1,true),returningTide:r('spiral',2,.75,1,1,20),duet:r('combo',2,.8,.9,-1.3,2,.12),guidingEdge:r('brackets',2,.65,.8,1.2,22),duality:r('duality',2,1,1,1.8,4),
 sharedHeart:r('link',2,.55,.65,.6,19),relayEdge:r('link',2,.65,.8,1,19),returningBreath:r('link',2,.5,.7,-1,19,0,1,true),sideBySide:r('link',2,.8,.9,-.5,3),cyclicBreath:r('breath',2,.6,.8,1.5,19,0,1,true),chain:r('chain',2,.5,.9,.7,22,0,1,true),
 oneLineArmy:r('spear',4,.85,.8,.3,1,0,1.6),unbrokenWind:r('echo',3,.7,1,.6,0,.15,1.15),quietSky:r('charge',4,.8,1,1,1,0,1.3),hundredCuts:r('combo',3,.85,1.1,1.6,2,.1),mountainEcho:r('pressure',3,1.2,1.2,.6,7,.18),breathCycle:r('breath',3,.65,1,-1.4,19,0,1.2,true),
 riposteFormation:r('mirror',3,1.1,1.15,1.4,8,.06,1.4),borrowedBlade:r('echo',2,1,1,-.8,8,.24,1.2),armoredVeil:r('plates',6,.9,1.15,1.3,9),springGrace:r('spring',5,.8,1.1,.8,15),dewSpring:r('water',2,1,1,-1.4,14,0,1.2,true),shadowChase:r('combo',3,.7,1,1.7,2,.12,1.35),
 residualTide:r('spiral',3,.9,1.1,1.4,20,.12),windHunt:r('focus',4,.85,1.15,1.5,6,0,1.2,true),relayTogether:r('link',3,.85,1.1,1.3,19),guardedReturn:r('plates',3,.85,1,.7,10),bladeDance:r('duality',3,1,1.15,2.2,2,.08,1.3),dualityFlow:r('duality',2,.9,1.1,-1.6,4,0,1.1,true),
} as const satisfies Record<Exclude<GiftVisualId,'blackHole'>,GiftRecipe>;
export const GIFT_MATERIAL_URL=()=>`${import.meta.env.BASE_URL}assets/animation/wind-gifts/materials.webp`;
export type GiftMaterialStamp=(material:number,x:number,y:number,width:number,height:number,alpha:number,rotation:number,ground:boolean)=>void;
export const clamp=(v:number)=>Math.max(0,Math.min(1,v));
export const smooth=(v:number)=>{const t=clamp(v);return t*t*(3-2*t);};
// 时间轴无帧索引、无随机跳变；延迟组件使用同一光滑包络。
export function giftEnvelope(u:number,delay=0){const t=(u-delay)/(1-delay);return smooth(t/.12)*(1-smooth((t-.6)/.4));}
