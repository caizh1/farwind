import Phaser from 'phaser';
import {Actor} from './game/entities/actor';
import {hurtVisual} from './data/animation';
import {PLAYER_HURT} from './game/systems/combat';
import type {Facing} from './game/systems/locomotion';
if(!import.meta.env.DEV)throw Error('受击固定预览只供本地审阅');
class Preview extends Phaser.Scene {
  normal!:Actor;hurt!:Actor;elapsed=80;playing=false;
  preload(){
    this.load.spritesheet('hero','/assets/hero.png',{frameWidth:128,frameHeight:128});
    this.load.spritesheet('hero-motion','/assets/animation/round-three/hero-motion.png',{frameWidth:128,frameHeight:128});
    this.load.spritesheet('hero-hurt','/assets/animation/hero-hurt.png',{frameWidth:160,frameHeight:160});
    this.load.image('hero-carry-sword','/assets/animation/hero-carry-sword.png');
  }
  create(){
    this.normal=new Actor(this,220,280);this.hurt=new Actor(this,500,280);
    this.add.text(155,310,'当前待机',{fontSize:'18px',color:'#263c34'});this.add.text(435,310,'受击动作',{fontSize:'18px',color:'#263c34'});
    const ink=this.add.graphics().lineStyle(1,0x157c78);for(const x of [220,500])ink.lineBetween(x-16,280,x+16,280).lineBetween(x,272,x,288);
    document.querySelector<HTMLSelectElement>('#direction')!.onchange=()=>this.paint();
    document.querySelector<HTMLInputElement>('#scrub')!.oninput=e=>{this.playing=false;this.elapsed=Number((e.target as HTMLInputElement).value);this.paint();};
    document.querySelector<HTMLButtonElement>('#play')!.onclick=()=>{this.playing=!this.playing;this.elapsed=0;this.paint();};
    Object.defineProperty(window,'__hurtPreview',{configurable:true,value:()=>({时间:this.elapsed,播放:this.playing,待机:this.normal.debug(),受击:this.hurt.debug()})});this.paint();
  }
  paint(){
    const facing=Number(document.querySelector<HTMLSelectElement>('#direction')!.value) as Facing;
    this.normal.motion.direction=facing;this.normal.draw(220,280);
    this.hurt.draw(500,280,hurtVisual({start:0,until:PLAYER_HURT.duration,facing,direction:{x:0,y:1},root:{x:500,y:280}},this.elapsed));
    document.querySelector('#info')!.textContent=`${Math.round(this.elapsed)}／220 毫秒 · ${this.elapsed<55?'缩身受力':this.elapsed<140?'后仰峰值':'稳住恢复'} · 脚底根保持固定`;
    document.querySelector<HTMLInputElement>('#scrub')!.value=String(Math.min(219,this.elapsed));
    document.querySelector('#play')!.textContent=this.playing?'暂停':'播放';
  }
  update(_time:number,delta:number){if(this.playing&&!document.hidden){this.elapsed=(this.elapsed+Math.min(delta,50))%PLAYER_HURT.duration;this.paint();}}
}
new Phaser.Game({type:Phaser.WEBGL,parent:'preview',width:720,height:360,scene:[Preview],audio:{noAudio:true},backgroundColor:'#e7e4d6',scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH}});
