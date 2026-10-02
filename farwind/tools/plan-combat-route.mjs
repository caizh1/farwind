import {createServer} from 'vite';
// 只读取正式地图几何来规划真实键鼠验收路线；不连接浏览器、不写游戏存档。
const [x,y,tx,ty]=process.argv.slice(2).map(Number);
if(![x,y,tx,ty].every(Number.isFinite))throw Error('请提供实际观察到的起点与目标坐标。');
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {syncMapGeometry}=await server.ssrLoadModule('/src/data/world.ts');
 // 仅在正式界面已确认修缮完成后传入此参数，不能用规划器代替施工。
 syncMapGeometry(process.argv.includes('--open-west'));
 const {localPath}=await server.ssrLoadModule('/src/game/systems/enemy.ts');
 const {clearMotionLine}=await server.ssrLoadModule('/src/game/systems/obstacles.ts');
 const start={x,y},target={x:tx,y:ty};
 const result=localPath(start,p=>Math.hypot(p.x-tx,p.y-ty)<25,target,()=>true,undefined,{radius:5000,nodes:18000});
 if(!result.path)throw Error('当前地图条件下没有找到可复核通路。');
 const points=[start,...result.path],corners=[];let at=0;
 if(process.argv.includes('--grid')){
  // 键盘只有八个行走方向，保留网格转角，避免把可见直线误当作可走的阶梯线。
  for(let i=1;i<points.length-1;i++){
   const a={x:points[i].x-points[at].x,y:points[i].y-points[at].y},b={x:points[i+1].x-points[i].x,y:points[i+1].y-points[i].y};
   if(Math.abs(a.x*b.y-a.y*b.x)>1e-6||a.x*b.x+a.y*b.y<=0){corners.push(points[i]);at=i;}
  }
  corners.push(points.at(-1));
 }else while(at<points.length-1){let next=at+1;for(let i=next;i<points.length;i++)if(clearMotionLine(points[at],points[i]))next=i;corners.push(points[next]);at=next;}
 console.log(JSON.stringify({说明:'以下是静态地图的合法通路，正式试玩仍必须用键鼠走到各点。动态敌人占位未计入。',展开节点:result.visited,路点:corners},null,2));
}finally{await server.close();}
