import {describe,it,expect,vi} from 'vitest';
import sharp from 'sharp';
import type Phaser from 'phaser';
vi.mock('phaser',()=>({default:{TintModes:{FILL:1}}}));
vi.mock('../src/game/rendering/contactContour',async()=>({...await vi.importActual('../src/game/rendering/contactContour'),contactForFrame:vi.fn(()=>({paths:[[[.2,.9],[.8,.95]]]}))}));
import {GroundShadows} from '../src/game/rendering/groundShadows';
import {contactForFrame,contactContours} from '../src/game/rendering/contactContour';
import {appearanceFor,lowPlantTexture} from '../src/data/worldAppearance';
import {props} from '../src/data/world';
import {bakedShadowProp,dynamicShadowProp} from '../src/game/rendering/shadowGeometry';

function object(x=100,y=200){
 const o:any={x,y,width:50,height:15,scaleX:1,scaleY:1,visible:true,alpha:1,depth:200,rotation:0,flipX:false,
  on:vi.fn(),once:vi.fn(),off:vi.fn(),destroy:vi.fn(),setFillStyle:vi.fn(),buildOrderedIndices:vi.fn()};
 for(const [method,fields] of Object.entries({setPosition:['x','y'],setDisplaySize:['displayWidth','displayHeight'],setDepth:['depth'],setRotation:['rotation'],setAlpha:['alpha'],setVisible:['visible'],setOrigin:['originX','originY'],setFlipX:['flipX'],setTexture:['textureKey']}))o[method]=(...args:any[])=>{fields.forEach((f,i)=>o[f]=args[i]);return o;};
 return o;
}
function setup(key='berry'){
 const context:any={save:vi.fn(),restore:vi.fn(),translate:vi.fn(),beginPath:vi.fn(),moveTo:vi.fn(),lineTo:vi.fn(),closePath:vi.fn(),fill:vi.fn(),stroke:vi.fn()};
 const scene:any={textures:{exists:()=>true,createCanvas:vi.fn(()=>({context,refresh:vi.fn()})),remove:vi.fn()},events:{on:vi.fn(),once:vi.fn()},data:{set:vi.fn(),get:()=>()=>({time:540,indoor:false,floor:2})},
  cameras:{main:{worldView:{x:-1000,y:-1000,right:2000,bottom:2000}}},children:{depthSort:vi.fn()},add:{ellipse:vi.fn(()=>object()),image:vi.fn(()=>object()),mesh2d:vi.fn((_x,_y,_key,vertices,indices)=>Object.assign(object(),{vertices,indices}))}};
 const source=Object.assign(object(),{texture:{key},frame:{name:'__BASE',x:0,y:0,cutWidth:128,cutHeight:128,u0:0,v0:0,u1:1,v1:1,sourceIndex:0},displayWidth:78,displayHeight:65,displayOriginX:64,displayOriginY:128});
 const view=new GroundShadows(scene as Phaser.Scene);view.add(source);view.draw();return {view,source,scene,context,entry:view.entries.get(source)!};
}
describe('所有已开放区域植物接地',()=>{
 it('资源叶丛、三类灌木、三色花簇及花坛统一使用短接触影，树木不套用叶丛规则',()=>{
  for(const key of ['bush','berry','herb','herb-bed','orchard-flower-bed',...['shrub-one','shrub-two','shrub-three','flowers-white','flowers-gold','flowers-pink'].map(n=>'quality-'+n)]){
   const {entry,scene,context}=setup(key);expect(entry.footprint).toBeDefined();expect(entry.cast).toBeUndefined();expect(scene.add.mesh2d).not.toHaveBeenCalled();expect(context.lineWidth).toBe(1);
  }
  for(const key of ['tree','pink','city-complete-herb-stall','hero','grass'])expect(lowPlantTexture(key)).toBe(false);
  expect(setup('tree').entry.cast).toBeUndefined();
 });
 it('接触轮廓随根部摆动和镜像，画布留白不能再造成八像素错位',()=>{
  const {view,source,entry}=setup();source.rotation=.018;source.flipX=true;view.draw();
  expect(entry.soft.x).toBeCloseTo(source.x-8*Math.sin(.018));expect(entry.soft.y).toBeCloseTo(source.y+8*Math.cos(.018));
  expect(entry.soft.rotation).toBe(.018);expect(entry.soft.flipX).toBe(true);expect([source.x,source.y]).toEqual([100,200]);
 });
 it('采集变淡、隐藏及销毁不留下根部残影，连续摆动复用同一纹理',()=>{
  const {view,source,entry,scene}=setup();const calls=vi.mocked(contactForFrame).mock.calls.length;
  for(let i=0;i<100;i++){source.rotation=Math.sin(i)*.018;view.draw();}
  expect(scene.textures.createCanvas).toHaveBeenCalledTimes(1);expect(vi.mocked(contactForFrame).mock.calls.length).toBe(calls);
  const alpha=entry.soft.alpha;source.alpha=.3;view.draw();expect(entry.soft.alpha).toBeCloseTo(alpha*.3);
  source.visible=false;view.draw();expect(entry.soft.visible).toBe(false);source.visible=true;view.draw();expect(entry.soft.visible).toBe(true);
  entry.cleanup();expect(view.entries.size).toBe(0);expect(entry.soft.destroy).toHaveBeenCalledTimes(1);
 });
 it('灌木按低矮地表比例显示，静态树篱与动态资源均覆盖且不改变占地和交互坐标',()=>{
  const plants=props.filter(p=>lowPlantTexture(appearanceFor(p).texture));expect(plants.length).toBeGreaterThan(50);
  for(const p of plants){const before=JSON.stringify(p),a=appearanceFor(p);expect(JSON.stringify(p)).toBe(before);
   if(p.art==='bush')expect(a.height).toBeLessThanOrEqual(a.width*.55);
   if(!p.id.includes('seedbed')&&p.ground!==true)expect(bakedShadowProp(p)||dynamicShadowProp(p)).toBe(true);
  }
  expect(plants.some(p=>p.kind==='resource')).toBe(true);expect(plants.some(p=>p.art==='bush'&&bakedShadowProp(p))).toBe(true);
 });
 it('全部在用植物素材的根部边缘来自真实实体，排除透明边距及淡影',async()=>{
  const files=['berry.png','herb.png','tree.png','pink.png','bush.png','level-rework/herb-bed-candidate.png','village-polish/orchard-flower-bed.png',...['shrub-one','shrub-two','shrub-three','flowers-white','flowers-gold','flowers-pink'].map(n=>'art-quality/'+n+'.webp')];
  for(const file of files){const {data,info}=await sharp('public/assets/'+file).ensureAlpha().raw().toBuffer({resolveWithObject:true});const alpha=new Uint8Array(info.width*info.height);
   for(let i=0;i<alpha.length;i++)alpha[i]=data[i*4+3];const contact=contactContours(alpha,info.width,info.height);expect(contact.paths.length,file).toBeGreaterThan(0);
   for(const path of contact.paths)for(const [x,y] of path)expect(alpha[Math.floor(y*info.height)*info.width+Math.floor(x*info.width)],file).toBeGreaterThanOrEqual(160);
  }
 });
});
