import {ARENA_STONES,type ArenaStoneId} from '../../data/maps/windbell/elites';
import {FOOT} from '../../data/world';
import {rectInterval,clearMeleeLine,type Point} from './obstacles';
import type {EnemyBody} from './enemy';
export function canChargeThroughStone(e:Pick<EnemyBody,'elite'|'x'|'y'>,target:Point){
 return e.elite==='ram'&&ARENA_STONES.some(p=>clearMeleeLine(e,target,p.id));
}
// 只接收真实冲锋碰撞留下的方向与时间；到场、计时或靠近均不能拆石。
export function arenaImpact(e:EnemyBody,broken:readonly ArenaStoneId[],now:number):ArenaStoneId|undefined{
 const hit=e.wallHit;if(e.elite!=='ram'||!hit?.direction||now-hit.at<0||now-hit.at>80)return;
 const next={x:e.x+hit.direction.x*2,y:e.y+hit.direction.y*2};
 return ARENA_STONES.find(p=>!broken.includes(p.id)&&rectInterval(e,next,{
  left:p.x-p.solid[0]/2-FOOT.halfWidth,right:p.x+p.solid[0]/2+FOOT.halfWidth,
  top:p.y-p.solid[1]-FOOT.halfHeight,bottom:p.y+FOOT.halfHeight,
 }))?.id;
}
