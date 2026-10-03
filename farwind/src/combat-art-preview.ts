import Phaser from 'phaser';
import {EnemyView} from './game/entities/enemyView';
import {CAMP_BOSSES,type CampBossKind} from './data/maps/windbell/campBosses';
import {ENEMIES,enemyProfile,type EnemyKind} from './data/enemies';
import {initialBossBattle} from './game/systems/campBossState';
import {createBossAttack} from './game/systems/campBossCombat';
import {createEnemyAttack} from './game/systems/enemyAttack';
import type {EnemyBody} from './game/systems/enemy';
import type {Facing} from './game/systems/locomotion';
if(!import.meta.env.DEV)throw Error('高清固定预览只供本地审阅。');
const select=(id:string)=>document.querySelector<HTMLSelectElement>('#'+id)!;
const actor=select('actor'),actions=select('action'),direction=select('direction'),speed=select('speed'),part=select('part'),info=document.querySelector('#info')!;
for(const [value,label] of [...Object.entries(CAMP_BOSSES).map(([k,d])=>[k,d.name]),...Object.entries(ENEMIES).map(([k,d])=>[k,d.name])])actor.add(new Option(label,value));
class Preview extends Phaser.Scene{
 view!:EnemyView;sprites!:Phaser.GameObjects.Sprite[];elapsed=0;paused=false;loading=false;duration=2500;
 preload(){EnemyView.preload(this);this.load.image('forest-reference','/docs/enemy-design-v2/references/forest-day.webp');this.load.spritesheet('hero-reference','/assets/animation/round-three/hero-motion.png',{frameWidth:128,frameHeight:128});}
 create(){
  this.add.image(700,325,'forest-reference').setDisplaySize(1400,650).setAlpha(.65);this.add.rectangle(360,325,690,610,0xf4eddc,.87);this.add.rectangle(1060,325,650,610,0xf4eddc,.82);
  this.view=new EnemyView(this);this.sprites=[this.add.sprite(360,565,'enemy-slime'),this.add.sprite(940,540,'enemy-slime')];this.add.sprite(1220,540,'hero-reference',9).setOrigin(.5,124/128).setDisplaySize(86,92);
  const caption=this.add.text(100,600,'连续动作 · 二倍检查',{fontSize:'20px',color:'#274035'});this.add.text(790,600,'连续动作 · 世界原尺寸',{fontSize:'20px',color:'#274035'});
  document.querySelector<HTMLInputElement>('#baseline')!.onchange=e=>{caption.setText((e.target as HTMLInputElement).checked?'原版姿势切换 · 二倍对照':'连续动作 · 二倍检查');this.paint();};
  const ink=this.add.graphics().lineStyle(1,0x167c7a,.75);for(const [x,y] of [[360,565],[940,540]])ink.lineBetween(x-20,y,x+20,y).lineBetween(x,y-8,x,y+8);
  // 本地固定预览的只读出口，检查实际提交给渲染器的关节，不提供状态写入能力。
  (window as unknown as {__bossMotionPreview:()=>unknown}).__bossMotionPreview=()=>({角色:actor.value,时钟:this.elapsed,暂停:this.paused,特效:this.view.boss.effects.snapshot(),样本:this.sprites.map(s=>({根:[s.x,s.y],镜像:s.flipX,素材:s.frame.name,动画:this.view.boss.debugMotion(s),怪物表现:this.view.debug(s)}))});
  part.onchange=()=>{this.elapsed=0;this.view.reset();this.paint();};actor.onchange=()=>void this.choose();actions.onchange=()=>{this.elapsed=0;this.view.reset();this.paint();};direction.onchange=()=>{this.elapsed=0;this.view.reset();this.paint();};
  document.querySelector<HTMLButtonElement>('#pause')!.onclick=()=>{this.paused=!this.paused;this.paint();};document.querySelector<HTMLButtonElement>('#restart')!.onclick=()=>{this.elapsed=0;this.view.reset();this.paint();};document.querySelector<HTMLInputElement>('#scrub')!.oninput=e=>{this.paused=true;this.elapsed=Number((e.target as HTMLInputElement).value);this.paint();};document.querySelector<HTMLInputElement>('#time')!.oninput=e=>{this.paused=true;this.elapsed=Math.max(0,Math.min(this.duration-1,Number((e.target as HTMLInputElement).value)));this.paint();};void this.choose();
 }
 async choose(){
  if(this.loading)return;this.loading=true;this.elapsed=0;this.view.reset();actor.disabled=actions.disabled=direction.disabled=true;this.sprites.forEach(s=>s.setVisible(false));info.textContent='正在加载本角色高清图集……';
  const kind=actor.value,old=actions.value;actions.replaceChildren(new Option('待机','idle'),new Option('行走','walk'));
  if(Object.hasOwn(CAMP_BOSSES,kind)){const boss=kind as CampBossKind;CAMP_BOSSES[boss].skills.forEach((name,i)=>actions.add(new Option(name,'skill-'+i)));try{await this.view.boss.assets.ensure(boss);}catch(e){info.textContent=(e as Error).message;this.loading=false;actor.disabled=actions.disabled=direction.disabled=false;return;}}
  else {actions.add(new Option('招牌攻击','attack'));actions.add(new Option('阵亡','death'));}if([...actions.options].some(o=>o.value===old))actions.value=old;this.loading=false;actor.disabled=actions.disabled=direction.disabled=false;this.paint();
 }
 paint(){
  if(this.loading)return;this.view.begin();const kind=actor.value,boss=Object.hasOwn(CAMP_BOSSES,kind)?kind as CampBossKind:undefined,type=boss?CAMP_BOSSES[boss].type:kind as EnemyKind,directionIndex=Number(direction.value),d=directionIndex===0?{x:0,y:1}:directionIndex===1?{x:0,y:-1}:{x:directionIndex===2?-1:1,y:0};
  let phase='待机';this.duration=['idle','walk'].includes(actions.value)?60000:2500;
  for(const [i,sprite] of this.sprites.entries()){
   const body={id:'固定预览-'+i,type,boss,hp:boss?CAMP_BOSSES[boss].hp:enemyProfile(type).hp,x:i?940:360,y:i?540:565,face:d,bossBattle:boss?initialBossBattle(0):undefined,attackSerial:0,bossAttempt:0} as EnemyBody;
   let attack=null;if(actions.value.startsWith('skill-')&&boss){body.bossBattle!.part=Number(part.value);body.bossBattle!.move=Number(actions.value.slice(6));body.bossBattle!.lastSkill=body.bossBattle!.move;attack=createBossAttack(body,0,{x:body.x+d.x*200,y:body.y+d.y*200},body.bossBattle!);}else if(actions.value==='attack')attack=createEnemyAttack(body.id,0,type,0,body,{x:body.x+d.x*200,y:body.y+d.y*200});
   if(attack)this.duration=attack.recoveryUntil+1800;const now=['idle','walk'].includes(actions.value)?this.elapsed:Math.min(this.elapsed,this.duration-1);
   if(attack&&now>=attack.recoveryUntil&&boss){body.bossBattle!.exposedUntil=this.duration;attack=null;}
   const inks=[this.view.boss.effects.groundInk,this.view.boss.effects.strikeInk];if(!i)for(const ink of inks)ink.save().translateCanvas(body.x,body.y).scaleCanvas(2,2).translateCanvas(-body.x,-body.y);
   if(!(boss?this.view.boss.entries.get(sprite):this.view.entries.get(sprite)))this.view.draw(body,attack,sprite,now,false);
   const motion=boss?this.view.boss.entries.get(sprite)?.motion:this.view.entries.get(sprite)?.motion.motion;if(motion)motion.facing=directionIndex as Facing;
   if(actions.value==='death'&&motion){body.hp=0;motion.deathAt=0;}
   if(actions.value==='walk'&&motion){const travel=Math.min(10,now*enemyProfile(type).speed/1000);motion.distance=Math.max(0,now*enemyProfile(type).speed/1000-travel);motion.last={x:body.x-d.x*travel,y:body.y-d.y*travel,hp:body.hp,now:now-100};}
   const pose=this.view.draw(body,attack,sprite,now,false);phase=({idle:'待机',walk:'行走',charge:'蓄力',commit:'锁向',active:'出手',recovery:'收招',death:'死亡',stagger:'失衡'} as Record<string,string>)[String(pose.phase)]??String(pose.phase);
   if(!i)for(const ink of inks)ink.restore();
   if(!i){
    const entry=this.view.boss.entries.get(sprite);
    if(boss&&entry?.rig&&document.querySelector<HTMLInputElement>('#baseline')!.checked){
     const dir=directionIndex===0?'down':directionIndex===1?'up':'right',name=attack?`${dir}/skill-${attack.bossSkill}/${now>=attack.activeUntil?'recover':now>=attack.contactAt?'strike':'charge'}`:actions.value==='walk'?`${dir}/walk/${Math.floor(entry.motion.distance/13)%4}`:`${dir}/idle`,art=this.view.boss.assets.manifest!.frames[name],scale=CAMP_BOSSES[boss].height/art.nativeHeight;
     entry.rig.setVisible(false);sprite.setTexture(this.view.boss.assets.key(boss),name).setOrigin(art.foot[0]/art.width,art.foot[1]/art.height).setDisplaySize(art.width*scale,art.height*scale).setVisible(true);
    }
    sprite.setScale(sprite.scaleX*2,sprite.scaleY*2);if(entry?.rig)entry.rig.setScale(sprite.scaleX,sprite.scaleY);
   }
  }
  part.disabled=actor.value!=='thorn-crown'||actions.value!=='skill-1';this.view.finishWarnings();info.textContent=`${actor.selectedOptions[0].textContent} · ${actions.selectedOptions[0].textContent} · ${direction.selectedOptions[0].textContent} · ${phase} · ${Math.round(this.elapsed)}／${this.duration}毫秒 · 连续关节网格 · 首领纹理 ${(this.view.boss.assets.manifest?.decodedBytes??0)/1048576|0}MiB`;
  const range=document.querySelector<HTMLInputElement>('#scrub')!;range.max=String(this.duration-1);range.value=String(this.elapsed);document.querySelector<HTMLInputElement>('#time')!.value=String(Math.round(this.elapsed));document.querySelector('#pause')!.textContent=this.paused?'继续播放':'暂停播放';
 }
 update(_time:number,delta:number){if(this.loading||this.paused||document.hidden)return;this.elapsed+=Math.min(50,delta)*Number(speed.value);if(this.elapsed>this.duration&&!['idle','walk'].includes(actions.value)){this.elapsed=0;this.view.reset();}this.paint();}
}
new Phaser.Game({type:Phaser.WEBGL,parent:'preview',width:1400,height:650,scene:[Preview],audio:{noAudio:true},backgroundColor:'#e5decb',render:{antialias:true},scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH}});
