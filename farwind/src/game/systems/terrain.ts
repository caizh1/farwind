import {MAP_REGIONS} from "../../data/village";
import {WILD_WATERS,WILD_BRIDGES} from "../../data/maps/windbell/wilderness";
import {groundChunks} from './terrainChunks';
import {campNestGroundAreas,campNestGroundCoverage,campNestGroundCleared} from './campNestGround';
import {ellipseDistance,featherCoverage,polygonDistance,strokeCoverage,terrainBounds,terrainJitter,terrainSegments} from './terrainBlend';
import type {TerrainBounds,TerrainPoint} from './terrainBlend';
import {SERVICE_SIGNS,VILLAGE_ANCHORS} from '../../data/maps/windbell/layout';
import { TRAINING } from "./training";
import Phaser from "phaser";
import {
  roads,
  roadWidth,
  WORLD,
  POND,
  villageAreas,
  canDecorate,
  shoreFlowers,
  inReworkArea,
  inVillageDecorArea,
  showLayoutLabels,
} from "../../data/world";
import type { World } from "../scenes/World";
import {ART_QUALITY} from '../../data/worldAppearance';
import {seamlessGround,makeGroundAppearance,paintGroundVariation} from '../rendering/worldAppearance';

export function makeTerrain(this: World) {
  // 候选手绘门只在资源层切帧，柱脚与横梁各自排序，门洞不产生矩形碰撞。
  const gate = this.textures.get("village-gate");
  gate.add("west", 0, 0, 0, 310, 1211);
  gate.add("east", 0, 1000, 0, 299, 1211);
  gate.add("beam", 0, 310, 0, 690, 420);
  this.textures.get("fence").add("boundary",0,0,120,274,186);
  this.textures.get("vertical-fence").add("trim",0,380,67,169,1446);
  const grass = seamlessGround(this.textures.get("grass").getSourceImage() as HTMLImageElement),
    forest = seamlessGround(this.textures.get("forest").getSourceImage() as HTMLImageElement),
    road = seamlessGround(this.textures.get("road").getSourceImage() as HTMLImageElement),
    waterMaterial = seamlessGround(this.textures.get("water").getSourceImage() as HTMLImageElement),
    earth = this.textures
      .get("packed-earth")
      .getSourceImage() as HTMLImageElement,
    herb = this.textures.get("herb").getSourceImage() as HTMLImageElement,
    flowerBed = this.textures.get("orchard-flower-bed").getSourceImage() as HTMLImageElement;
  const tiles=new Map<string,Phaser.GameObjects.Image>();
  let cleared=campNestGroundAreas.map(a=>campNestGroundCleared(a,this.state));
  // 区域边缘只烘焙一次；世界坐标决定起伏，相邻块和淘汰后重建保持一致。
  const blend = 32;
  const surface = document.createElement('canvas'), mask = document.createElement('canvas');
  surface.width = 600; surface.height = 550;
  // 每两个世界像素采样一次；四边各留一个采样点，缩放时跨块插值一致。
  mask.width = 302; mask.height = 277;
  // 遮罩由CPU写入，离屏合成也留在CPU，避免每层在显存与像素缓冲之间往返。
  const layer = surface.getContext('2d',{willReadFrequently:true})!, matte = mask.getContext('2d',{willReadFrequently:true})!;
  const pixels = matte.createImageData(mask.width, mask.height); pixels.data.fill(255);
  const upper = new Float64Array(mask.width), lower = new Float64Array(mask.width);
  const edge = (t:number) => Math.sin(t / 79) * 10 + Math.sin(t / 27) * 5 + Math.sin(t / 11) * 3;
  const regions = MAP_REGIONS.filter(r => r.id !== 'village').map(region => {
    // 当前地图的区域均为矩形；这里只改变显示边缘，不改变区域判定和碰撞。
    const left = Math.min(...region.polygon.map(p => p.x)), right = Math.max(...region.polygon.map(p => p.x));
    const top = Math.min(...region.polygon.map(p => p.y)), bottom = Math.max(...region.polygon.map(p => p.y));
    return {id:region.id, left, right, top, bottom};
  });
  const roadSegments = roads.flatMap((path,i)=>terrainSegments(path.map(([x,y])=>[x,y] as TerrainPoint),roadWidth(i)));
  const plaza = {x:670,y:760,rx:245,ry:150};
  const ellipseBounds = (p:{x:number;y:number;rx:number;ry:number},pad:number):TerrainBounds =>
    ({left:p.x-p.rx-pad,right:p.x+p.rx+pad,top:p.y-p.ry-pad,bottom:p.y+p.ry+pad});
  // 原河道曲线仅在建场时离散化；水与岸共用中线，不修改通行判定。
  const riverPoints:TerrainPoint[]=Array.from({length:33},(_,i)=>{
    const t=i/32,u=1-t;
    return [u**3*2620+3*u*u*t*2540+3*u*t*t*2700+t**3*2570,u**3*650+3*u*u*t*850+3*u*t*t*1250+t**3*1580];
  });
  const riverBank=terrainSegments(riverPoints,92),riverWater=terrainSegments(riverPoints,68);
  // 保留院落主体，边缘改为柔和的草土交错；少量轮廓点仅供静态地面烘焙。
  const soilAreas=[
    {points:[[1430,343],[1540,337],[1700,339],[1876,340],[1882,450],[1879,590],[1883,715],[1770,729],[1660,723],[1540,730],[1422,717],[1416,600],[1423,470],[1418,367],[1430,343]] as TerrainPoint[],opacity:1,base:true},
    {points:[[1060,406],[1130,420],[1179,467],[1188,540],[1166,604],[1120,650],[1070,622],[1034,570],[1019,509],[1024,444],[1060,406]] as TerrainPoint[],opacity:.42,base:false},
  ].map(a=>({...a,bounds:terrainBounds(a.points,25),edges:terrainSegments(a.points,0)}));
  const appearance=makeGroundAppearance(this);
  let peak=0,created=0,released=0;
  const drawTile=(cx:number,cy:number,key:string)=>{
      const texture = this.textures.createCanvas(key, 600, 550)!;
      const c = texture.context;
      c.translate(-cx, -cy);
      const gp = c.createPattern(grass, "repeat")!;
      gp.setTransform(new DOMMatrix().scale(ART_QUALITY.groundScale.grass));
      const rp = c.createPattern(road, "repeat")!;
      rp.setTransform(new DOMMatrix().scale(ART_QUALITY.groundScale.road));
      const intersects=(b:TerrainBounds,pad=0)=>cx+601>=b.left-pad&&cx-1<=b.right+pad&&cy+551>=b.top-pad&&cy-1<=b.bottom+pad;
      // 共用区域遮罩和离屏画布，只采样与当前地面块相交的范围。
      const paintBlend=(bounds:TerrainBounds,coverage:(x:number,y:number)=>number,paint:CanvasPattern|string,opacity=1,base?:string)=>{
        if(!intersects(bounds))return;
        pixels.data.fill(0);
        const left=Math.max(0,Math.floor((bounds.left-cx+1)/2)),right=Math.min(mask.width-1,Math.ceil((bounds.right-cx+1)/2));
        const top=Math.max(0,Math.floor((bounds.top-cy+1)/2)),bottom=Math.min(mask.height-1,Math.ceil((bounds.bottom-cy+1)/2));
        for(let row=top;row<=bottom;row++)for(let column=left;column<=right;column++)
          pixels.data[(row*mask.width+column)*4+3]=Math.round(255*coverage(cx+column*2-1,cy+row*2-1));
        matte.putImageData(pixels,0,0);
        const x=Math.max(cx,Math.floor(bounds.left)),y=Math.max(cy,Math.floor(bounds.top));
        const w=Math.min(cx+600,Math.ceil(bounds.right))-x,h=Math.min(cy+550,Math.ceil(bounds.bottom))-y;
        if(w<=0||h<=0)return;
        layer.clearRect(0,0,600,550);layer.save();layer.translate(-cx,-cy);
        if(base){layer.fillStyle=base;layer.fillRect(x,y,w,h);layer.globalAlpha=.6;}
        layer.fillStyle=paint;layer.fillRect(x,y,w,h);layer.globalAlpha=1;
        layer.globalCompositeOperation='destination-in';layer.drawImage(mask,1+(x-cx)/2,1+(y-cy)/2,w/2,h/2,x,y,w,h);layer.restore();
        c.save();c.globalAlpha=opacity;c.drawImage(surface,x-cx,y-cy,w,h,x,y,w,h);c.restore();
      };
      c.fillStyle = gp;
      c.fillRect(cx, cy, 600, 550);
      const fp = c.createPattern(forest, "repeat")!;
      fp.setTransform(new DOMMatrix().scale(ART_QUALITY.groundScale.forest));
      for(const region of regions){
        // 起伏最大18像素，加上32像素羽化；远离边缘的块直接铺纹理。
        const margin = blend + 18;
        if(cx + 600 <= region.left - margin || cx >= region.right + margin || cy + 550 <= region.top - margin || cy >= region.bottom + margin) continue;
        layer.clearRect(0, 0, 600, 550);
        layer.save(); layer.translate(-cx, -cy);
        layer.fillStyle=region.id==='forest'||region.id==='north'?fp:region.id==='ruins'?rp:gp;layer.fillRect(cx,cy,600,550);
        layer.fillStyle=region.id==='north'?'#688c9235':region.id==='south'?'#baa15d35':region.id==='west'?'#877d5330':'#64817425';layer.fillRect(cx,cy,600,550);
        if(cx < region.left + margin || cx + 600 > region.right - margin || cy < region.top + margin || cy + 550 > region.bottom - margin){
          for(let column=0;column<mask.width;column++){
            const x=cx+column*2-1;
            upper[column]=region.top+edge(x+region.top*.41);
            lower[column]=region.bottom+edge(x+region.bottom*.41);
          }
          for(let row=0;row<mask.height;row++){
            const y=cy+row*2-1,l=region.left+edge(y+region.left*.41),r=region.right+edge(y+region.right*.41);
            for(let column=0;column<mask.width;column++){
              const x=cx+column*2-1,distance=Math.min(x-l,r-x,y-upper[column],lower[column]-y);
              const t=Math.max(0,Math.min(1,(distance+blend)/(blend*2)));
              pixels.data[(row*mask.width+column)*4+3]=Math.round(255*t*t*(3-2*t));
            }
          }
          matte.putImageData(pixels,0,0);
          layer.globalCompositeOperation='destination-in';layer.drawImage(mask,1,1,300,275,cx,cy,600,550);
        }
        layer.restore(); c.drawImage(surface,cx,cy);
      }
      paintGroundVariation(c,cx,cy);
      // 地表先融入区域底图，水面、道路和桥面随后覆盖；战斗中不逐帧生成材质。
      for(const area of campNestGroundAreas){
        if(campNestGroundCleared(area,this.state)||!intersects(area.bounds))continue;
        const source=this.textures.get(area.texture).getSourceImage() as HTMLImageElement;
        const ground=c.createPattern(source,'repeat')!;
        ground.setTransform(new DOMMatrix().translate(area.bounds.left,area.bounds.top).scale((area.bounds.right-area.bounds.left)/source.width,(area.bounds.bottom-area.bounds.top)/source.height));
        paintBlend(area.bounds,(x,y)=>campNestGroundCoverage(x,y,area),ground,area.opacity);
      }
      const water=c.createPattern(waterMaterial,'repeat')!;
      water.setTransform(new DOMMatrix().scale(.55));
      for(const p of WILD_WATERS){
        paintBlend(ellipseBounds(p,31),(x,y)=>featherCoverage(ellipseDistance(x,y,p)+12+terrainJitter(x,y),14),'#aaa477');
        paintBlend(ellipseBounds(p,13),(x,y)=>featherCoverage(ellipseDistance(x,y,p)+terrainJitter(x,y)*.6,10),water);
      }
      const nearbyBank=riverBank.filter(s=>intersects(s,19)),nearbyWater=riverWater.filter(s=>intersects(s,13));
      if(nearbyBank.length)paintBlend(terrainBounds(riverPoints,65),(x,y)=>strokeCoverage(x,y,nearbyBank,14),'#bab18b');
      if(nearbyWater.length)paintBlend(terrainBounds(riverPoints,47),(x,y)=>strokeCoverage(x,y,nearbyWater,8),water);
      const nearbyRoads=roadSegments.filter(s=>intersects(s,19)),hasPlaza=intersects(ellipseBounds(plaza,19));
      if(nearbyRoads.length||hasPlaza){
        // 所有道路与广场先取并集，再羽化一次；路口不留下内部接缝。
        const bounds=[...nearbyRoads.map(s=>({left:s.left-19,right:s.right+19,top:s.top-19,bottom:s.bottom+19})),...(hasPlaza?[ellipseBounds(plaza,19)]:[])];
        paintBlend({left:Math.min(...bounds.map(b=>b.left)),right:Math.max(...bounds.map(b=>b.right)),top:Math.min(...bounds.map(b=>b.top)),bottom:Math.max(...bounds.map(b=>b.bottom))},(x,y)=>{
          const cover=strokeCoverage(x,y,nearbyRoads,14);
          return cover===1||!hasPlaza?cover:Math.max(cover,featherCoverage(ellipseDistance(x,y,plaza)+terrainJitter(x,y),14));
        },rp);
      }
      for(const b of WILD_BRIDGES){
        c.save();c.translate(b.x+b.w/2,b.y+b.h/2);c.rotate(Math.PI/2);
        c.drawImage(this.textures.get('bridge').getSourceImage() as HTMLImageElement,-b.h/2,-b.w/2,b.h,b.w);c.restore();
      }
      const worn={x:TRAINING.x,y:TRAINING.y,rx:76,ry:52};
      paintBlend(ellipseBounds(worn,19),(x,y)=>featherCoverage(ellipseDistance(x,y,worn)+terrainJitter(x,y),14),'#b2a16a',.53);
      // 草地中的夯土边缘略有起伏，低饱和土色上叠手绘土粒，不铺石板。
      const soil = c.createPattern(earth, "repeat")!;
      soil.setTransform(new DOMMatrix().scale(0.32));
      for(const a of soilAreas)paintBlend(a.bounds,(x,y)=>featherCoverage(polygonDistance(x,y,a.edges)+terrainJitter(x,y),20),soil,a.opacity,a.base?'#b69b70':undefined);
      // 低矮花床保持地面装饰和原区域，所有区块从同一世界坐标采样。
      c.drawImage(flowerBed, 1730, 1480, 210, 80);
      for (let i = 0; i < 4; i++) {
        c.fillStyle = "#8b6541";
        c.fillRect(VILLAGE_ANCHORS.workbench.x - 95 + i * 17, VILLAGE_ANCHORS.workbench.y - 45, 12, 40);
      }
      // 地面缓存保留静态岸底；动态水面及上层装饰不重复烘焙。
      paintBlend(ellipseBounds(POND,31),(x,y)=>featherCoverage(ellipseDistance(x,y,POND)+12+terrainJitter(x,y),14),'#b2b57e');
      // 原手绘池水由独立Shader一次绘制，地面不再保留静态副本。
      // 岸底继续缓存；水面、浅水、荷叶及桥面按原世界坐标独立分层。
      // 沿湖岸与主路之外点缀花簇，避免覆盖通行信息。
      for (const { x, y, pink } of shoreFlowers) {
        if (inReworkArea(x, y)) {
          c.drawImage(herb, x - 12, y - 19, 24, 24);
          continue;
        }
        c.fillStyle = "#668b43";
        c.fillRect(x, y, 8, 8);
        c.fillStyle = pink ? "#efb0ac" : "#f1d18d";
        c.fillRect(x + 2, y - 3, 4, 5);
      }
      c.fillStyle = "#496c4030";
      for (let i = 0; i < 45; i++) {
        const x = cx + ((i * 137) % 600),
          y = cy + ((i * 79) % 550);
        if ((inReworkArea(x, y) || inVillageDecorArea(x, y)) && !canDecorate(x, y, 7)) continue;
        c.beginPath();
        c.ellipse(x, y, 7, 2, 0.4, 0, 7);
        c.fill();
      }
      appearance.bake(c,cx,cy);
      texture.refresh();
      tiles.set(key,this.add.image(cx, cy, key).setOrigin(0).setDepth(WORLD.top-1000));
      created++;peak=Math.max(peak,tiles.size);
  };
  const refresh=()=>{
    const next=campNestGroundAreas.map(a=>campNestGroundCleared(a,this.state));
    const changed=campNestGroundAreas.filter((_,i)=>cleared[i]!==next[i]);
    cleared=next;
    // 清剿、读档、新游戏及风忆切换都在同一处刷新；只淘汰状态变化区域的缓存。
    for(const [key,im] of tiles)if(changed.some(a=>im.x+601>=a.bounds.left&&im.x-1<=a.bounds.right&&im.y+551>=a.bounds.top&&im.y-1<=a.bounds.bottom)){
      im.destroy();this.textures.remove(key);tiles.delete(key);released++;
    }
    if(this.active&&this.state.life.playerSpace!=='village')return;
    const camera=this.cameras.main;
    // 相机的scroll以未缩放视窗为参照；按中心还原真实世界可视矩形。
    const width=camera.width/camera.zoom,height=camera.height/camera.zoom;
    const cx=camera.scrollX+camera.width/2,cy=camera.scrollY+camera.height/2;
    const wanted=groundChunks({left:cx-width/2,top:cy-height/2,right:cx+width/2,bottom:cy+height/2},WORLD.width,WORLD.height,1,{x:WORLD.left,y:WORLD.top});
    const keys=new Set(wanted.map(c=>c.key));
    for(const [key,im] of tiles)if(!keys.has(key)){im.destroy();this.textures.remove(key);tiles.delete(key);released++;}
    let prefetched=0;
    const before=created;
    for(const tile of wanted)if(!tiles.has(tile.key)&&(tile.visible||prefetched++<1))drawTile(tile.x,tile.y,tile.key);
    // 场景本帧排序发生在prerender之前，新块必须当帧归入地面层。
    if(created!==before)this.children.depthSort();
  };
  this.events.on('prerender',refresh);
  this.events.once('shutdown',()=>{
    this.events.off('prerender',refresh);
    for(const [key,im] of tiles){im.destroy();this.textures.remove(key);}tiles.clear();
  });
  this.data.set('groundSnapshot',()=>({resident:tiles.size,peak,created,released,heroDepth:this.hero?.sprite.depth,floorDepth:WORLD.top-1000,limit:'当前视野加一圈，预取每帧一块',nestGround:campNestGroundAreas.map(a=>({direction:a.direction,texture:a.texture,center:[a.x,a.y],bounds:a.bounds,feather:a.feather,cleared:campNestGroundCleared(a,this.state),applied:!campNestGroundCleared(a,this.state)}))}));
  // 店招与门前交互分离；纯表现纹理不参与地面碰撞。
  const signKeys:string[]=[];
  for(const sign of SERVICE_SIGNS){
    const key=`plaque-${sign.id}`;signKeys.push(key);
    const tex=this.textures.createCanvas(key,224,72)!,c=tex.context;
    c.drawImage(this.textures.get('quality-plaque').getSourceImage() as HTMLImageElement,0,0,224,72);
    c.fillStyle='#fff0c8';c.font='bold 31px "PingFang SC",serif';c.textAlign='center';c.textBaseline='middle';c.fillText(sign.name,112,36);
    tex.refresh();
  }
  this.events.once('shutdown',()=>signKeys.forEach(key=>this.textures.remove(key)));
  const debug = showLayoutLabels(import.meta.env.DEV, window.location.search);
  this.data.set("layoutLabelCount", debug ? villageAreas.length : 0);
  if (debug)
    villageAreas.forEach((area) => {
      this.add
        .text(
          area.x,
          area.y + (area.id === "A" ? 180 : 90),
          `${area.id}  ${area.name}`,
          {
            fontFamily: "serif",
            fontSize: "18px",
            color: "#fff4cf",
            stroke: "#375a3c",
            strokeThickness: 4,
            backgroundColor: "#294f3ac0",
            padding: { x: 9, y: 5 },
          },
        )
        .setOrigin(0.5)
        .setDepth(1900);
    });
}
