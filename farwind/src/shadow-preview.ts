import Phaser from 'phaser';
import {EnemyView} from './game/entities/enemyView';
import {ENEMIES,enemyProfile} from './data/enemies';
import {CAMP_BOSSES,type CampBossKind} from './data/maps/windbell/campBosses';
import {initialBossBattle} from './game/systems/campBossState';
import {createEnemyAttack} from './game/systems/enemyAttack';
import {createBossAttack} from './game/systems/campBossCombat';
import {groundShadows} from './game/rendering/groundShadows';
import {enemyShadowSize} from './game/rendering/shadowGeometry';
import type {EnemyBody} from './game/systems/enemy';
if(!import.meta.env.DEV)throw Error('阴影固定对照只供本地审阅。');
const select=(id:string)=>document.querySelector<HTMLSelectElement>('#'+id)!;
for(const [kind,d] of Object.entries(CAMP_BOSSES))select('boss').add(new Option(d.name,kind));
class ShadowPreview extends Phaser.Scene {
  view!:EnemyView;samples:{body:EnemyBody;sprite:Phaser.GameObjects.Sprite;shadow:Phaser.GameObjects.Ellipse}[]=[];
  elapsed=0;paused=false;enhanced=true;ready=false;
  preload(){EnemyView.preload(this);for(const key of ['grass','forest','road'])this.load.image(key,`/assets/${key}.png`);}
  create(){
    const ground=this.add.tileSprite(700,490,1400,980,'grass').setTileScale(.5).setDepth(-1000);
    select('ground').onchange=()=>{ground.setTexture(select('ground').value).setTileScale(select('ground').value==='road'?.21:.5);};
    this.view=new EnemyView(this);
    this.data.set('shadowSettings',()=>({time:Number(select('light').value)||480,indoor:select('light').value==='indoor',floor:-950}));
    const definitions=[...Object.entries(ENEMIES).map(([type,d],i)=>({type,name:d.name,x:100+i%7*200,y:180+Math.floor(i/7)*240,boss:undefined as CampBossKind|undefined})),
      {type:CAMP_BOSSES['spore-heart'].type,name:'首领阴影 · 使用上方选择器切换',x:700,y:860,boss:'spore-heart' as CampBossKind}];
    for(const d of definitions){
      const sprite=this.add.sprite(d.x,d.y,'enemy-slime'),[w,h]=enemyShadowSize(d.type,d.boss?CAMP_BOSSES[d.boss].height:undefined),shadow=this.add.ellipse(d.x,d.y-3,w,h,0x18392d,.2);
      const body={id:d.name,type:d.type,x:d.x,y:d.y,homeX:d.x,homeY:d.y,hp:enemyProfile(d.type).hp,boss:d.boss,bossBattle:d.boss?initialBossBattle(0):undefined,attackSerial:0,bossAttempt:0} as EnemyBody;
      this.samples.push({sprite,shadow,body});
      groundShadows(this).add(sprite,shadow,{label:d.boss?'首领':d.name,visible:()=>this.view.boss.visible(sprite),surfaceDepth:()=>-950});
      this.add.text(d.x,d.y+50,d.name,{fontSize:'17px',color:'#fff7da',stroke:'#293a27',strokeThickness:4}).setOrigin(.5).setDepth(9000);
    }
    document.querySelector<HTMLButtonElement>('#toggle')!.onclick=()=>{this.enhanced=!this.enhanced;this.paint();};
    document.querySelector<HTMLButtonElement>('#pause')!.onclick=()=>{this.paused=!this.paused;this.paint();};
    for(const id of ['direction','action','light'])select(id).onchange=()=>{this.elapsed=0;this.view.reset();this.paint();};
    select('boss').onchange=()=>void this.chooseBoss();
    (window as unknown as {__shadowPreview:()=>unknown}).__shadowPreview=()=>({就绪:this.ready,增强:this.enhanced,暂停:this.paused,时钟:this.elapsed,阴影:groundShadows(this).snapshot()});
    void this.chooseBoss();
  }
  async chooseBoss(){
    this.ready=false;this.elapsed=0;this.view.reset();const sample=this.samples.at(-1)!,kind=select('boss').value as CampBossKind;
    sample.shadow.setVisible(false);sample.sprite.setVisible(false);sample.body.boss=kind;sample.body.type=CAMP_BOSSES[kind].type;
    sample.body.bossBattle=initialBossBattle(0);select('boss').disabled=true;
    try{await this.view.boss.assets.ensure(kind);this.ready=true;this.paint();}catch(e){document.querySelector('#status')!.textContent=(e as Error).message;}finally{select('boss').disabled=false;}
  }
  paint(){
    if(!this.ready)return;this.view.begin();const action=select('action').value,d=Number(select('direction').value),face=d===0?{x:0,y:1}:d===1?{x:0,y:-1}:{x:d===2?-1:1,y:0};
    for(const {body,sprite,shadow} of this.samples){
      body.face=face;body.hp=action==='death'?0:enemyProfile(body.type).hp;
      let attack=action==='attack'?(body.boss?createBossAttack(body,0,{x:body.x+face.x*160,y:body.y+face.y*160},body.bossBattle!):createEnemyAttack(body.id,0,body.type,0,body,{x:body.x+face.x*160,y:body.y+face.y*160})):null;
      const now=action==='attack'?this.elapsed%Math.max(2000,attack!.recoveryUntil+800):action==='death'?Math.min(2400,this.elapsed):this.elapsed;
      this.view.draw(body,attack,sprite,now);
      const motion=body.boss?this.view.boss.entries.get(sprite)?.motion:this.view.entries.get(sprite)?.motion.motion;
      if(motion){motion.facing=d as 0|1|2|3;if(action==='death')motion.deathAt=0;if(action==='walk'){motion.distance=now*.07;motion.last={x:body.x-face.x*7,y:body.y-face.y*7,hp:body.hp,now:now-100};}}
      this.view.draw(body,attack,sprite,now);
      const [w,h]=this.enhanced?enemyShadowSize(body.type,body.boss?CAMP_BOSSES[body.boss].height:undefined):[body.boss?CAMP_BOSSES[body.boss].height*.56:45,body.boss?CAMP_BOSSES[body.boss].height*.18:15];
      shadow.setSize(w,h).setVisible(this.view.boss.visible(sprite)).setDepth(body.y-.5).setAlpha((this.enhanced?1:.2)*sprite.alpha);
      shadow.setFillStyle(0x18392d,this.enhanced?0:1);
    }
    groundShadows(this).enabled=this.enhanced;groundShadows(this).draw();
    document.querySelector('#toggle')!.textContent=this.enhanced?'查看原阴影':'查看增强阴影';
    document.querySelector('#pause')!.textContent=this.paused?'继续动画':'暂停动画';
    document.querySelector('#status')!.textContent=(this.enhanced?'增强阴影：柔边接地影与轮廓投影':'原阴影：统一小椭圆')+' · 十四种小怪与'+CAMP_BOSSES[this.samples.at(-1)!.body.boss!].name+' · '+Math.round(this.elapsed)+'毫秒';
  }
  update(_time:number,dt:number){if(!this.ready)return;if(!this.paused&&!document.hidden)this.elapsed+=Math.min(50,dt);this.paint();}
}
new Phaser.Game({type:Phaser.WEBGL,parent:'preview',width:1400,height:980,scene:[ShadowPreview],audio:{noAudio:true},render:{antialias:true},scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH}});
