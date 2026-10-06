import {createServer} from 'vite';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import sharp from 'sharp';

// 对照数据直接调用当前游戏函数，避免另写一套近似动画冒充原版。
const output='docs/east-boss-motion/source';
await mkdir(output,{recursive:true});
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
  const {BossMotion,deformBossPoint}=await server.ssrLoadModule('/src/game/systems/bossMotion.ts');
  const {createBossAttack}=await server.ssrLoadModule('/src/game/systems/campBossCombat.ts');
  const {initialBossBattle}=await server.ssrLoadModule('/src/game/systems/campBossState.ts');
  const root='public/assets/camp-bosses-v2/bound-branch';
  const manifest=JSON.parse(await readFile(root+'/index.json','utf8'));
  const atlas=JSON.parse(await readFile(root+'/atlas.json','utf8'));
  const name='down/idle',art=manifest.frames[name];
  const page=atlas.textures.find(p=>p.frames.some(f=>f.filename===name));
  const rect=page.frames.find(f=>f.filename===name).frame;
  await sharp(root+'/'+page.image).extract({left:rect.x,top:rect.y,width:rect.w,height:rect.h}).png().toFile(output+'/baseline-idle.png');
  const body={id:'样片原版对照',boss:'bound-branch',type:'leaf',hp:2500,x:0,y:0,bossAttempt:0,attackSerial:0,face:{x:0,y:1}};
  const battle=initialBossBattle(0);battle.move=0;battle.part=0;
  const first=createBossAttack(body,1400,{x:0,y:200},battle);
  battle.part=1;
  const second=createBossAttack(body,first.recoveryUntil+160,{x:0,y:200},battle);
  const motion=new BossMotion(),frames=[];
  for(let frame=0;frame<360;frame++){
    const now=frame/60*1000,walk=now>=600&&now<1400;
    const u=Math.max(0,Math.min(1,(now-600)/800));
    const distance=40*(u*u*(3-2*u));
    const attack=now>=first.startedAt&&now<first.recoveryUntil?first:now>=second.startedAt&&now<second.recoveryUntil?second:null;
    const pose=motion.sample('bound-branch',attack,now,distance,walk),points=[];
    for(let r=0;r<=20;r++)for(let c=0;c<=20;c++){
      const x=(art.width*c/20-art.foot[0])/480,y=(art.height*r/20-art.foot[1])/480;
      points.push(deformBossPoint('bound-branch',false,x,y,art.width/480,pose));
    }
    frames.push({时刻:now,顶点:points});
  }
  const files=['src/game/systems/bossMotion.ts','src/game/systems/campBossCombat.ts','src/game/entities/campBossView.ts'];
  const hashes=Object.fromEntries(await Promise.all(files.map(async file=>[file,createHash('sha256').update(await readFile(file)).digest('hex')])));
  const timing={第一段:{开始:first.startedAt,命中:first.contactAt,活动结束:first.activeUntil,收招结束:first.recoveryUntil},第二段:{开始:second.startedAt,命中:second.contactAt,活动结束:second.activeUntil,收招结束:second.recoveryUntil}};
  await writeFile(output+'/baseline-motion.json',JSON.stringify({说明:'由当前正式动作函数离线采样；仅角色本体，无实战、特效或存档。两段十字镰斩沿用第一阶段时序。',帧率:60,素材:art,时序:timing,源码摘要:hashes,帧:frames}));
  await writeFile(output+'/baseline-provenance.json',JSON.stringify({说明:'原版比较基线，直接调用当前源码采样，不使用历史录像。',源码摘要:hashes,时序:timing,主体像素高度:480,采样帧数:frames.length},null,2));
  console.log(JSON.stringify({说明:'原版对照采样完成',帧数:frames.length,时序:timing},null,2));
}finally{await server.close();}
