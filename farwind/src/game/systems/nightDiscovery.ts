import {NIGHT_DISCOVERY as D} from "../../data/dayNight";
import {phaseAt} from "./worldClock";
import {motionBlocked,clearMotionLine} from "./obstacles";
import {add,validate,type State} from "./state";
export function canDiscover(s:State){return s.life.playerSpace==="village"&&!s.night.discovered&&phaseAt(s.time)==="night"&&Math.hypot(s.player.x-D.x,s.player.y-D.y)<D.radius&&!motionBlocked(D.x,D.y)&&clearMotionLine(s.player,D);}
export function discoverySnapshot(s:State){
  if(!canDiscover(s))throw Error("临水夜风只能在夜间靠近草坡时聆听。");
  const next=validate(s);if(!add(next,"potion",1))throw Error("行囊已满，请腾出空间；夜风仍在等你。");
  next.night.discovered=true;return validate(next);
}
