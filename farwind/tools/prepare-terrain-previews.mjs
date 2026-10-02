import {createServer} from 'vite';
import {mkdirSync,writeFileSync} from 'node:fs';
// 固定起点只改变位置；地图、战斗、背包与任务仍从正式初始状态开始。
const sites=[
 ['plaza','村庄广场与石路',680,930],['training','练习场夯土与草地',1580,770],
 ['pharmacy','药师院内土地区',1180,720],['village-pond','村庄湖岸与桥头',1280,1510],
 ['forest-road','森林石路与路口',2840,1220],['south-boundary','南门田野边界',800,1900],
 ['west-road','旧农庄石路',-600,1320],['north-road','北部山道',650,-300],
 ['north-ruins','北部山林与遗迹',2370,-650],['ruins-boundary','遗迹与森林交界',3300,350],
 ['west-pond','西部池塘岸线',-1320,740],['south-reed','南部浅塘与桥头',950,2510],
 ['south-deep','南部深塘与桥头',1780,2940],['east-pool','东部峡谷水潭',2420,940],
 ['river','林间河道',2500,1350],
];
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {initialState,parseSave}=await server.ssrLoadModule('/src/game/systems/state.ts');
 const {terrainBlocked,solidPropAt}=await server.ssrLoadModule('/src/data/world.ts');
 const records=[];mkdirSync('docs/terrain-transition/world/starts',{recursive:true});
 for(const [id,name,tx,ty] of sites){
  let point;
  for(let radius=0;radius<=160&&!point;radius+=10)for(let i=0;i<(radius?16:1);i++){
   const a=i*Math.PI/8,x=tx+Math.cos(a)*radius,y=ty+Math.sin(a)*radius;
   if(!terrainBlocked(x,y)&&!solidPropAt(x,y)){point={x,y};break;}
  }
  if(!point)throw Error(`没有找到合法起点：${name}`);
  const s=initialState();Object.assign(s.player,point);Object.assign(s.xiaobao,point);
  const text=JSON.stringify({说明:`独立端口的地形视觉验收：${name}；未修改任务和战斗结果。`,...s},null,2);parseSave(text);
  writeFileSync(`docs/terrain-transition/world/starts/${id}.json`,text);
  records.push({标识:id,名称:name,起点:point});
 }
 writeFileSync('docs/terrain-transition/world/sites.json',JSON.stringify({说明:'覆盖全部室外地形绘制类型的十五个固定验收起点。',地点:records},null,2));
 console.log('十五个地形验收起点已通过正式存档与碰撞检查。');
}finally{await server.close();}
