import type {RuneCombat,RuneFx} from '../systems/runeCombat';
import type {Point} from '../systems/obstacles';
import {GIFT_RESONANCES} from '../systems/windGiftCatalog';
import {WIND_GIFT_ART,giftVisualId,type GiftVisualId,type GiftMotion} from './windGiftArt';
export const giftAtlasUrl=(sheet:string)=>`${import.meta.env.BASE_URL}assets/animation/wind-gifts/${sheet}.webp`;
export type GiftStamp=(motion:GiftMotion,frame:number,x:number,y:number,width:number,height:number,alpha:number,rotation:number,ground:boolean)=>void;
const priority=(id:GiftVisualId)=>Object.hasOwn(GIFT_RESONANCES,id)?3:/^(blade|gale|shock|chain|riposte|echoWind|aftershock|curledWind|duality|firstVeil)$/.test(id)?2:/^(fullWind|sharedHeart|breath|stride|roamEdge)$/.test(id)?0:1;
// 所有美术只消费已成立的战斗事件；合并重复并限制同刻演出，防止满目录遮挡战场。
export function playGiftFx(engine:RuneCombat,id:GiftVisualId,point:Point,extra:Partial<RuneFx>={}){
 if(id==='blackHole')return;
 const visual='gift:'+id,live=engine.effects.filter(f=>giftVisualId(f.visual)&&engine.now>=f.born&&engine.now<f.born+f.life);
 if(live.some(f=>f.visual===visual&&f.giftPhase===extra.giftPhase&&engine.now-f.born<180&&Math.hypot(f.point.x-point.x,f.point.y-point.y)<(id==='chain'?1:55)&&(id!=='chain'||Math.hypot((f.end?.x??0)-(extra.end?.x??0),(f.end?.y??0)-(extra.end?.y??0))<1)))return;
 const recent=live.filter(f=>engine.now-f.born<100);
 if(recent.length>=4){const replace=recent.filter(f=>priority(giftVisualId(f.visual)!)<priority(id)).sort((a,b)=>priority(giftVisualId(a.visual)!)-priority(giftVisualId(b.visual)!))[0];if(!replace)return;engine.effects=engine.effects.filter(f=>f.id!==replace.id);}
 if(live.length>=18){const oldest=live[0]!;engine.effects=engine.effects.filter(f=>f.id!==oldest.id);}
 const art=WIND_GIFT_ART[id];engine.fx(visual,point,art.size,'',art.life,extra);
}
export {paintWindGiftFx} from './windGiftMotion';
