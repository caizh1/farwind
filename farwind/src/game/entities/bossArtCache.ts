import type Phaser from 'phaser';
import type {CampBossKind} from '../../data/maps/windbell/campBosses';
export type BossFrame={width:number;height:number;nativeHeight:number;foot:[number,number];sourceHeight:number};
export type BossAtlas={version:2;kind:CampBossKind;decodedBytes:number;minimumSourceHeight:number;pages:{width:number;height:number}[];frames:Record<string,BossFrame>};
// 区域资源始终只留一位首领；新资源加载前释放上一位，不能在解码阶段短暂持有两套。
export class BossArtCache{
 current?:CampBossKind;manifest?:BossAtlas;loading?:Promise<void>;failure='';
 constructor(private scene:Phaser.Scene){}
 key(kind:CampBossKind){return `camp-boss-hd-${kind}`;}
 ready(kind:CampBossKind){return this.current===kind&&!!this.manifest&&this.scene.textures.exists(this.key(kind));}
 async ensure(kind:CampBossKind):Promise<void>{
  if(this.ready(kind))return;if(this.loading)return this.loading.then(()=>this.ensure(kind));
  if(this.failure&&this.current===kind)throw Error(this.failure);
  if(this.current)this.scene.textures.remove(this.key(this.current));this.current=kind;this.manifest=undefined;this.failure='';
  const operation=(async()=>{
   const response=await fetch(`/assets/camp-bosses-v2/${kind}/index.json`);if(!response.ok)throw Error('首领素材尚未加载完成。');const m=await response.json() as BossAtlas;
   if(m.version!==2||m.kind!==kind||!Number.isSafeInteger(m.decodedBytes)||m.decodedBytes<1||m.decodedBytes>192*1048576||m.minimumSourceHeight<480||!Array.isArray(m.pages)||m.pages.some(p=>!Number.isSafeInteger(p.width)||!Number.isSafeInteger(p.height)||p.width>2048||p.height>2048||p.width<1||p.height<1)||m.decodedBytes!==m.pages.reduce((sum,p)=>sum+p.width*p.height*4,0)||!m.frames||Object.values(m.frames).some(f=>!Number.isSafeInteger(f.width)||!Number.isSafeInteger(f.height)||f.width<1||f.height<1||f.width>2048||f.height>2048||!Number.isFinite(f.sourceHeight)||f.sourceHeight<480||!Number.isFinite(f.nativeHeight)||f.nativeHeight<480||!Array.isArray(f.foot)||f.foot.length!==2||f.foot.some((p,i)=>!Number.isFinite(p)||p<0||p>(i===0?f.width:f.height))))throw Error('首领素材未通过尺寸及纹理预算检查。');
   for(const d of ['down','up','right']){if(!m.frames[`${d}/idle`])throw Error('首领方向素材缺失。');for(let i=0;i<4;i++)if(!m.frames[`${d}/walk/${i}`])throw Error('首领行走素材缺失。');for(let i=0;i<6;i++)for(const p of ['charge','strike','recover'])if(!m.frames[`${d}/skill-${i}/${p}`])throw Error('首领招式姿态缺失。');}
   await new Promise<void>((resolve,reject)=>{const key=this.key(kind),complete=()=>{this.scene.load.off('loaderror',failed);this.scene.textures.exists(key)?resolve():reject(Error('首领图集装载失败。'));},failed=(file:{key:string})=>{if(file.key===key){this.scene.load.off('complete',complete);this.scene.load.off('loaderror',failed);reject(Error('首领图集资源读取失败。'));}};this.scene.load.once('complete',complete);this.scene.load.on('loaderror',failed);this.scene.load.multiatlas(key,`/assets/camp-bosses-v2/${kind}/atlas.json`,`/assets/camp-bosses-v2/${kind}/`);if(!this.scene.load.isLoading())this.scene.load.start();});
   this.manifest=m;
  })();this.loading=operation;
  try{await operation;}catch(e){this.failure=(e as Error).message;throw e;}finally{if(this.loading===operation)this.loading=undefined;}
 }
 clear(){if(this.current)this.scene.textures.remove(this.key(this.current));this.current=undefined;this.manifest=undefined;this.failure='';}
}
