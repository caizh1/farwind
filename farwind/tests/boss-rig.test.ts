import {describe,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
vi.mock('phaser',async()=>{const {createRequire}=await import('node:module'),{dirname,join}=await import('node:path'),require=createRequire(import.meta.url);return {default:{Geom:{Polygon:{Earcut:require(join(dirname(require.resolve('phaser/package.json')),'src/geom/polygon/Earcut.js'))}}}};});
import {BossRig} from '../src/game/entities/bossRig';
import {sampleBossMotion} from '../src/game/systems/bossMotion';
import {createBossAttack} from '../src/game/systems/campBossCombat';
import {initialBossBattle} from '../src/game/systems/campBossState';
import type {EnemyBody} from '../src/game/systems/enemy';
const atlas=JSON.parse(readFileSync('public/assets/camp-bosses-v2/thorn-crown/index.json','utf8'));
function surface(){
 const meshes:any[]=[],listeners=new Map<string,()=>void>();
 const object=()=>{const s:any={x:100,y:150,rotation:0,scaleX:.4375,scaleY:.4375,alpha:1,depth:150,visible:true,flipX:false,frame:{name:'right/idle',u0:0,u1:1,v0:0,v1:1,sourceIndex:2},texture:{key:'图集'},vertices:[],indices:[]};
  for(const method of ['setTexture','setPosition','setScale','setRotation','setAlpha','setDepth','setVisible','buildOrderedIndices','destroy'])s[method]=vi.fn((...args:any[])=>{if(method==='setPosition'){[s.x,s.y]=args;}if(method==='setScale'){[s.scaleX,s.scaleY]=args;}for(const [name,field] of [['setRotation','rotation'],['setAlpha','alpha'],['setDepth','depth'],['setVisible','visible']])if(method===name)s[field]=args[0];return s;});
  s.once=(name:string,callback:()=>void)=>{listeners.set(name,callback);return s;};s.off=(name:string)=>{listeners.delete(name);return s;};return s;
 };
 const scene:any={add:{mesh2d:()=>{const s=object();meshes.push(s);return s;}}},owner=object();owner.scene=scene;return {scene,owner,meshes,listeners};
}
describe('前爪分层网格的真实图集与生命周期',()=>{
 it('两爪三方向切换只复用两个网格，纹理坐标和图集页正确，隐藏、受击、重置全部同步',()=>{
  const s=surface(),rig=new BossRig(s.scene,'图集',s.owner,()=>{}),body={id:'网格专项',boss:'thorn-crown',type:'wolf',x:100,y:150,bossBattle:{...initialBossBattle(0),move:1}} as EnemyBody;
  for(const view of ['right','down','up'])for(const part of [0,1]){
   s.owner.frame.name=view+'/idle';body.bossBattle!.part=part;const a=createBossAttack(body,0,{x:200,y:150},body.bossBattle!),before=structuredClone(a);
   for(const now of [0,590,750,1010,1289]){s.owner.visible=true;rig.draw('thorn-crown',s.owner,atlas.frames[view+'/idle'],sampleBossMotion('thorn-crown',a,now,0,false),a,now);
    expect(s.meshes).toHaveLength(2);for(const mesh of s.meshes){expect(mesh.visible).toBe(true);expect(mesh.vertices.every(Number.isFinite)).toBe(true);for(let i=0;i<mesh.vertices.length;i+=4){expect(mesh.vertices[i+2]).toBeGreaterThanOrEqual(-1e-8);expect(mesh.vertices[i+2]).toBeLessThanOrEqual(1+1e-8);expect(mesh.vertices[i+3]).toBeGreaterThanOrEqual(-1e-8);expect(mesh.vertices[i+3]).toBeLessThanOrEqual(1+1e-8);}for(let i=0;i<mesh.indices.length;i+=4){expect(mesh.indices[i+3]).toBe(2);for(let n=0;n<3;n++)expect(mesh.indices[i+n]).toBeLessThan(mesh.vertices.length/4);}}
   }
   expect(a).toEqual(before);
  }
  rig.setVisible(false);expect(s.meshes.every(m=>!m.visible)).toBe(true);rig.setVisible(true);rig.setScale(.5,.5);expect(s.meshes.every(m=>m.scaleX===.5&&m.scaleY===.5)).toBe(true);
  s.owner.x=130;s.owner.rotation=.12;rig.syncImpact(s.owner);expect(s.meshes.every(m=>m.x===130&&m.rotation===.12)).toBe(true);
  s.owner.visible=true;rig.draw('thorn-crown',s.owner,atlas.frames['up/idle'],sampleBossMotion('thorn-crown',null,1300,0,false),null,1300);expect(s.meshes[1].visible).toBe(false);expect(rig.clawTip).toBeUndefined();
  rig.destroy();expect(s.meshes.every(m=>m.destroy.mock.calls.length===1)).toBe(true);expect(s.listeners.size).toBe(0);
 });
 it('原精灵销毁时释放两层网格和监听器，回调只触发一次',()=>{
  const s=surface(),onDestroy=vi.fn(),rig=new BossRig(s.scene,'图集',s.owner,onDestroy),body={id:'销毁专项',boss:'thorn-crown',type:'wolf',x:100,y:150,bossBattle:{...initialBossBattle(0),move:1}} as EnemyBody,a=createBossAttack(body,0,{x:200,y:150},body.bossBattle!);
  rig.draw('thorn-crown',s.owner,atlas.frames['right/idle'],sampleBossMotion('thorn-crown',a,590,0,false),a,590);s.listeners.get('destroy')!();expect(onDestroy).toHaveBeenCalledTimes(1);expect(s.meshes.every(m=>m.destroy.mock.calls.length===1)).toBe(true);expect(s.listeners.size).toBe(0);
 });
});
