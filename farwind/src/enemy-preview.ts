import Phaser from 'phaser';
import {enemyProfile,type EnemyKind} from './data/enemies';
import {EnemyAnimation,type EnemyPose} from './game/systems/enemyAnimation';
import {EnemyView} from './game/entities/enemyView';
import {Actor} from './game/entities/actor';
import {createEnemyAttack} from './game/systems/enemyAttack';
import {SLIME_TIMES} from './game/systems/slimeAnimation';
import type {Facing} from './game/systems/locomotion';
import './slime-preview.css';
if(!import.meta.env.DEV)throw Error('动画固定预览只供本地审阅');
const select=(id:string)=>document.querySelector<HTMLSelectElement>('#'+id)!;
class Preview extends Phaser.Scene{
  elapsed=0;paused=false;actual!:Phaser.GameObjects.Sprite;large!:Phaser.GameObjects.Sprite;background!:Phaser.GameObjects.Image;pose!:EnemyPose;
  kind:EnemyKind='slime';action='idle';facing:Facing=0;
  preload(){EnemyView.preload(this);for(const [key,path] of [['forest-day','forest-day'],['village-night','village-night']])this.load.image(key,`/docs/enemy-design-v2/references/${path}.webp`);this.load.spritesheet('hero-motion','/assets/animation/round-three/hero-motion.png',{frameWidth:128,frameHeight:128});}
  duration(){if(this.action==='attack'){const a=createEnemyAttack('preview',1,this.kind,0,{x:0,y:0},{x:1,y:0});return a.recoveryUntil;}if(this.action==='wall')return 850;if(this.action==='walk')return enemyProfile(this.kind).stride/enemyProfile(this.kind).speed*1000;if(this.action==='death'&&this.kind!=='slime')return 1300;return (SLIME_TIMES[this.action as keyof typeof SLIME_TIMES]??SLIME_TIMES.idle).reduce((a,b)=>a+b,0);}
  create(){
    this.background=this.add.image(480,300,'forest-day').setDisplaySize(960,600).setAlpha(.72);
    this.add.rectangle(230,300,450,530,0xeee8d8,.95);this.add.rectangle(710,300,450,530,0xeee8d8,.8);
    this.large=this.add.sprite(230,470,'enemy-slime');this.actual=this.add.sprite(620,440,'enemy-slime');this.add.sprite(795,440,'hero-motion',9).setOrigin(.5,124/128).setDisplaySize(86,92);
    this.add.text(75,520,'三倍显示 · 检查姿态',{fontSize:'20px',color:'#243e35'});this.add.text(520,520,'游戏原尺寸 · 与现有主角对照',{fontSize:'18px',color:'#243e35'});
    const ink=this.add.graphics().lineStyle(1,0x117e87);for(const [x,y] of [[230,470],[620,440]])ink.lineBetween(x-10,y,x+10,y).lineBetween(x,y-8,x,y+8);
    for(const id of ['enemy','action','direction'])select(id).onchange=()=>{this.elapsed=0;this.paint();};select('background').onchange=()=>this.background.setTexture(select('background').value);
    document.querySelector<HTMLButtonElement>('#pause')!.onclick=()=>{this.paused=!this.paused;this.paint();};document.querySelector<HTMLButtonElement>('#restart')!.onclick=()=>{this.elapsed=0;this.paint();};document.querySelector<HTMLInputElement>('#scrub')!.oninput=e=>{this.paused=true;this.elapsed=Number((e.target as HTMLInputElement).value);this.paint();};
    Object.defineProperty(window,'__enemyPreview',{value:()=>({kind:this.kind,action:this.action,facing:this.facing,pose:this.pose,elapsed:this.elapsed,paused:this.paused,root:[620,440],provisional:true}),configurable:true});this.paint();
  }
  paint(){
    this.kind=select('enemy').value as EnemyKind;this.action=select('action').value;this.facing=Number(select('direction').value) as Facing;
    if(this.action==='wall'&&this.kind!=='boar'){this.action='idle';select('action').value='idle';}
    const p=enemyProfile(this.kind),d=this.facing===0?{x:0,y:1}:this.facing===1?{x:0,y:-1}:{x:this.facing===2?-1:1,y:0},anim=new EnemyAnimation(),now=Math.min(this.elapsed,this.duration()-1),body={x:0,y:0,hp:p.hp as number,type:this.kind,parried:undefined as any,wallHit:undefined as any};
    anim.motion.facing=this.facing;
    if(this.action==='walk')anim.motion.last={x:-d.x*now/1000*p.speed,y:-d.y*now/1000*p.speed,hp:p.hp,now:0};
    if(this.action==='hurt'){body.hp--;anim.motion.hurtAt=0;}
    if(this.action==='death'){body.hp=0;anim.motion.deathAt=0;}
    if(this.action==='parry'||this.action==='perfect')body.parried={at:0,until:this.duration(),direction:d,perfect:this.action==='perfect'};
    if(this.action==='wall')body.wallHit={at:0,until:850};
    const attack=this.action==='attack'?createEnemyAttack('preview',1,this.kind,0,body,d):null;this.pose=anim.sample(body,attack,now);
    for(const [sprite,scale] of [[this.actual,1],[this.large,3]] as const){sprite.setTexture(`enemy-${this.kind}`,this.pose.frame).setOrigin(.5,110/128).setDisplaySize(160*p.height/60*scale,160*p.height/60*scale);Actor.mirror(sprite,this.pose.facing===2);}
    document.querySelector('#info')!.textContent=`${p.name} · 第${this.pose.index+1}姿态 · ${this.pose.phase==='charge'?'蓄力':this.pose.phase==='commit'?'锁向（前摇内）':this.pose.phase==='active'?'有效出手':this.pose.phase==='recovery'?'收招':this.pose.phase==='stagger'?'失衡':select('action').selectedOptions[0].textContent} · ${Math.round(now)}／${Math.round(this.duration())}毫秒`;
    const range=document.querySelector<HTMLInputElement>('#scrub')!;range.max=String(this.duration()-1);range.value=String(now);document.querySelector('#pause')!.textContent=this.paused?'继续播放':'暂停';
  }
  update(_time:number,delta:number){if(this.paused||document.hidden)return;this.elapsed+=Math.min(delta,50);if(this.elapsed>this.duration()+600)this.elapsed=0;this.paint();}
}
new Phaser.Game({type:Phaser.WEBGL,parent:'preview',width:960,height:600,scene:[Preview],audio:{noAudio:true},backgroundColor:'#eee8d8',render:{antialias:true},scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH}});
