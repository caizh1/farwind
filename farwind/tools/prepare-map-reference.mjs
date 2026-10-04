import {createServer} from 'vite';
import sharp from 'sharp';
import {mkdir,writeFile} from 'node:fs/promises';

// 只准备供图像生成使用的真实坐标底稿，不修改游戏地形。
const out='docs/map-zoom/design';
await mkdir(out,{recursive:true});
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try {
 const world=await server.ssrLoadModule('/src/data/world.ts');
 const village=await server.ssrLoadModule('/src/data/village.ts');
 const city=await server.ssrLoadModule('/src/data/maps/windwhisper.ts');
 const lots=await server.ssrLoadModule('/src/data/maps/windbell/layout.ts');
 const bounds={world:{left:-12000,top:-11000,width:36000,height:26000},plains:{left:-2110,top:-1380,width:6400,height:4800},city:{left:9490,top:-400,width:4370,height:3200}};
 const land=[[-9000,-1500],[-8000,-6500],[-3500,-10000],[4500,-10100],[11200,-8400],[18500,-7200],[21400,-2300],[21500,7000],[16200,12200],[7000,13600],[-2000,12200],[-7300,8500],[-10000,3200]];
 const regions=[{name:'雪原之境',x:-7600,y:-9200,w:8000,h:5800,color:'#dce9ec'},{name:'北风山脉',x:600,y:-9300,w:10000,h:5600,color:'#9aaca8'},{name:'赤焰荒原',x:12300,y:-7500,w:8500,h:6700,color:'#89665e'},{name:'月影湖',x:14800,y:1900,w:6000,h:4400,color:'#438897'},{name:'晨曦海岸',x:-5800,y:5700,w:6500,h:5200,color:'#aaa783'},{name:'金沙荒漠',x:2500,y:7500,w:12900,h:5900,color:'#c6af79'}];
 const buildings=[...lots.BUILDING_LOTS.map(p=>({...p,mapWidth:p.solid[0],mapHeight:p.solid[1]})),...city.CITY_PROPS.filter(p=>p.solid&&p.id.startsWith('city-')&&!p.id.includes('wall')&&!p.id.includes('edge')&&p.kind!=='npc').map(p=>({...p,mapWidth:p.solid[0],mapHeight:p.solid[1]}))];
 const geometry={说明:'真实道路、水域、桥梁、建筑碰撞占地和城墙。大陆展示范围仅供地图，不扩展可行走世界。',bounds,land,regions,roads:world.roads,waters:world.WATERS,bridges:world.BRIDGES,buildings,walls:village.VILLAGE_WALLS,props:world.props.filter(p=>p.solid),nodes:city.TRADE_ROAD_NODES,services:city.CITY_SERVICES};
 await writeFile(`${out}/reference-geometry.json`,JSON.stringify(geometry,null,2));
 for(const [id,b]of Object.entries(bounds)){
  let content=`<defs><clipPath id="land"><polygon points="${land.map(p=>p.join(',')).join(' ')}"/></clipPath></defs><rect x="${b.left}" y="${b.top}" width="${b.width}" height="${b.height}" fill="#234e60"/><polygon points="${land.map(p=>p.join(',')).join(' ')}" fill="#7d9370"/>`;
  content+=`<g clip-path="url(#land)">${regions.map(r=>`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${r.color}"/>`).join('')}</g>`;
  content+='<ellipse cx="21900" cy="9000" rx="1250" ry="2800" fill="#b9c8bd"/><ellipse cx="-9500" cy="11700" rx="950" ry="750" fill="#423452"/>';
  const colors={village:'#aaa78b',west:'#9da778',south:'#afa77c',north:'#829d8c',forest:'#6b8c73',ruins:'#a3a590','trade-road':'#809070','wind-city':'#aaa795'};
  content+=village.MAP_REGIONS.map(r=>`<polygon points="${r.polygon.map(p=>`${p.x},${p.y}`).join(' ')}" fill="${colors[r.id]}"/>`).join('');
  content+=world.WATERS.map(p=>`<ellipse cx="${p.x}" cy="${p.y}" rx="${p.rx}" ry="${p.ry}" fill="#4c91a3"/>`).join('');
  content+=world.roads.map((r,i)=>`<polyline points="${r.map(p=>p.join(',')).join(' ')}" fill="none" stroke="#e5d6af" stroke-width="${world.roadWidth(i)}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
  content+=world.BRIDGES.map(p=>`<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" fill="#b89e75" stroke="#5f675e" stroke-width="15"/>`).join('');
  content+=buildings.map(p=>`<rect x="${p.x-p.mapWidth/2}" y="${p.y-p.mapHeight}" width="${p.mapWidth}" height="${p.mapHeight}" fill="#956d57" stroke="#514c46" stroke-width="10"/>`).join('');
  content+=village.VILLAGE_WALLS.map(p=>`<path d="M${p.a.x},${p.a.y} L${p.b.x},${p.b.y}" stroke="#535b55" stroke-width="22"/>`).join('');
  content+=city.CITY_PROPS.filter(p=>p.solid&&(p.id.includes('wall')||p.id.includes('edge'))).map(p=>`<rect x="${p.x-p.solid[0]/2}" y="${p.y-p.solid[1]}" width="${p.solid[0]}" height="${p.solid[1]}" fill="#535b55"/>`).join('');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="${Math.round(1536*b.height/b.width)}" viewBox="${b.left} ${b.top} ${b.width} ${b.height}">${content}</svg>`;
  await writeFile(`${out}/${id}-reference.svg`,svg);
  await sharp(Buffer.from(svg)).png().toFile(`${out}/${id}-reference.png`);
 }
 console.log('已生成世界、原野与城市真实坐标底稿。');
}finally{await server.close();}
