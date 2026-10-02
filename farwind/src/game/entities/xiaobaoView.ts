import {xiaobaoDiary} from '../systems/xiaobaoLife';
import {HOMES} from '../../data/npcLife';
import Phaser from "phaser";
import { XIAOBAO, XIAOBAO_CLIPS } from "../../data/xiaobao";
import {XIAOBAO_SKILLS, XIAOBAO_TASK_NAMES, XIAOBAO_TACTIC_NAMES} from '../../data/xiaobaoCombat';
import {RAID_GATES} from '../../data/defense';
import {xiaobaoEnvironment} from '../systems/xiaobaoWorld';
import { XiaobaoCombat } from "../systems/xiaobaoCombat";
import { Actor } from "./actor";
import { clearMotionLine } from "../systems/obstacles";
import type { World } from "../scenes/World";

export class XiaobaoView {
  controller = new XiaobaoCombat();
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
  label: Phaser.GameObjects.Text;
  wind: Phaser.GameObjects.Graphics;
  floor: Phaser.GameObjects.Graphics;
  effects: Phaser.GameObjects.Graphics;
  shieldTargets: {id:string;x:number;y:number}[]=[];
  static preload(scene: Phaser.Scene) {
    for (const sheet of ["motion", "social", "mastery", "daily"])
      scene.load.spritesheet(`xiaobao-${sheet}`, `/assets/xiaobao/${sheet}.png`, { frameWidth: XIAOBAO.frameSize, frameHeight: XIAOBAO.frameSize });
    for(const direction of ['front','side','back'])scene.load.spritesheet(`xiaobao-battle-${direction}`,`/assets/xiaobao/battle-${direction}.png`,{frameWidth:160,frameHeight:160});
  }
  constructor(scene: Phaser.Scene) {
    this.shadow = scene.add.ellipse(0, 0, 27, 9, 0x254036, 0.2);
    this.sprite = scene.add.sprite(0, 0, "xiaobao-motion", 0).setOrigin(0.5, XIAOBAO.footY / XIAOBAO.frameSize).setDisplaySize(XIAOBAO.displaySize, XIAOBAO.displaySize);
    this.label = scene.add.text(0, 0, "", { fontSize: "10px", fontFamily: "sans-serif", color: "#334f43", stroke: "#fff7d8", strokeThickness: 3 }).setOrigin(0.5, 0);
    this.wind = scene.add.graphics();
    this.floor=scene.add.graphics().setDepth(2);this.effects=scene.add.graphics();
    this.render(false);
  }
  update(world: World, dt: number) {
    this.controller.update(dt, world.state.time, clearMotionLine);
    this.render(world.state.life.playerSpace === "village");
  }
  reset() { this.controller.reset(); this.render(false); }
  render(visible: boolean, allies?: {id:string;x:number;y:number}[]) {
    if(allies)this.shieldTargets=allies;
    const c = this.controller, pose = c.pose, base=c.data.space==='village'?0:7500;
    this.sprite.setTexture(pose.texture, pose.frame).setPosition(c.x, c.y - pose.lift).setDepth(c.airborne?8800:base+c.y).setVisible(visible);
    Actor.mirror(this.sprite, c.flip);
    this.shadow.setPosition(c.x, c.y - 2).setDepth(base+c.y - 0.5).setScale(Math.max(.4,1-pose.lift/180)).setVisible(visible);
    this.label.setPosition(c.x, c.y + 7).setDepth(c.airborne?8803:base+c.y+2).setText(`小宝 · ${c.data.rest?'护风调息':c.data.flight?'飞援中':c.demonstration?XIAOBAO_CLIPS[c.action].name:XIAOBAO.title}`).setVisible(visible);
    this.wind.clear().setVisible(visible).setDepth(base+c.y + 1);
    if (!c.battleAction&&["palm", "guard", "step"].includes(c.action)) {
      const progress = Math.min(1, c.elapsed / XIAOBAO_CLIPS[c.action].duration), pulse = Math.sin(Math.PI * progress), sign = c.flip ? -1 : 1;
      if (c.action === "palm" && progress >= 1 / 3 && progress < 5 / 6) {
        this.wind.lineStyle(2, 0xd9fff1, pulse * 0.75).strokeEllipse(c.x + sign * (22 + progress * 30), c.y - 27, 12 + progress * 24, 20 + progress * 14);
        this.wind.lineStyle(1, 0x79c7ad, pulse * 0.6).lineBetween(c.x + sign * 18, c.y - 22, c.x + sign * (35 + progress * 32), c.y - 25);
      } else if (c.action === "guard") this.wind.lineStyle(2, 0xbcebdd, pulse * 0.65).strokeEllipse(c.x, c.y - 25, 34 + pulse * 9, 37);
      else if (c.action === "step") this.wind.lineStyle(1.5, 0xc5e8b0, pulse * 0.6).strokeEllipse(c.x, c.y - 2, 28 + pulse * 22, 8 + pulse * 4);
    }
    this.drawSkills(visible);
  }
  drawSkills(visible:boolean){
    const c=this.controller,d=c.data,base=d.space==='village'?0:7500,ground=this.floor.clear().setVisible(visible).setDepth(base+2),ink=this.effects.clear().setVisible(visible).setDepth(c.airborne?8801:base+c.y+3);
    const circle=(x:number,y:number,r:number,color:number,alpha=.5)=>ground.lineStyle(1.7,color,alpha).strokeCircle(x,y,r);
    const cast=d.cast;
    if(cast&&['rock','fire','unity'].includes(cast.skill)&&!cast.released){const s=XIAOBAO_SKILLS[cast.skill];circle(cast.center.x,cast.center.y,s.radius,cast.skill==='fire'?0xf6b36f:0xa4dbcd,.35);ground.fillStyle(0x728874,.08).fillCircle(cast.center.x,cast.center.y,s.radius);}
    for(const e of d.effects){const s=XIAOBAO_SKILLS[e.skill],x=e.center.x,y=e.center.y;
      if(e.skill==='star'||e.skill==='blade'){
        const p=e.last;ink.lineStyle(e.skill==='blade'?4:2,0xa7efcf,.8).lineBetween(p.x-e.direction.x*24,p.y-e.direction.y*24-26,p.x,p.y-26);
        ink.fillStyle(0xffecac,.95).fillCircle(p.x,p.y-26,e.skill==='blade'?8:5);
      }else if(e.skill==='rock'){
        const stage=Math.min(2,e.stage),until=s.times[stage],u=Math.max(0,Math.min(1,(until-e.age)/320));
        circle(x,y,stage?70:110,0xa6d6c4,.4);ground.fillStyle(0x5f705e,.14*(1-u)).fillEllipse(x,y,40,14);
        const height=u*130;ink.fillStyle(0x9b9580,.95).beginPath().moveTo(x-15,y-height-40).lineTo(x+7,y-height-49).lineTo(x+22,y-height-29).lineTo(x+12,y-height-15).lineTo(x-12,y-height-19).closePath().fillPath();
        ink.lineStyle(1.5,0xe2d6ab,.85).lineBetween(x-12,y-height-38,x+6,y-height-43);
      }else if(e.skill==='fire'||e.skill==='unity'){
        const fire=e.skill==='fire'||e.stage>=1&&e.stage<=6;circle(x,y,s.radius,fire?0xeabb79:0xc5e7d5,.52);
        if(fire)for(let i=0;i<14;i++){const angle=i*Math.PI*2/14,r=s.radius*(.45+.45*Math.sin(i*13)**2),xx=x+Math.cos(angle)*r,yy=y+Math.sin(angle)*r,pulse=.5+.5*Math.sin(d.clock/120+i*2);
          ink.fillStyle(0xe8a35a,.4).fillTriangle(xx-5,yy,xx+5,yy,xx+Math.sin(i)*4,yy-13-pulse*10);ink.fillStyle(0xffdf92,.6).fillTriangle(xx-2,yy,xx+2,yy,xx,yy-10-pulse*5);}
      }
    }
    for(const event of c.visuals){const u=(d.clock-event.at)/800,alpha=1-u;
      if(event.kind==='hit'&&(['thunder','chain'].includes(event.skill)||event.skill==='unity'&&event.stage===6)){
        const start=event.skill==='chain'?event.from??event.point:{x:event.point.x-20,y:event.point.y-160},end={x:event.point.x,y:event.point.y-28};
        ink.lineStyle(2.5,0xffedb0,alpha);ink.beginPath();ink.moveTo(start.x,start.y-28);
        for(let i=1;i<=6;i++){const t=i/6;ink.lineTo(start.x+(end.x-start.x)*t+(i===6?0:Math.sin(i*5)*9),start.y-28+(end.y-start.y+28)*t);}ink.strokePath();
      }else if(event.kind==='hit'){ink.lineStyle(2,0xffeac1,alpha).strokeCircle(event.point.x,event.point.y-26,4+u*16);}
      if(event.kind==='release'&&['palm','triple','rescue'].includes(event.skill)){const cast=d.cast,dx=cast?.direction.x??1,dy=cast?.direction.y??0;ink.lineStyle(2.2,0xbbeedc,alpha*.8).strokeEllipse(event.point.x+dx*u*62,event.point.y-27+dy*u*62,22+u*25,30);}
      if(event.kind==='release'&&event.skill==='unity'&&event.stage===0){circle(event.point.x,event.point.y,12+u*100,0xd4dbb7,alpha);for(let i=0;i<7;i++){const angle=i*Math.PI*2/7,r=12+u*65,x=event.point.x+Math.cos(angle)*r,y=event.point.y+Math.sin(angle)*r;ink.fillStyle(0x9b9580,alpha).fillTriangle(x-6,y-12*(1-u),x+6,y-10*(1-u),x,y-23*(1-u));}}
      if(event.kind==='landing')circle(event.point.x,event.point.y,120*u,0xc4efde,alpha*.75);
    }
    for(const shield of d.shields){const target=this.shieldTargets.find(a=>a.id===shield.id);if(target&&target.id!=='xiaobao'&&shield.remaining>0&&shield.amount>0)ink.lineStyle(2,0xbdeadc,.65*Math.min(1,shield.remaining/300)).strokeEllipse(target.x,target.y-25,44,48);}
    const own=d.shields.find(s=>s.id==='xiaobao'&&s.remaining>0&&s.amount>0);
    if(own||d.rest)ink.lineStyle(2,0xbdeadc,.6).strokeEllipse(c.x,c.y-25,44,48);
    if(d.flight){const lift=c.pose.lift;ink.lineStyle(2,0xc6eede,.72).strokeEllipse(c.x,c.y-lift-2,36,11);
      const f=d.flight,dx=f.goal.x-c.x,dy=f.goal.y-c.y,n=Math.max(1,Math.hypot(dx,dy));
      for(let i=1;i<=7;i++){const wave=(d.clock/30+i*7)%66;ink.fillStyle(i%2?0xffeab0:0xa9e4d0,.5*(1-wave/80)).fillCircle(c.x-dx/n*wave,c.y-lift-26-dy/n*wave+(i%3-1)*5,1.8);}}
    if(d.hp<640||d.cast){ink.fillStyle(0x39483c,.8).fillRoundedRect(c.x-24,c.y-c.pose.lift-68,48,4,2);ink.fillStyle(0xbbe19f,1).fillRoundedRect(c.x-24,c.y-c.pose.lift-68,48*d.hp/640,4,2);}
  }
  open(world: World) {
    world.soundFx.play("talk");
    world.state.xiaobao.known=true;
    world.ui.dialog(`${XIAOBAO.name} · ${XIAOBAO.title}`, `“村灯，我看着。一起！”\n${XIAOBAO_TASK_NAMES[this.controller.data.task]} · 生命${Math.ceil(this.controller.data.hp)}/640 · 真气${Math.floor(this.controller.data.qi)}/100\n${this.controller.data.rest?`护风调息还需${(this.controller.data.rest/1000).toFixed(1)}秒`:this.controller.status}`, XIAOBAO.id);
    const diary=document.createElement('details');diary.className='xiaobao-diary';diary.open=true;
    const diaryTitle=document.createElement('summary');diaryTitle.textContent='小宝的心愿与生活日记';
    const copy=document.createElement('p');copy.className='xiaobao-diary-copy';copy.textContent=xiaobaoDiary(world.state);
    const observed=world.state.life.observed.xiaobao;
    const whereabouts=document.createElement('p');whereabouts.textContent=observed?`上次见到：${observed.label}；${HOMES.find(h=>h.id===observed.space)?.name??'村庄与近郊'}`:'还没记录去向，可以到岚爷爷家或广场找我。';
    diary.append(diaryTitle,copy,whereabouts);world.ui.modal.querySelector('#dialog-text')!.after(diary);
    const present=this.controller.data.space===world.state.life.playerSpace&&Math.hypot(this.controller.x-world.state.player.x,this.controller.y-world.state.player.y)<120;
    const feedback=document.createElement('p');feedback.className='xiaobao-feedback';feedback.hidden=true;feedback.setAttribute('role','status');
    const explain=(message:string)=>{feedback.textContent=message;feedback.hidden=false;feedback.scrollIntoView({block:'nearest'});world.ui.message(message);};
    const actions = document.createElement("div");
    actions.className = "xiaobao-actions";
    for (const [kind, label] of [["palm", "请演示听风掌"], ["step", "请演示踏叶轻步"], ["all", "看一套小宗师演武"]] as const) {
      const button = document.createElement("button"); button.textContent = label;
      button.addEventListener("click", () => {
        if(!present){explain('请到小宝身边，再邀请他演武。');return;}if(this.controller.busy||this.controller.data.rest||this.controller.data.life.emergency||this.controller.data.task!=='free'){explain('请在脱战后解除委托，再请小宝演武；完整本领可在演武页查看。');return;}
        const resident=world.state.life.people.find(n=>n.id==='xiaobao')!;if(resident.action){world.state.xiaobao.life.metrics.interrupted++;world.life.cancel(resident,'应邀演武，稍后重新安排生活');}
        this.controller.perform(kind, world.state.player);
        world.ui.close(); world.ui.focusGame();
        world.ui.message(`小宝轻轻抱拳，开始${kind === "all" ? "演武" : kind === "palm" ? "演示听风掌" : "演示踏叶轻步"}。`);
      });
      actions.append(button);
    }
    world.ui.modal.querySelector("#dialog-text")!.after(actions);
    const panel=document.createElement('section');panel.className='xiaobao-management';
    let buttons=document.createElement('div');buttons.className='xiaobao-command-grid';
    const act=(label:string,run:()=>void|Promise<void>)=>{const b=document.createElement('button');b.textContent=label;b.onclick=async()=>{b.disabled=true;feedback.hidden=true;try{await run();}catch(e){explain((e as Error).message);}finally{if(b.isConnected)b.disabled=false;}};buttons.append(b);};
    const saveSetting=async(control:HTMLSelectElement|HTMLInputElement,change:Parameters<World['configureXiaobao']>[0],sync:()=>void)=>{control.disabled=true;feedback.hidden=true;try{await world.configureXiaobao(change);}catch(e){explain((e as Error).message);}finally{sync();if(control.isConnected)control.disabled=false;}};
    for(const [task,label]of [['guard','委托守村'],['follow','与我出征'],['free','自由生活']] as const)act(label,async()=>{if(!present){explain('请到小宝身边，再商量他的安排。');return;}const response=await world.configureXiaobao({task});if(task==='follow'&&world.state.xiaobao.task!=='follow'){explain(response);copy.textContent=xiaobaoDiary(world.state);return;}world.ui.close(true);world.ui.message(response);});
    const gate=document.createElement('select');gate.setAttribute('aria-label','驻防范围');gate.append(new Option('全村巡护','all'),...RAID_GATES.map(g=>new Option(`${g.name}驻防`,g.id)));gate.value=this.controller.data.gate;
    gate.onchange=()=>{void saveSetting(gate,{gate:gate.value as typeof this.controller.data.gate},()=>{gate.value=this.controller.data.gate;});};
    const tactic=document.createElement('select');tactic.setAttribute('aria-label','小宝战术');for(const [id,name]of Object.entries(XIAOBAO_TACTIC_NAMES))tactic.append(new Option(name,id));tactic.value=this.controller.data.tactic;
    tactic.onchange=()=>{void saveSetting(tactic,{tactic:tactic.value as typeof this.controller.data.tactic},()=>{tactic.value=this.controller.data.tactic;});};
    const support=document.createElement('p');support.textContent='村庄有难时，小宝会优先保护大家。';
    const errands=buttons;
    buttons=document.createElement('div');buttons.className='xiaobao-command-grid';
    const tactics=document.createElement('details'),tacticsTitle=document.createElement('summary');tacticsTitle.textContent='驻防、战术与战斗指令';tactics.append(tacticsTitle,gate,tactic,buttons);
    panel.append(support,feedback,errands,tactics);
    for(const [kind,label]of [['focus','集火当前目标'],['protect','保护我'],['wait','在此等候'],['return','归队'],['rock','落石压制'],['fire','火域封路'],['thunder','天雷点杀'],['unity','五行归元']] as const)act(label,()=>{if(this.controller.data.life.emergency){explain('村庄仍有危险，小宝正在护村。');return;}this.controller.command(kind,xiaobaoEnvironment(world));world.ui.close(true);world.ui.message(`小宝收到：${label}`);});
    const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='查看十二项本领与守村回报';details.append(summary);
    for(const [key,s]of Object.entries(XIAOBAO_SKILLS)){const row=document.createElement('p');row.textContent=`${s.name} · ${s.range}距离 · ${s.damage.reduce((a,b)=>a+b,0)}原始伤害 · 耗气${s.qi} · 冷却${s.cooldown/1000}秒${this.controller.data.cooldowns[key as keyof typeof XIAOBAO_SKILLS]>0?`（还需${(this.controller.data.cooldowns[key as keyof typeof XIAOBAO_SKILLS]/1000).toFixed(1)}秒）`:''}`;if(key==='chain')row.textContent+='；五个不同目标合计520';if(key==='guard'||key==='flight')row.textContent+='；每人120护盾，最多五人';details.append(row);}
    for(const report of this.controller.data.reports){const row=document.createElement('p');row.textContent=`${RAID_GATES.find(g=>g.id===report.gate)!.name} · ${report.result} · 命中${report.hits}、击退${report.kills} · ${report.injured?'有人受伤':'未收到伤情报告'}`;details.append(row);}
    const link=document.createElement('a');link.href='/xiaobao-combat-preview.html';link.target='_blank';link.rel='noopener';link.textContent='打开完整技能演武页';details.append(link);panel.append(details);actions.after(panel);world.ui.modal.querySelector('#dialog-text')!.after(diary);
  }
  snapshot() { return { ...this.controller.snapshot(), visible: this.sprite.visible, spriteRoot: [this.sprite.x, this.sprite.y], objects: 6, provisional: true }; }
}
