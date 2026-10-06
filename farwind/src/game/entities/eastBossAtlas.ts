import Phaser from 'phaser';
import type {EnemyBody} from '../systems/enemy';
import {shiftBossAttack,shiftBossBattle,type SavedBossCombat} from '../systems/campBossState';
import {EastBossAnimation,eastFrameAt,type EastAtlas,type EastPose,type EastFrame} from '../systems/eastBossAnimation';

export const EAST_TEXTURE_BUDGET=192*1024*1024;
const BASE='/assets/east-boss-motion-v2/';
const REQUIRED=['cross-left-planted','cross-right-planted',...['left','right'].flatMap(side=>['parry-'+side,'perfect-'+side,...['left','right'].map(turn=>'walk-turn-'+turn+'-'+side)]),...Array.from({length:7},(_,i)=>'stop-'+(i+1)),'idle','walk','start','stop','turn-left','turn-right','entry','cross-left','cross-link','cross-right','shift','exposed','recover','hurt','parry','perfect','transform','death',...['needles','roots','cocoon','ritual','laser'].flatMap(n=>['enter','hold','exit'].map(s=>n+'-'+s))];
export function validateEastAtlas(value:unknown,pilot=false):asserts value is EastAtlas{
 const m=value as EastAtlas&{complete?:boolean};
 if(!m||m.version!==3||m.kind!=='bound-branch'||m.referenceHeight!==512||(!m.complete&&!pilot)||!Array.isArray(m.pages)||!m.frames||!m.clips)throw Error('东侧首领动画清单不完整。');
 if(m.alphaMode&&(m.alphaMode.png!=='straight'||m.alphaMode.ktx!=='premultiplied'||!m.assetHash?.match(/^[a-f0-9]{64}$/)))throw Error('东侧首领透明格式或资源版本错误。');
 for(const p of m.pages)if(!Number.isSafeInteger(p.width)||!Number.isSafeInteger(p.height)||p.width<4||p.height<4||p.width>2048||p.height>2048||p.width%4||p.height%4||p.bytes!==p.width*p.height*4||p.compressedBytes!==p.width*p.height||!/^page-\d+\.png$/.test(p.png)||!/^page-\d+\.ktx$/.test(p.ktx)||p.gzip!==undefined&&(!/^page-\d+\.ktx\.gz$/.test(p.gzip)||!Number.isSafeInteger(p.gzipBytes)||p.gzipBytes!<1||p.gzipBytes!>p.compressedBytes+1024))throw Error('东侧首领图集尺寸或预算错误。');
 if(m.baseFrames&&(!Array.isArray(m.baseFrames)||!m.baseFrames.length||m.baseFrames.some(id=>!m.frames[id])))throw Error('常驻动画帧声明错误。');
 for(const f of Object.values(m.frames)){
  const p=m.pages[f.page];if(!p||f.rect?.length!==4||f.rect.some(n=>!Number.isSafeInteger(n)||n<0)||f.rect[2]<1||f.rect[3]<1||f.rect[0]+f.rect[2]>p.width||f.rect[1]+f.rect[3]>p.height||f.pivot?.length!==2||f.pivot.some(n=>!Number.isFinite(n))||!f.sockets)throw Error('东侧首领帧坐标错误。');
  for(const key of ['left','right','core','footL','footR'])if(f.sockets[key]?.length!==2||f.sockets[key].some(n=>!Number.isFinite(n)))throw Error('东侧首领挂点缺失。');
 }
 for(const name of (pilot?['idle','walk','cross-left','cross-link','cross-right']:REQUIRED)){const c=m.clips[name];if(!c||!(c.duration>0))throw Error('东侧首领动作缺失：'+name);
  for(let d=0;d<8;d++){const fs=c.directions[d];if(!fs?.length||fs[0].at!==0||fs.at(-1)!.at!==c.duration||fs.some((f,i)=>!Number.isFinite(f.at)||f.at<0||f.at>c.duration||i>0&&f.at<=fs[i-1].at||!m.frames[f.frame]))throw Error('东侧首领方向或帧时序错误：'+name);}
 }
}
type Resident={bytes:number;used:number};
export class EastBossAtlas{
 manifest?:EastAtlas;ready=false;failure='';compressed=false;
 private resident=new Map<number,Resident>();private pending=new Map<number,Promise<void>>();private pinned=new Set<number>();private wanted=new Set<number>();private failed=new Set<number>();private epoch=0;private tick=0;private reserved=0;private decoding=0;private inflating=0;private displayed?:string;private pageFrames=new Map<number,[string,EastFrame][]>();
 metrics={residentBytes:0,peakBytes:0,decodedPeakBytes:0,inflatedPeakBytes:0,downloadBytes:0,loads:0,misses:0,failedPages:0,criticalMisses:0};
 constructor(private scene:Phaser.Scene){scene.events?.once('shutdown',()=>this.clear());}
 key(page:number){return `east-boss-animation-${this.manifest?.assetHash??this.manifest?.sourceHash}-${this.epoch}-${page}`;}
 async prepare(pilot=false){
  const generation=this.epoch;const response=await fetch(BASE+'index.json',{cache:'no-cache'});if(!response.ok)throw Error('东侧首领正式动画未安装。');
  const m:unknown=await response.json();validateEastAtlas(m,pilot);if(generation!==this.epoch)throw Error('首领资源准备已取消。');this.manifest=m;this.pageFrames.clear();for(const pair of Object.entries(m.frames)){const list=this.pageFrames.get(pair[1].page)??[];list.push(pair);this.pageFrames.set(pair[1].page,list);}
  const renderer=this.scene.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
  this.compressed=m.alphaMode?.ktx==='premultiplied'&&!!renderer.compression?.S3TC&&new URLSearchParams(location.search).get('eastBossTexture')!=='png';
  if(m.baseFrames)for(const id of m.baseFrames)this.pinned.add(m.frames[id].page);
  else for(const clip of Object.values(m.clips))for(let d=0;d<8;d++)this.pinned.add(m.frames[clip.directions[d][0].frame].page);
  if([...this.pinned].reduce((sum,p)=>sum+this.bytes(p),0)>EAST_TEXTURE_BUDGET-32*1048576)throw Error('基础动画占用过大，无法安全预载。');
  // 战前检查全部分包存在，避免缺失动作在开战后才出现；不把整套图集同时解码。
  if(!pilot)for(let i=0;i<m.pages.length;i+=12){await Promise.all(m.pages.slice(i,i+12).map(async p=>{const r=await fetch(BASE+this.file(p)+'?v='+(m.assetHash??m.sourceHash),{method:'HEAD'});if(!r.ok)throw Error('首领动画分包缺失。');}));if(generation!==this.epoch)throw Error('首领资源准备已取消。');}
  this.wanted=new Set(this.pinned);
  for(const p of this.pinned)await this.load(p);
  if(generation!==this.epoch)throw Error('首领资源准备已取消。');
  if(m.clips.entry)await this.load(m.frames[m.clips.entry.directions[0][0].frame].page);
  if(generation!==this.epoch)throw Error('首领资源准备已取消。');
  // 读档恢复优先当前施法，不能先装无关双镰再让持续光柱缺帧。
  const world=this.scene as Phaser.Scene&{enemies?:EnemyBody[];sim?:number;combatEncounters?:{groups:Record<string,{boss?:{combat:SavedBossCombat|null}}>}},now=world.sim??0,saved=world.combatEncounters?.groups['east-thorn-camp']?.boss?.combat;
  // 资源检查早于实体恢复，从既有相对时钟还原当前片段。
  const body=world.enemies?.find(e=>e.boss==='bound-branch'&&e.hp>0)??(saved?.attack?{type:'leaf',hp:1,x:0,y:0,attack:shiftBossAttack(saved.attack,now),bossBattle:shiftBossBattle(saved.battle,now)}:undefined);
  const live=body?.attack&&!body.attack.cancelled&&now<body.attack.recoveryUntil;
  const pose=live?new EastBossAnimation().sample(body!,body!.attack,now,{action:'idle',elapsed:0,facing:0,index:0,frame:0,phase:'警戒',provisional:true},0):undefined;
  const selected=pose&&eastFrameAt(m,pose),pages=selected?[selected.frame.page,...selected.sequence.slice(selected.index).map(f=>m.frames[f.frame].page),...selected.sequence.slice(0,selected.index).map(f=>m.frames[f.frame].page)]:m.baseFrames?['cross-left','cross-right'].flatMap(name=>m.clips[name].directions[0].map(f=>m.frames[f.frame].page)):[];
  this.wanted=new Set(this.pinned);let warm=[...this.wanted].reduce((sum,id)=>sum+this.bytes(id),0);
  for(const page of new Set(pages)){if(this.wanted.has(page))continue;const size=this.bytes(page);if(warm+size>EAST_TEXTURE_BUDGET)continue;this.wanted.add(page);warm+=size;await this.load(page);if(generation!==this.epoch)throw Error('首领资源准备已取消。');}
  this.ready=true;
 }
 private file(p:EastAtlas['pages'][number]){return this.compressed?(p.gzip&&typeof DecompressionStream!=='undefined'?p.gzip:p.ktx):p.png;}
 private bytes(page:number){const p=this.manifest!.pages[page];return this.compressed?p.compressedBytes:p.bytes;}
 private async load(page:number){
  if(this.resident.has(page))return;
  const running=this.pending.get(page);if(running)return running;
  const bytes=this.bytes(page),generation=this.epoch,key=this.key(page),meta=this.manifest!.pages[page];
  const displayPage=this.displayed?this.manifest!.frames[this.displayed]?.page:undefined;
  while(this.metrics.residentBytes+this.reserved+bytes>EAST_TEXTURE_BUDGET){
   const victim=[...this.resident].filter(([id])=>!this.pinned.has(id)&&!this.wanted.has(id)&&id!==displayPage).sort((a,b)=>a[1].used-b[1].used)[0];
   if(!victim)return;this.scene.textures.remove(this.key(victim[0]));this.resident.delete(victim[0]);this.metrics.residentBytes-=victim[1].bytes;
  }
  this.reserved+=bytes;this.metrics.peakBytes=Math.max(this.metrics.peakBytes,this.metrics.residentBytes+this.reserved);
  const work=(async()=>{
   const response=await fetch(BASE+this.file(meta)+'?v='+(this.manifest!.assetHash??this.manifest!.sourceHash));if(!response.ok)throw Error('动画分包读取失败。');
   let buffer=await response.arrayBuffer();if(generation!==this.epoch)return;
   this.metrics.downloadBytes+=Number(response.headers?.get('content-length'))||buffer.byteLength;
   if(this.compressed){
    if(this.file(meta)===meta.gzip){this.metrics.inflatedPeakBytes=Math.max(this.metrics.inflatedPeakBytes,this.reserved);if(new Uint8Array(buffer)[0]===0x1f&&new Uint8Array(buffer)[1]===0x8b){this.inflating+=bytes;this.metrics.inflatedPeakBytes=Math.max(this.metrics.inflatedPeakBytes,this.inflating);try{buffer=await new Response(new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();}finally{if(generation===this.epoch)this.inflating-=bytes;}}if(generation!==this.epoch)return;if(buffer.byteLength!==bytes+68)throw Error('压缩传输分包长度不一致。');}
    const data=Phaser.Textures.Parsers.KTXParser(buffer);
    if(!data||data.width!==meta.width||data.height!==meta.height||data.internalFormat!==0x83f3||data.mipmaps.length!==1||data.mipmaps[0].data.byteLength!==bytes)throw Error('压缩纹理与清单不一致。');
    Object.assign(data,{format:(this.scene.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer).getCompressedTextureName('S3TC',data.internalFormat)});
    if(!this.scene.textures.addCompressedTexture(key,data))throw Error('压缩纹理创建失败。');
   }else{
    const url=URL.createObjectURL(new Blob([buffer],{type:'image/png'})),image=new Image();
    this.decoding+=meta.bytes;this.metrics.decodedPeakBytes=Math.max(this.metrics.decodedPeakBytes,this.decoding);
    try{image.src=url;await image.decode();if(generation!==this.epoch)return;if(image.width!==meta.width||image.height!==meta.height)throw Error('图集尺寸与清单不一致。');if(!this.scene.textures.addImage(key,image))throw Error('图集创建失败。');}finally{if(generation===this.epoch)this.decoding-=meta.bytes;URL.revokeObjectURL(url);}
   }
   if(generation!==this.epoch){this.scene.textures.remove(key);return;}
   const texture=this.scene.textures.get(key);
   for(const [id,f] of this.pageFrames.get(page)??[])texture.add(id,0,...f.rect);
   this.resident.set(page,{bytes,used:++this.tick});this.metrics.residentBytes+=bytes;this.metrics.loads++;
  })();this.pending.set(page,work);
  try{await work;}catch(e){if(generation===this.epoch&&this.scene.textures.exists?.(key))this.scene.textures.remove(key);throw e;}finally{if(generation===this.epoch){this.reserved-=bytes;this.pending.delete(page);}}
 }
 sample(p:EastPose):{id:string;frame:EastFrame;key:string;late:boolean}|undefined{
  const m=this.manifest;if(!this.ready||!m)return;
  const selected=eastFrameAt(m,p);if(!selected)return;
  const candidates=[selected.frame.page];
  const clip=m.clips[p.clip];
  for(const f of selected.sequence)if(f.at>=selected.sequence[selected.index].at&&f.at<=p.time+600)candidates.push(m.frames[f.frame].page);
  for(const t of Object.values(clip.markers??{}))if(t>=p.time&&t<=p.time+750){const f=eastFrameAt(m,{...p,time:t});if(f)candidates.push(f.frame.page);}
  for(const direction of [(p.direction+1)%8,(p.direction+7)%8]){const f=eastFrameAt(m,{...p,direction});if(f)candidates.push(f.frame.page);}
  const next=p.clip.endsWith('-enter')?p.clip.replace('-enter','-hold'):p.clip.startsWith('cross-left')?'cross-right'+(p.clip.endsWith('-planted')?'-planted':''):p.clip==='cross-link'?'cross-right':p.clip.endsWith('-hold')?p.clip.replace('-hold','-exit'):p.clip==='walk'?(Math.round(p.time/125)%8?'stop-'+Math.round(p.time/125)%8:'stop'):['idle','start','walk'].includes(p.clip)||p.clip.startsWith('walk-turn-')?'cross-left':'exposed';
  const following=eastFrameAt(m,{...p,clip:next,time:0});if(following){candidates.push(following.frame.page);for(const f of following.sequence)if(f.at<=750)candidates.push(m.frames[f.frame].page);}
  this.wanted=new Set(this.pinned);let total=[...this.wanted].reduce((sum,id)=>sum+this.bytes(id),0);
  if(this.displayed){const id=m.frames[this.displayed].page;if(!this.wanted.has(id)){this.wanted.add(id);total+=this.bytes(id);}}
  for(const id of candidates)if(!this.wanted.has(id)&&total+this.bytes(id)<=EAST_TEXTURE_BUDGET){this.wanted.add(id);total+=this.bytes(id);}
  const generation=this.epoch;
  for(const id of this.wanted)if(!this.failed.has(id)&&!this.resident.has(id)&&!this.pending.has(id)&&this.pending.size<2)void this.load(id).catch(e=>{if(generation===this.epoch){this.failed.add(id);this.failure=(e as Error).message;this.metrics.failedPages++;}});
  const late=!this.resident.has(selected.frame.page);if(late){this.metrics.misses++;if(p.phase==='出手')this.metrics.criticalMisses++;}
  const nearest=late?selected.sequence.slice(0,selected.index+1).reverse().find(f=>this.resident.has(m.frames[f.frame].page)):undefined;
  const id=late?(nearest?.frame??this.displayed??m.clips.idle.directions[p.direction][0].frame):selected.id,f=m.frames[id];
  const resident=this.resident.get(f.page);if(!resident)return;
  resident.used=++this.tick;this.displayed=id;return {id,frame:f,key:this.key(f.page),late};
 }
 clear(){
  for(const id of this.resident.keys())this.scene.textures.remove(this.key(id));this.epoch++;this.resident.clear();this.pending.clear();this.pinned.clear();this.wanted.clear();this.failed.clear();this.reserved=0;this.decoding=0;this.inflating=0;this.manifest=undefined;this.pageFrames.clear();this.ready=false;this.displayed=undefined;this.metrics.residentBytes=0;
 }
}
