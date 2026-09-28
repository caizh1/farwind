import {MAP_REGIONS} from "../../data/village";
import {WILD_WATERS,WILD_BRIDGES} from "../../data/maps/windbell/wilderness";
import {groundChunks} from './terrainChunks';
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

export function makeTerrain(this: World) {
  // 候选手绘门只在资源层切帧，柱脚与横梁各自排序，门洞不产生矩形碰撞。
  const gate = this.textures.get("village-gate");
  gate.add("west", 0, 0, 0, 310, 1211);
  gate.add("east", 0, 1000, 0, 299, 1211);
  gate.add("beam", 0, 310, 0, 690, 420);
  this.textures.get("fence").add("boundary",0,0,120,274,186);
  this.textures.get("vertical-fence").add("trim",0,380,67,169,1446);
  const grass = this.textures.get("grass").getSourceImage() as HTMLImageElement,
    forest = this.textures.get("forest").getSourceImage() as HTMLImageElement,
    road = this.textures.get("road").getSourceImage() as HTMLImageElement,
    earth = this.textures
      .get("packed-earth")
      .getSourceImage() as HTMLImageElement,
    herb = this.textures.get("herb").getSourceImage() as HTMLImageElement,
    flowerBed = this.textures.get("orchard-flower-bed").getSourceImage() as HTMLImageElement;
  const tiles=new Map<string,Phaser.GameObjects.Image>();
  let peak=0,created=0,released=0;
  const drawTile=(cx:number,cy:number,key:string)=>{
      const texture = this.textures.createCanvas(key, 600, 550)!;
      const c = texture.context;
      c.translate(-cx, -cy);
      const gp = c.createPattern(grass, "repeat")!;
      gp.setTransform(new DOMMatrix().scale(0.6));
      const rp = c.createPattern(road, "repeat")!;
      rp.setTransform(new DOMMatrix().scale(0.25));
      c.fillStyle = gp;
      c.fillRect(cx, cy, 600, 550);
      const fp = c.createPattern(forest, "repeat")!;
      fp.setTransform(new DOMMatrix().scale(0.6));
      for(const region of MAP_REGIONS){
        if(region.id==='village')continue;
        c.save();c.beginPath();region.polygon.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.clip();
        c.fillStyle=region.id==='forest'||region.id==='north'?fp:region.id==='ruins'?rp:gp;c.fillRect(cx,cy,600,550);
        c.fillStyle=region.id==='north'?'#688c9235':region.id==='south'?'#baa15d35':region.id==='west'?'#877d5330':'#64817425';c.fillRect(cx,cy,600,550);c.restore();
      }
      for(const p of WILD_WATERS){
        c.beginPath();c.ellipse(p.x,p.y,p.rx+12,p.ry+12,0,0,Math.PI*2);c.fillStyle='#aaa477';c.fill();
        c.beginPath();c.ellipse(p.x,p.y,p.rx,p.ry,0,0,Math.PI*2);c.fillStyle=c.createPattern(this.textures.get('water').getSourceImage() as HTMLImageElement,'repeat')!;c.fill();
      }
      c.beginPath();
      c.moveTo(2620, 650);
      c.bezierCurveTo(2540, 850, 2700, 1250, 2570, 1580);
      c.strokeStyle = "#bab18b";
      c.lineWidth = 92;
      c.stroke();
      c.strokeStyle = c.createPattern(
        this.textures.get("water").getSourceImage() as HTMLImageElement,
        "repeat",
      )!;
      c.lineWidth = 68;
      c.stroke();
      c.lineCap = "round";
      c.lineJoin = "round";
      // 全部外轮廓先画，随后全部路面覆盖，交叉点内部没有后画的描边。
      for (const outline of [true, false]) {
        for (const [index, path] of roads.entries()) {
          c.beginPath();
          path.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
          c.strokeStyle = outline ? "#9f9d62" : rp;
          c.lineWidth = roadWidth(index) + (outline ? 15 : 0);
          c.stroke();
        }
        if (outline) {
          c.beginPath();
          c.ellipse(670, 760, 245, 150, 0, 0, Math.PI * 2);
          c.fillStyle = rp;
          c.fill();
          c.strokeStyle = "#b1a06b";
          c.lineWidth = 6;
          c.stroke();
        }
      }
      for(const b of WILD_BRIDGES){
        c.fillStyle="#76583b";c.fillRect(b.x,b.y,b.w,b.h);c.strokeStyle="#b99a66";c.lineWidth=3;for(let y=b.y+4;y<b.y+b.h;y+=18){c.beginPath();c.moveTo(b.x+3,y);c.lineTo(b.x+b.w-3,y);c.stroke();}
      }
      c.beginPath();
      c.ellipse(TRAINING.x, TRAINING.y, 76, 52, 0, 0, Math.PI * 2);
      c.fillStyle = "#b2a16a88";
      c.fill();
      // 草地中的夯土边缘略有起伏，低饱和土色上叠手绘土粒，不铺石板。
      const soil = c.createPattern(earth, "repeat")!;
      soil.setTransform(new DOMMatrix().scale(0.32));
      c.save();
      c.beginPath();
      c.moveTo(1430, 343);
      c.bezierCurveTo(1530, 327, 1760, 342, 1876, 340);
      c.bezierCurveTo(1890, 440, 1875, 605, 1883, 715);
      c.quadraticCurveTo(1780, 736, 1660, 723);
      c.quadraticCurveTo(1540, 738, 1422, 717);
      c.bezierCurveTo(1406, 612, 1428, 466, 1418, 367);
      c.closePath();
      c.clip();
      c.fillStyle = "#b69b70";
      c.fillRect(1400, 330, 500, 410);
      c.globalAlpha = 0.6;
      c.fillStyle = soil;
      c.fillRect(1400, 330, 500, 410);
      c.restore();
      // 院内仅是门前与药床旁磨出的土，保留草地，不铺满方形石路。
      c.save();
      c.beginPath();
      c.moveTo(1060, 406);
      c.bezierCurveTo(1150, 403, 1200, 473, 1188, 540);
      c.quadraticCurveTo(1178, 610, 1120, 650);
      c.quadraticCurveTo(1060, 632, 1034, 570);
      c.bezierCurveTo(1010, 510, 1010, 443, 1060, 406);
      c.closePath();
      c.globalAlpha = 0.42;
      c.fillStyle = soil;
      c.fill();
      c.restore();
      // 低矮花床保持地面装饰和原区域，所有区块从同一世界坐标采样。
      c.drawImage(flowerBed, 1730, 1480, 210, 80);
      for (let i = 0; i < 4; i++) {
        c.fillStyle = "#8b6541";
        c.fillRect(VILLAGE_ANCHORS.workbench.x - 95 + i * 17, VILLAGE_ANCHORS.workbench.y - 45, 12, 40);
      }
      // 地面缓存保留静态岸底；动态水面及上层装饰不重复烘焙。
      c.beginPath();
      for (let i = 0; i <= 96; i++) {
        const a = i / 96 * Math.PI * 2,
          edge = 10 + Math.sin(a * 7) * 2 + Math.sin(a * 13) * 1.8,
          x = POND.x + Math.cos(a) * (POND.rx + edge),
          y = POND.y + Math.sin(a) * (POND.ry + edge);
        if (i) c.lineTo(x, y); else c.moveTo(x, y);
      }
      c.closePath();
      c.fillStyle = "#b2b57e";
      c.fill();
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
      texture.refresh();
      tiles.set(key,this.add.image(cx, cy, key).setOrigin(0).setDepth(WORLD.top-1000));
      created++;peak=Math.max(peak,tiles.size);
  };
  const refresh=()=>{
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
  this.data.set('groundSnapshot',()=>({resident:tiles.size,peak,created,released,heroDepth:this.hero?.sprite.depth,floorDepth:WORLD.top-1000,limit:'当前视野加一圈，预取每帧一块'}));
  // 店招与门前交互分离；纯表现纹理不参与地面碰撞。
  const signKeys:string[]=[];
  for(const sign of SERVICE_SIGNS){
    const key=`plaque-${sign.id}`;signKeys.push(key);
    const tex=this.textures.createCanvas(key,224,72)!,c=tex.context;
    c.fillStyle='#3e4d39';c.beginPath();c.roundRect(3,3,218,66,9);c.fill();
    c.fillStyle='#806747';c.beginPath();c.roundRect(6,7,212,58,7);c.fill();
    c.strokeStyle='#d4b880';c.lineWidth=2;c.strokeRect(13,13,198,46);
    c.fillStyle='#fff0c8';c.font='bold 31px "PingFang SC",serif';c.textAlign='center';c.textBaseline='middle';c.fillText(sign.name,112,36);
    tex.refresh();
  }
  const book=this.textures.createCanvas('training-book',144,128)!,bc=book.context;
  signKeys.push('training-book');
  bc.fillStyle='#6f5039';bc.fillRect(28,72,10,51);bc.fillRect(106,72,10,51);bc.fillRect(14,62,116,18);
  bc.fillStyle='#40584b';bc.beginPath();bc.moveTo(15,28);bc.lineTo(70,34);bc.lineTo(129,28);bc.lineTo(122,72);bc.lineTo(70,77);bc.lineTo(22,72);bc.closePath();bc.fill();
  bc.fillStyle='#eee1b8';bc.beginPath();bc.moveTo(20,18);bc.lineTo(71,28);bc.lineTo(124,18);bc.lineTo(118,62);bc.lineTo(71,70);bc.lineTo(26,61);bc.closePath();bc.fill();
  bc.strokeStyle='#aa936c';bc.lineWidth=2;for(let y=32;y<=53;y+=8){bc.beginPath();bc.moveTo(30,y);bc.lineTo(61,y+5);bc.moveTo(81,y+5);bc.lineTo(114,y);bc.stroke();}book.refresh();
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
