import {it,expect} from 'vitest';
import {writeFileSync} from 'node:fs';
import {motionBlocked,clearMotionLine} from '../src/game/systems/obstacles';
import {WORLD} from '../src/data/world';
import {VILLAGE_ANCHORS} from '../src/data/maps/windbell/layout';
import {TRADE_ROAD_NODES} from '../src/data/maps/windwhisper';
it('以正式碰撞规划村庄、商路绕行、城市的真实键盘步行线',()=>{
 function plan(startPoint:{x:number,y:number},end:{x:number,y:number},road=false){
  const step=20,cols=WORLD.width/step,key=(x:number,y:number)=>Math.round((y-WORLD.top)/step)*cols+Math.round((x-WORLD.left)/step),point=(k:number)=>({x:WORLD.left+k%cols*step,y:WORLD.top+Math.floor(k/cols)*step});
  // 桥头触发区覆盖必经桥口。步行通路必须可达，但不伪称可以无战斗触发通过。
  const safe=(p:{x:number,y:number})=>{const margin=road&&p.x>6700&&p.x<7500?24:40,diagonal=margin*.7;return [[-margin,0],[margin,0],[0,-margin],[0,margin],[-diagonal,-diagonal],[diagonal,-diagonal],[-diagonal,diagonal],[diagonal,diagonal]].every(([dx,dy])=>!motionBlocked(p.x+dx,p.y+dy))&&(!road||TRADE_ROAD_NODES.every((n,i)=>i===2||i===3||Math.hypot(n.x-p.x,n.y-p.y)>340));};
  const start=key(startPoint.x,startPoint.y),goal=key(end.x,end.y),queue=[start],parent=new Map([[start,-1]]);
  for(let i=0;i<queue.length&&!parent.has(goal);i++){const k=queue[i],p=point(k);for(const [dx,dy]of [[20,0],[0,20],[0,-20],[-20,0],[20,20],[20,-20],[-20,20],[-20,-20]]){const q={x:p.x+dx,y:p.y+dy},next=key(q.x,q.y);if(q.x<(road?4210:200)||q.x>(road?11830:4270)||q.y<(road?800:260)||q.y>2360||parent.has(next)||!safe(q)||!clearMotionLine(p,q))continue;parent.set(next,k);queue.push(next);}}
  expect(parent.has(goal),`路线 ${JSON.stringify(startPoint)} → ${JSON.stringify(end)}，终点可站立 ${safe(end)}`).toBe(true);let path=[];for(let k=goal;k!==-1;k=parent.get(k)!){path.push(point(k));}path.reverse();
  const simplified=[path[0]];for(let i=1;i<path.length-1;i++){const a=path[i-1],p=path[i],b=path[i+1];if((p.x-a.x)*(b.y-p.y)!==(p.y-a.y)*(b.x-p.x))simplified.push(p);}simplified.push(path.at(-1)!);return simplified;
 }
 writeFileSync('docs/windwhisper-city/evidence/walk-route.json',JSON.stringify({说明:'按正式碰撞保留40单位键盘误差余量，桥面用24单位精准通行余量；其他节点留340单位距离。桥头触发区覆盖必经通路，保留实际300单位激活规则，通过时会遭遇敌人；不能把规划成功等同于无战斗通关。不授予能力、不修改角色或存档。',补给:plan({x:670,y:720},{x:VILLAGE_ANCHORS.general.x,y:VILLAGE_ANCHORS.general.y+60}),原野:plan({x:670,y:720},{x:4230,y:1600}),商路:plan({x:4230,y:1600},{x:11790,y:1600},true)},null,2));
},30000);
