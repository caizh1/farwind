import {readFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {BossArtCache} from '../src/game/entities/bossArtCache';
import {afterEach,describe,expect,it,vi} from 'vitest';
vi.mock('phaser',()=>({default:{Textures:{Parsers:{KTXParser:()=>({width:2048,height:2048,internalFormat:0x83f3,mipmaps:[{data:{byteLength:4194304}}]})}}}}));
import {EastBossAtlas,EAST_TEXTURE_BUDGET,validateEastAtlas} from '../src/game/entities/eastBossAtlas';
const clips=['idle','walk','cross-left','cross-link','cross-right'];
function manifest(count=60){
 const pages=Array.from({length:count},(_,i)=>({png:`page-${i}.png`,ktx:`page-${i}.ktx`,width:2048,height:2048,bytes:16777216,compressedBytes:4194304}));
 const frames=Object.fromEntries(pages.map((_,i)=>['f'+i,{page:i,rect:[0,0,512,512],pivot:[256,500],sockets:Object.fromEntries(['left','right','core','footL','footR'].map(k=>[k,[0,0]]))}]));
 const sequence=pages.map((_,i)=>({at:i*100,frame:'f'+i}));
 return {sourceHash:'原工程',assetHash:'a'.repeat(64),alphaMode:{png:'straight',ktx:'premultiplied'},version:3,kind:'bound-branch',referenceHeight:512,complete:false,pages,frames,clips:Object.fromEntries(clips.map(c=>[c,{duration:(count-1)*100,loop:false,directions:Object.fromEntries(Array.from({length:8},(_,d)=>[d,sequence]))}]))};
}
function setup(compressed=true){
 const textures=new Map();const scene={events:{once:vi.fn()},game:{renderer:{compression:compressed?{S3TC:{}}:{},getCompressedTextureName:()=> 'COMPRESSED_RGBA_S3TC_DXT5_EXT'}},textures:{addCompressedTexture:(key:string)=>{textures.set(key,{add:vi.fn()});return true},addImage:(key:string)=>{textures.set(key,{add:vi.fn()});return true},get:(key:string)=>textures.get(key),remove:(key:string)=>textures.delete(key)}};
 vi.stubGlobal('location',{search:''});vi.stubGlobal('Image',class{width=2048;height=2048;src='';async decode(){}});
 const m=manifest();vi.stubGlobal('fetch',vi.fn(async(url:string)=>({ok:true,json:async()=>m,arrayBuffer:async()=>new ArrayBuffer(68)})));
 return {cache:new EastBossAtlas(scene as any),textures,m,scene};
}
async function settle(){for(let i=0;i<8;i++)await Promise.resolve();}
afterEach(()=>vi.unstubAllGlobals());
describe('东侧图集预算与资源生命周期',()=>{
 it('读档实体尚未创建时先预热正在施放的持续片段',async()=>{
  const {cache,m,scene}=setup();m.frames.f45.page=45;(m as any).baseFrames=['f0'];(m.clips as any)['laser-hold']={duration:600,loop:true,directions:Object.fromEntries(Array.from({length:8},(_,d)=>[d,[{at:0,frame:'f45'},{at:600,frame:'f45'}]]))};
  Object.assign(scene,{sim:0,combatEncounters:{groups:{'east-thorn-camp':{boss:{combat:{attack:{bossSkill:6,startedAt:-2000,contactAt:-800,activeUntil:6000,recoveryUntil:6900,cancelled:false,direction:{x:0,y:1}},battle:{entryUntil:-3000,transformUntil:-3000}}}}}}});
  await cache.prepare(true);const shown=cache.sample({clip:'laser-hold',time:0,direction:0,phase:'出手'});expect(shown?.id).toBe('f45');expect(shown?.late).toBe(false);expect(cache.metrics.criticalMisses).toBe(0);expect(cache.metrics.peakBytes).toBeLessThanOrEqual(EAST_TEXTURE_BUDGET);
 });

 it('双实体当前帧、缺页回退和预取需求独立，共用一个预算',async()=>{const {cache,m}=setup();await cache.prepare(true);await (cache as any).load(4);cache.beginFrame();const one=cache.sample({clip:'walk',time:400,direction:0,phase:''},'owner');m.clips.walk.directions['1']=[{at:0,frame:'f59'},{at:5900,frame:'f59'}];const two=cache.sample({clip:'walk',time:0,direction:1,phase:''},'clone');expect(one?.id).toBe('f4');expect(two?.id).not.toBe(one?.id);await settle();expect((cache as any).requests.has('owner')).toBe(true);expect((cache as any).requests.has('clone')).toBe(true);expect(cache.metrics.peakBytes).toBeLessThanOrEqual(EAST_TEXTURE_BUDGET);});
 it('缺动作不能进入正式路径；试播也必须具备八个真实方向',()=>{const m=manifest();expect(()=>validateEastAtlas(m)).toThrow();expect(()=>validateEastAtlas(m,true)).not.toThrow();delete (m.clips.idle.directions as any)[7];expect(()=>validateEastAtlas(m,true)).toThrow();});
 it('裁切根点可在框外，但帧、挂点和尺寸必须有效',()=>{const m=manifest();m.frames.f0.pivot=[-12,700];expect(()=>validateEastAtlas(m,true)).not.toThrow();m.frames.f0.rect[0]=2000;expect(()=>validateEastAtlas(m,true)).toThrow();});
 it.each([true,false])('压缩支持为 %s 时持续切页仍含预载峰值低于预算',async compressed=>{
  const {cache,textures}=setup(compressed);await cache.prepare(true);expect(cache.compressed).toBe(compressed);
  for(let i=1;i<60;i++){cache.sample({clip:'walk',time:i*100,direction:0,phase:''});await settle();}
  expect(cache.metrics.loads).toBeGreaterThan(20);expect(cache.metrics.peakBytes).toBeLessThanOrEqual(EAST_TEXTURE_BUDGET);expect(cache.metrics.failedPages).toBe(0);expect(textures.size*(compressed?4194304:16777216)).toBe(cache.metrics.residentBytes);
  cache.clear();expect(textures.size).toBe(0);expect(cache.metrics.residentBytes).toBe(0);
 });
 it('旧清单没有预乘标记时使用透明图片',async()=>{const {cache,m}=setup();delete (m as any).alphaMode;delete (m as any).assetHash;await cache.prepare(true);expect(cache.compressed).toBe(false);expect(vi.mocked(fetch).mock.calls.some(([u])=>String(u).includes('.png?v='))).toBe(true);});
 it('同一工程重打包后纹理和下载缓存按内容版本隔离',async()=>{const {cache,m}=setup();await cache.prepare(true);const old=cache.key(0);expect(old).toContain(m.assetHash);expect(vi.mocked(fetch).mock.calls.some(([u])=>String(u).endsWith('?v='+m.assetHash))).toBe(true);cache.clear();m.assetHash='b'.repeat(64);await cache.prepare(true);expect(cache.key(0)).not.toBe(old);expect(cache.key(0)).toContain(m.assetHash);expect(vi.mocked(fetch).mock.calls.some(([u])=>String(u).endsWith('?v='+m.assetHash))).toBe(true);});
 it('透明格式声明必须与完整资源摘要同时提供',()=>{const m=manifest();m.assetHash='';expect(()=>validateEastAtlas(m,true)).toThrow('透明格式');});
 it('交付清单覆盖完整动作、真实方向与合法裁切坐标',()=>{const m=JSON.parse(readFileSync(new URL('../public/assets/east-boss-motion-v2/index.json',import.meta.url),'utf8'));expect(()=>validateEastAtlas(m)).not.toThrow();});
 it.each([true,false])('服务器自动解包为 %s 时都只解压一次',async automatic=>{const {cache,m}=setup();const raw=new Uint8Array(4194304+68),gz=gzipSync(raw);Object.assign(m.pages[0],{gzip:'page-0.ktx.gz',gzipBytes:gz.length});vi.stubGlobal('fetch',vi.fn(async(url:string)=>url.includes('index.json')?{ok:true,json:async()=>m}:new Response(automatic?raw:gz,{headers:{'Content-Length':String(gz.length),...automatic?{'Content-Encoding':'gzip'}:{}}})));await cache.prepare(true);expect(cache.ready).toBe(true);expect(cache.metrics.downloadBytes).toBe(gz.length);});
 it('战前新资源失败后完整切回旧版图集',async()=>{const {scene,textures}=setup();let complete=()=>{};let key='';Object.assign(scene.textures,{exists:(id:string)=>textures.has(id)});Object.assign(scene,{load:{once:(_event:string,fn:()=>void)=>{complete=fn},off:vi.fn(),on:vi.fn(),multiatlas:(id:string)=>{key=id},isLoading:()=>false,start:()=>{textures.set(key,{});complete()}}});const old=JSON.parse(readFileSync(new URL('../public/assets/camp-bosses-v2/bound-branch/index.json',import.meta.url),'utf8'));vi.stubGlobal('fetch',vi.fn(async(url:string)=>url.includes('east-boss-motion-v2')?{ok:false}:{ok:true,json:async()=>old}));const cache=new BossArtCache(scene as any);await cache.ensure('bound-branch');expect(cache.ready('bound-branch')).toBe(true);expect(cache.east.ready).toBe(false);expect(textures.has('camp-boss-hd-bound-branch')).toBe(true);});
 it('解码期间释放不会把已退出的资源重新注册',async()=>{
  const {cache,textures}=setup(false);let finish!:()=>void;vi.stubGlobal('Image',class{width=2048;height=2048;src='';decode(){return new Promise<void>(r=>finish=r)}});
  const preparing=cache.prepare(true);await settle();expect(finish).toBeTypeOf('function');cache.clear();finish();await expect(preparing).rejects.toThrow('取消');expect(textures.size).toBe(0);expect(cache.ready).toBe(false);
 });
 it('丢失分包不产生隐形帧，也不会反复请求已知失败页',async()=>{
  const {cache}=setup();await cache.prepare(true);const fetcher=vi.mocked(fetch);fetcher.mockClear();fetcher.mockImplementation(async()=>({ok:false}) as Response);
  cache.sample({clip:'walk',time:100,direction:0,phase:''});await settle();const failures=cache.metrics.failedPages;expect(failures).toBeGreaterThan(0);
  for(let i=0;i<5;i++){const shown=cache.sample({clip:'walk',time:100,direction:0,phase:''});expect(shown?.id).toBe('f0');await settle();}
  const urls=fetcher.mock.calls.map(([url])=>String(url));expect(new Set(urls).size).toBe(urls.length);expect(cache.metrics.failedPages).toBe(urls.length);expect(cache.ready).toBe(true);
 });
});
