// 正式城防素材中的像素坐标就是构件的连接基准；不再用拉斜的砖面模拟建筑。
export const CITY_FORTRESS={x:8900,y:1000,width:1672,height:941,elevation:260} as const;
export const fortressPoint=(x:number,y:number)=>({x:CITY_FORTRESS.x+x,y:CITY_FORTRESS.y+y});
export const FORTRESS_STAIR={bottom:fortressPoint(1450,580),top:fortressPoint(1215,365+260)};
export const fortressHeight=(x:number)=>260-Math.max(0,x-10115)*.16;
export const FORTRESS_ARCHERS=[[185,100],[340,180],[445,235],[1155,530],[1360,625],[1515,695]].map(([x,y])=>fortressPoint(x,y+fortressHeight(CITY_FORTRESS.x+x)));
// 墙脚多边形按窄矩形覆盖，复用现有碰撞网格与连续线段查询，不把整图当碰撞盒。
const footprints=[
 [[28,205],[475,412],[475,505],[28,300]],
 [[475,460],[650,500],[714,559],[653,612],[470,553]],
 [[675,500],[747,510],[747,559],[700,595],[675,600]],
 [[844,588],[1025,665],[1100,742],[1020,795],[844,677]],
 [[1090,700],[1645,855],[1645,932],[1090,780]],
 [[1215,568],[1395,505],[1450,557],[1320,616]],
];
export const FORTRESS_SOLIDS=footprints.flatMap((polygon,index)=>{
 const xs=polygon.map(p=>p[0]),out:{id:string;x:number;y:number;w:number;h:number}[]=[];
 for(let x=Math.min(...xs);x<Math.max(...xs);x+=12){const mid=x+6,hits:number[]=[];
  for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length];if(mid>=Math.min(a[0],b[0])&&mid<Math.max(a[0],b[0]))hits.push(a[1]+(mid-a[0])*(b[1]-a[1])/(b[0]-a[0]));}
  if(hits.length>=2){const top=Math.min(...hits),bottom=Math.max(...hits);out.push({id:`city-fortress-foot-${index}-${x}`,x:CITY_FORTRESS.x+mid,y:CITY_FORTRESS.y+bottom,w:14,h:bottom-top});}
 }return out;
});
export const fortressFrontY=(x:number)=>{
 const points=[[0,300],[460,505],[650,612],[747,590],[844,677],[1020,795],[1100,780],[1645,932],[1672,941]];
 const i=Math.max(0,points.findIndex((p,j)=>j<points.length-1&&x>=p[0]&&x<=points[j+1][0]));const a=points[i],b=points[i+1];return CITY_FORTRESS.y+a[1]+(x-a[0])*(b[1]-a[1])/(b[0]-a[0]);
};

// 东南转角沿同一套墙材回折，接回原城界；截取原素材的直墙，避免重新画砖面。
export const FORTRESS_TAIL={x:10545,y:1930,length:810,slope:170/360,sourceX:70,sourceY:30,tileWidth:360,tileHeight:470,foot:285} as const;
for(let u=0;u<FORTRESS_TAIL.length;u+=12)FORTRESS_SOLIDS.push({id:`city-fortress-foot-6-${u}`,x:FORTRESS_TAIL.x-u-6,y:FORTRESS_TAIL.y+(u+6)*FORTRESS_TAIL.slope,w:14,h:70});
