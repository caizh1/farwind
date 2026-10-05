import {clearMeleeLine,type Point} from './obstacles';
import {firstSwordWindBlocker} from './swordWindGeometry';
// 正式场景沿空间索引扩大障碍轮廓，测试注入的线检测同样检查弹体两侧。
export function projectilePathClear(a:Point,b:Point,radius:number,clear=clearMeleeLine){
 if(!clear(a,b))return false;
 if(clear===clearMeleeLine)return !firstSwordWindBlocker(a,b,radius);
 const length=Math.hypot(b.x-a.x,b.y-a.y)||1,ox=-(b.y-a.y)/length*radius,oy=(b.x-a.x)/length*radius;
 return [-1,1].every(s=>clear({x:a.x+s*ox,y:a.y+s*oy},{x:b.x+s*ox,y:b.y+s*oy}));
}
