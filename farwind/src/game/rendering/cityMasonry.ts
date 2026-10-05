import type Phaser from 'phaser';
import {CITY_WALL_HEIGHT} from '../../data/maps/windwhisper';
import {seamlessGround} from './worldAppearance';

// 所有城防构件共用同一个高度投影；地面坐标仍由原地图和碰撞系统管理。
export const CITY_WALL_LEAN=112;
export const cityWallScreenX=(x:number,elevation:number)=>x-elevation*CITY_WALL_LEAN/CITY_WALL_HEIGHT;
export type StonePoint=[number,number,number];
export const stonePoint=([x,y,z]:StonePoint):[number,number]=>[cityWallScreenX(x,z),y-z];

export function cityMasonry(scene:Phaser.Scene,c:CanvasRenderingContext2D,shear=0,offsetX=0){
 const project=(p:StonePoint):[number,number]=>{const [x,y]=stonePoint(p);return [x+p[1]*shear+offsetX,y];};
 const tiles=[0,1,2,3].map(i=>{
  const key=`fortress-material-${i}`;
  if(!scene.textures.exists(key)){
   const source=scene.textures.get('city-wall-materials').getSourceImage() as HTMLImageElement;
   const tile=document.createElement('canvas');tile.width=155;tile.height=110;
   tile.getContext('2d')!.drawImage(source,(i%2)*source.width/2,Math.floor(i/2)*source.height/2,source.width/2,source.height/2,0,0,155,110);
   scene.textures.addCanvas(key,seamlessGround(tile));
  }
  return scene.textures.get(key).getSourceImage() as HTMLCanvasElement;
 });
 const line=(a:StonePoint,b:StonePoint,color='#6c624e',width=1)=>{
  c.beginPath();c.moveTo(...project(a));c.lineTo(...project(b));c.strokeStyle=color;c.lineWidth=width;c.stroke();
 };
 const polygon=(points:StonePoint[],fill:string,edge='')=>{
  c.beginPath();points.forEach((p,i)=>i?c.lineTo(...project(p)):c.moveTo(...project(p)));c.closePath();c.fillStyle=fill;c.fill();
  if(edge){c.strokeStyle=edge;c.lineWidth=1;c.stroke();}
 };
 // 面几何决定承重和高度；手绘砌石保持统一像素尺度，避免纵墙石纹被挤成竖条。
 const face=(a:StonePoint,b:StonePoint,d:StonePoint,w:number,h:number,tile=0,shade='',phase=0)=>{
  const [ax,ay]=project(a),[bx,by]=project(b),[dx,dy]=project(d);
  c.save();c.beginPath();c.moveTo(ax,ay);c.lineTo(bx,by);c.lineTo(bx+dx-ax,by+dy-ay);c.lineTo(dx,dy);c.closePath();c.clip();
  const pattern=c.createPattern(tiles[tile],'repeat')!;pattern.setTransform(new DOMMatrix().translate(-phase,0));c.fillStyle=pattern;
  const minX=Math.min(ax,bx,dx,bx+dx-ax),minY=Math.min(ay,by,dy,by+dy-ay),fw=Math.max(ax,bx,dx,bx+dx-ax)-minX,fh=Math.max(ay,by,dy,by+dy-ay)-minY;
  c.fillRect(minX,minY,fw,fh);if(shade){c.fillStyle=shade;c.fillRect(minX,minY,fw,fh);}c.restore();
 };
 const block=(x0:number,y0:number,x1:number,y1:number,z0:number,z1:number)=>{
  face([x1,y0,z0],[x1,y1,z0],[x1,y0,z1],y1-y0,z1-z0,0,'#474d5238',y0);
  face([x0,y1,z0],[x1,y1,z0],[x0,y1,z1],x1-x0,z1-z0,0,'#594b3215',x0);
  face([x0,y0,z1],[x1,y0,z1],[x0,y1,z1],x1-x0,y1-y0,2,'#fff1cd24',x0);
  line([x0,y1,z1],[x1,y1,z1],'#f7eacd',1.5);line([x1,y0,z1],[x1,y1,z1],'#e8dbbd',1.5);
  line([x1,y1,z0],[x1,y1,z1],'#786a54',1);
 };
 const banner=(x:number,y:number,z:number)=>{
  const [px,py]=project([x,y,z]);c.save();c.translate(px,py);
  c.fillStyle='#233f68';c.strokeStyle='#cba151';c.lineWidth=2;
  c.beginPath();c.moveTo(-16,0);c.lineTo(16,0);c.lineTo(16,77);c.lineTo(0,65);c.lineTo(-16,77);c.closePath();c.fill();c.stroke();
  c.strokeStyle='#d9b45b';c.lineWidth=3;c.beginPath();c.moveTo(0,14);c.lineTo(0,53);c.moveTo(-9,25);c.quadraticCurveTo(-13,38,0,40);c.quadraticCurveTo(13,38,9,25);c.moveTo(-8,48);c.lineTo(8,48);c.stroke();
  c.strokeStyle='#806130';c.lineWidth=4;c.beginPath();c.moveTo(-23,-2);c.lineTo(23,-2);c.stroke();c.restore();
 };
 return {face,block,line,polygon,banner,tiles,project};
}
