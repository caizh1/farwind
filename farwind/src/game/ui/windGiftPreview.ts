import {WIND_GIFTS,GIFT_RESONANCES} from '../systems/windGifts';
import {WIND_GIFT_ART,GIFT_MATERIALS,type GiftVisualId} from '../entities/windGiftArt';
import {paintWindGiftFx} from '../entities/windGiftVfx';
import {GIFT_MATERIAL_URL,clamp,smooth} from '../entities/windGiftChoreography';
import {canvasInk,paintRuneFx} from '../entities/runeView';
import {combatVisual,swordWindVisual,parryVisual,clipFor} from '../../data/animation';
import {resolveStrike} from '../systems/combat';
import {DEMO_INTRO,DEMO_ACTION_TIME,DEMO_CONTACT,demoSample,demoTimeline,demoEffect,type DemoAction} from './windGiftDemo';
import {CHAIN_LIGHTNING} from '../entities/chainLightning';

// 只播放独立教学时间轴，复用主角正式动作与材质，不创建或修改游戏状态。
const images=new Map<string,HTMLImageElement>();
const asset=(file:string)=>`${import.meta.env.BASE_URL}assets/${file}`;
const sprites={
 'hero-motion':['animation/round-three/hero-motion.png',128,124,155],
 'hero-combat-side':['animation/hero-combat-side.png',160,154,260],
 'hero-melee-finisher':['animation/hero-melee-finisher.png',160,154,260],
 'hero-sword-wind':['animation/sword-wind/hero-sword-wind.png',160,154,260],
 'hero-parry-v2':['animation/hero-parry-v2.png',160,154,260],
 'hero-hurt':['animation/hero-hurt.png',160,154,260],
 slime:['slime.png',128,124,130],
 xiaobao:['xiaobao/motion.png',160,148,180],
 'xiaobao-attack':['xiaobao/battle-side.png',160,148,180],
} as const;
function imageFor(url:string){let image=images.get(url);if(!image){image=new Image();image.src=url;images.set(url,image);}return image;}
const ready=(image:HTMLImageElement)=>image.complete&&image.naturalWidth>0;
export const giftVisualName=(id:GiftVisualId)=>Object.hasOwn(WIND_GIFTS,id)?WIND_GIFTS[id as keyof typeof WIND_GIFTS].name:GIFT_RESONANCES[id as keyof typeof GIFT_RESONANCES].name;
export function giftPreviewMarkup(selected:GiftVisualId='blade',open=false){return `<details class="gift-preview" ${open?'open':''}><summary>主角使用示例 · 看懂这份风赐</summary><div class="gift-preview-controls"><label>查看使用示例<select id="gift-visual-choice">${Object.keys(WIND_GIFT_ART).map(key=>{const id=key as GiftVisualId;return `<option value="${id}" ${selected===id?'selected':''}>${giftVisualName(id)}${Object.hasOwn(GIFT_RESONANCES,id)?' · 共鸣':''}</option>`;}).join('')}</select></label><button type="button" id="gift-visual-pause" aria-pressed="false">暂停</button><button type="button" id="gift-visual-replay">重新演示</button></div><div class="gift-demo-heading"><strong id="gift-demo-title"></strong><span>主角动作 · 触发过程 · 实际收益</span></div><canvas id="gift-visual-canvas" width="900" height="360" aria-label="主角使用风赐的动画示例"></canvas><ol class="gift-demo-steps" aria-label="演示进度"><li data-demo-step="prepare"><span>01</span>使用条件</li><li data-demo-step="action"><span>02</span>主角行动</li><li data-demo-step="result"><span>03</span>风赐收益</li></ol><p id="gift-demo-caption"></p><p id="gift-visual-description"></p><small>教学示例，动作适度放慢；生命条与目标反应用于说明效果，实际数值、概率和限制以文字为准。</small></details>`;}

function sprite(g:CanvasRenderingContext2D,key:keyof typeof sprites,frame:number,x:number,y:number,alpha=1,scaleX=1,scaleY=1){
 const [file,size,foot,display]=sprites[key],image=imageFor(asset(file));if(!ready(image))return;
 const cols=Math.floor(image.naturalWidth/size);g.save();g.globalAlpha=alpha;g.translate(x,y);g.scale(scaleX,scaleY);g.drawImage(image,frame%cols*size,Math.floor(frame/cols)*size,size,size,-display/2,-foot/size*display,display,display);g.restore();
}
function stamp(g:CanvasRenderingContext2D,file:string,frame:number,size:number,x:number,y:number,w:number,h:number,a=1){
 const image=imageFor(asset(file));if(!ready(image))return;const cols=image.naturalWidth/size;g.save();g.globalAlpha=a;g.drawImage(image,frame%cols*size,Math.floor(frame/cols)*size,size,size,x-w/2,y-h/2,w,h);g.restore();
}
function shadow(g:CanvasRenderingContext2D,x:number,y:number,width=32){g.fillStyle='#0b171944';g.beginPath();g.ellipse(x,y+1,width,9,0,0,Math.PI*2);g.fill();}
function bar(g:CanvasRenderingContext2D,x:number,y:number,ratio:number,color:string,label:string){g.fillStyle='#142e31';g.fillRect(x-43,y,86,6);g.fillStyle=color;g.fillRect(x-43,y,86*clamp(ratio),6);g.fillStyle='#e4e6cf';g.font='12px sans-serif';g.textAlign='center';g.fillText(label,x,y-8);}
function actionX(action:DemoAction|undefined){return action==='J'||action==='终结'||action==='清场'?416:action==='L'||action==='移动'?410:235;}
function heroX(sample:ReturnType<typeof demoSample>){
 const actions=sample.plan.actions;
 if(sample.index<0)return 235;
 if(!sample.action)return actionX(actions.at(-1));
 const previous=sample.index===0?235:actionX(actions[sample.index-1]),target=actionX(sample.action);
 return previous+(target-previous)*smooth(sample.local/(sample.action==='移动'||sample.action==='L'?450:200));
}
function hero(g:CanvasRenderingContext2D,action:DemoAction|undefined,local:number,x:number,y:number,age:number,alpha=1,comboStage=1){
 shadow(g,x,y);
 if(action==='I'){const move={...resolveStrike(1),windup:220,active:130,recovery:300};const pose=swordWindVisual(3,local,move);sprite(g,'hero-sword-wind',pose.frame,x,y,alpha);}
 else if(action==='J'||action==='终结'||action==='清场'){
  const stage=action==='J'?comboStage:4,move={...resolveStrike(stage),windup:300,active:130,recovery:280};const pose=combatVisual(stage,3,local,false,move);sprite(g,pose.texture as keyof typeof sprites,pose.frame,x,y,alpha);
 }else if(action==='K'){const pose=parryVisual({start:0,facing:3,successAt:local>=DEMO_CONTACT?DEMO_CONTACT:undefined} as Parameters<typeof parryVisual>[0],local);sprite(g,'hero-parry-v2',pose.frame,x,y,alpha);}
 else if(action==='受击'&&local>=DEMO_CONTACT&&local<590)sprite(g,'hero-hurt',6+(local<440?0:1),x,y,alpha);
 else{const walking=action==='移动'||action==='L'||(action&&(actionX(action)===416)&&local<200),clip=clipFor(false,3,walking?'run':'idle');sprite(g,'hero-motion',clip.frames[Math.floor(age/85)%clip.frames.length],x,y,alpha);}
}
const companionIds=new Set<GiftVisualId>(['sharedHeart','protectCompanion','relayEdge','returningBreath','sideBySide','relayTogether','guardedReturn']);
const healthIds=new Set<GiftVisualId>(['potion','spring','drinkDew','stopBleeding','lingeringGrace','springGrace','dewSpring','windBone','guardedReturn']);
const staminaIds=new Set<GiftVisualId>(['breath','poise','longBreath','finalBreath','returningBreath','cyclicBreath','breathCycle','dualityFlow','thrift']);
const shieldIds=new Set<GiftVisualId>(['firstVeil','lingeringGrace','springGrace','armoredVeil','protectCompanion','guardedReturn','dualityFlow']);
const pullIds=new Set<GiftVisualId>(['curledWind','windHunt','blackHole']);

export function paintGiftPreview(g:CanvasRenderingContext2D,id:GiftVisualId,age:number,simple=false,lowFlash=false){
 const s=demoSample(id,age),x=heroX(s),y=258,art=WIND_GIFT_ART[id],color=GIFT_MATERIALS[art.motion].color;
 const fxAge=age-s.effectAt,activated=fxAge>=0,benefit=smooth(fxAge/350),companion=companionIds.has(id);
 g.save();g.globalAlpha=1;
 const bg=g.createLinearGradient(0,0,0,360);bg.addColorStop(0,'#142f36');bg.addColorStop(1,'#38534b');g.fillStyle=bg;g.fillRect(0,0,900,360);
 const light=g.createRadialGradient(460,210,30,460,210,350);light.addColorStop(0,'#76806d45');light.addColorStop(1,'#76806d00');g.fillStyle=light;g.fillRect(0,0,900,360);
 g.fillStyle='#8c997429';g.beginPath();g.ellipse(450,270,368,68,0,0,Math.PI*2);g.fill();g.strokeStyle='#b4b48c38';g.lineWidth=1;g.stroke();
 // 固定地面细节不参与动作，不以旋转圆环充当演示主体。
 g.strokeStyle='#93ab8940';for(let i=0;i<22;i++){const px=100+i*33,py=293+(i*17%31);g.beginPath();g.moveTo(px,py);g.lineTo(px-3,py-5);g.moveTo(px,py);g.lineTo(px+4,py-7);g.stroke();}
 g.textAlign='left';g.font='13px sans-serif';g.fillStyle='#d7dbbf';g.fillText('演示场 · '+(companion?'主角与小宝':'主角与目标'),28,30);g.textAlign='right';g.fillStyle='#a5bab5';g.fillText('使用过程放慢展示',872,30);
 const positions=Array.from({length:s.plan.enemies},(_,i)=>({x:560+i*115,y:y}));
 if(id==='longEdge')positions[0].x=730;
 if(id==='broadWind'&&positions[1])positions[1]={x:575,y:y+47};
 if(id==='chain'){positions[1]={x:675,y:185};positions[2]={x:720,y:300};}
 if(id==='residualWind'||id==='residualTide')positions.forEach((p,i)=>{p.x=310+i*75;p.y=y+22;});
 if(id==='returningTide')positions.forEach((p,i)=>{p.x=440+i*65;p.y=y+22;});
 if(id==='escapeCircle'){positions[0]={x:275,y:y-15};positions[1]={x:195,y:y+28};positions[2]={x:310,y:y+43};}
 let recentHit=-Infinity,hitCount=0;
 s.plan.actions.forEach((action,i)=>{const at=DEMO_INTRO+i*DEMO_ACTION_TIME+DEMO_CONTACT;if((['I','J','终结','小宝','清场'].includes(action)||(action==='L'&&['residualWind','residualTide'].includes(id)))&&age>=at){recentHit=Math.max(recentHit,at);hitCount++;}});
 const hitAge=age-recentHit,hitPulse=hitAge<260?Math.sin(clamp(hitAge/260)*Math.PI):0;
 const damage=s.plan.actions.some(a=>['I','J','终结','小宝','清场'].includes(a))||id==='residualWind'||id==='residualTide';
 positions.forEach((p,i)=>{
  if(pullIds.has(id)&&i>0&&activated){const center=positions[0];p.x+=(center.x-p.x)*smooth(fxAge/700)*.68;p.y+=(center.y-p.y)*smooth(fxAge/700)*.68;}
  const dead=s.plan.actions.includes('清场')&&activated,fade=dead?Math.max(0,1-fxAge/500):1;
  const native=i===0||['pierceCurtain','oneLineArmy','broadWind','residualWind'].includes(id),effectContact=s.effectAt+(id==='chain'&&i>0?(i-1)*CHAIN_LIGHTNING.jumpDelay*1.8:0);
  const derived=damage&&age>=effectContact&&(s.plan.target==='enemy'||s.plan.target==='path')&&(id!=='chain'||i>0),pulse=native?hitPulse:derived?Math.sin(clamp((age-effectContact)/260)*Math.PI):0;
  shadow(g,p.x,p.y,25);sprite(g,'slime',0,p.x+pulse*9,p.y,fade,1+pulse*.13,1-pulse*.13);
  bar(g,p.x,p.y-99,dead?0:1-(native?hitCount*.12:0)-(derived?.2:0),'#df927c',dead?'已击败':id==='clearPath'?'远程目标（示意）':i===0?'目标':'附近敌人');
  if(activated&&['holdWind','delayedEdge','windHunt','returningTide','residualTide'].includes(id)){g.fillStyle='#b9ecdf';g.font='14px sans-serif';g.textAlign='center';g.fillText('减速',p.x,p.y+25);}
  if(activated&&['breakStance','suppressField'].includes(id)){g.fillStyle='#e8d698';g.font='14px sans-serif';g.textAlign='center';g.fillText('失衡',p.x,p.y+25);}
 });
 // 敌方攻击向主角飞来，接触、弹反和风步的因果过程可见。
 if(s.action==='K'||s.action==='受击'||s.action==='L'){
  if(s.local<DEMO_CONTACT){const t=clamp(s.local/DEMO_CONTACT),px=560+(235-560)*t;stamp(g,'animation/sword-wind/sword-wind-flight.png',Math.floor(s.local/70)%6,128,px,y-72,55,55,.65);g.fillStyle='#efba9a';g.textAlign='center';g.font='14px sans-serif';g.fillText('来袭攻击',540,130);}
  else if(s.local<650){g.fillStyle='#e4eccb';g.textAlign='center';g.font='16px sans-serif';g.fillText(s.action==='K'?'弹反成功':s.action==='L'?'躲过攻击':'攻击接触',x,y-165);}
 }
 if(s.action==='L'&&!simple&&!lowFlash)for(let i=3;i>0;i--)hero(g,'L',s.local-i*40,x-i*27,y,age-i*40,.12);
 const comboStage=Math.min(3,s.plan.actions.slice(0,s.index+1).filter(a=>a==='J').length)||1;
 hero(g,s.action,s.local,x,y,age,1,comboStage);
 g.fillStyle='#ecdec0';g.font='15px sans-serif';g.textAlign='center';g.fillText('主角',x,y+28);
 const hpBase=id==='unyielding'?.25:id==='fullWind'?.9:healthIds.has(id)?.56:1;
 bar(g,x,y-182,hpBase+(healthIds.has(id)&&id!=='guardedReturn'?.23*benefit:0)-(s.plan.actions.includes('受击')&&!healthIds.has(id)&&activated?.08:0),'#b8d69e',id==='windBone'?'最大生命增加':'生命');
 bar(g,x,y-157,.55+(staminaIds.has(id)?.3*benefit:0),'#d6c58d',id==='longBreath'?'最大体力增加':'体力');
 if(shieldIds.has(id)&&activated&&s.plan.target!=='companion'){g.strokeStyle='#b9e3ed';g.lineWidth=3;g.strokeRect(x-45,y-186,90,13);}
 if(companion){const attack=s.action==='小宝',px=attack?360+smooth(s.local/260)*145:345,py=y+24;shadow(g,px,py,24);sprite(g,attack?'xiaobao-attack':'xiaobao',attack?Math.min(7,Math.floor(s.local/90)):0,px,py);g.fillStyle='#ecdec0';g.font='15px sans-serif';g.textAlign='center';g.fillText('小宝',px,py+28);if(s.plan.target==='companion'){bar(g,px,py-147,.6+(id==='guardedReturn'?.23*benefit:0),'#b8d69e','伙伴生命');if(activated){g.strokeStyle='#b9e3ed';g.lineWidth=3;g.strokeRect(px-45,py-151,90,13);}}}
 if(s.action==='药剂'&&s.local<600){g.fillStyle='#b7e7c0';g.font='18px sans-serif';g.textAlign='center';g.fillText('使用药剂',x+90,y-82);stamp(g,'icon-potion.png',0,96,x+78,y-125,38,38);}
 // 剑风从主角向目标飞行；近战特效出现在剑与目标接触的位置。
 if(s.action==='I'&&s.local>=220&&s.local<DEMO_CONTACT+100){const t=clamp((s.local-220)/(DEMO_CONTACT-220)),p=positions[['pierceCurtain','oneLineArmy'].includes(id)?positions.length-1:0];stamp(g,id==='blackHole'?'animation/black-hole-slash/flight.png':'animation/sword-wind/sword-wind-flight.png',Math.floor(s.local/60)%6,id==='blackHole'?256:128,x+68+(p.x-x-68)*t,y-70,125,id==='broadWind'?170:100,lowFlash?.5:.9);}
 if(hitPulse>0&&!simple)stamp(g,'animation/sword-wind/sword-wind-hit.png',Math.min(5,Math.floor(hitAge/50)),128,positions[0].x,y-65,80,100,lowFlash?.35:.7);
 const ink=canvasInk(g);ink.giftMaterial=(material,px,py,width,height,alpha,rotation)=>{const image=imageFor(GIFT_MATERIAL_URL());if(!ready(image))return;g.save();g.globalAlpha=alpha;g.translate(px,py);g.rotate(rotation);g.drawImage(image,material%6*256,Math.floor(material/6)*256,256,256,-width/2,-height/2,width,height);g.restore();};
 const target=s.plan.target==='enemy'?positions[id==='oneLineArmy'?1:0]:s.plan.target==='companion'?{x:s.action==='小宝'?360+smooth(s.local/260)*145:345,y:y+24}:{x,y};
 const point={x:target.x,y:target.y-(art.ground?0:65)};
 if(activated&&id==='blackHole'&&fxAge<2200){const frame=fxAge<240?Math.floor(fxAge/60):fxAge<1680?4+Math.floor((fxAge-240)/90)%8:12+Math.min(3,Math.floor((fxAge-1680)/80));if(!simple)stamp(g,'animation/black-hole-slash/suction.png',Math.floor(fxAge/80)%8,256,point.x,y,250,160,lowFlash?.2:.4);stamp(g,'animation/black-hole-slash/rift.png',frame,256,point.x,y-70,120,200,lowFlash?.5:.8);}
 else if(activated&&id==='chain'){
  const origin={x:positions[0].x,y:positions[0].y-45};
  for(let i=1;i<positions.length;i++){const p=positions[i],lead=(i-1)*CHAIN_LIGHTNING.jumpDelay;paintWindGiftFx(ink,{id:i,visual:'gift:chain',rune:'',point:{x:p.x,y:p.y-45},end:origin,radius:art.size,born:0,life:CHAIN_LIGHTNING.life+lead,lead},fxAge/1.8,simple,lowFlash);}
 }
 else if(activated&&id!=='blackHole'){
  const end=id==='drinkDew'?{x:positions[0].x,y:y-65}:art.motion==='link'?{x:companion?345:x,y:companion?y+24-65:y-65}:undefined;
  paintWindGiftFx(ink,{id:0,visual:'gift:'+id,rune:'',point,radius:Math.min(art.size*1.1,100),born:0,life:art.life,direction:{x:1,y:0},end},fxAge/1.8,simple,lowFlash);
  if(id==='riposte'||id==='riposteFormation'){g.save();g.translate(x+38,y-65);g.scale(1,.4);paintRuneFx(ink,{id:1,visual:'wind-gift-fan',rune:'',point:{x:0,y:0},radius:335,born:0,life:800,direction:{x:1,y:0}},fxAge/1.8,simple,lowFlash);g.restore();}
 }
 g.globalAlpha=1;
 if(activated){g.fillStyle=color;g.font='bold 17px sans-serif';g.textAlign='center';const label=id==='windBone'?'生命上限增加':id==='longBreath'?'体力上限增加':healthIds.has(id)?'生命恢复':staminaIds.has(id)?'体力收益':shieldIds.has(id)?'护盾生效':'风赐触发';g.fillText(label,target.x,Math.max(70,target.y-130));}
 // 当前动作键与进度留在画布内，详细条件和收益同时在正常文档流中显示。
 g.fillStyle='#0d252abf';g.fillRect(0,327,900,33);g.fillStyle='#e7dcc1';g.font='14px sans-serif';g.textAlign='left';g.fillText(s.phase==='prepare'?'准备 · 看清触发条件':s.phase==='result'?'生效 · 观察目标与状态变化':s.caption,28,349);
 g.fillStyle=color;g.fillRect(0,358,900*clamp(age/s.total),2);g.restore();
 return s;
}

export function startGiftPreview(root:HTMLElement,simple=false,lowFlash=false,levels:Partial<Record<GiftVisualId,number>>={}){
 const canvas=root.querySelector<HTMLCanvasElement>('#gift-visual-canvas'),select=root.querySelector<HTMLSelectElement>('#gift-visual-choice'),description=root.querySelector<HTMLElement>('#gift-visual-description'),details=root.querySelector<HTMLDetailsElement>('.gift-preview'),caption=root.querySelector<HTMLElement>('#gift-demo-caption'),title=root.querySelector<HTMLElement>('#gift-demo-title'),pause=root.querySelector<HTMLButtonElement>('#gift-visual-pause'),replay=root.querySelector<HTMLButtonElement>('#gift-visual-replay');
 if(!canvas||!select||!description||!details||!caption||!title||!pause||!replay)return;const context=canvas.getContext('2d');if(!context)return;
 const scrub=document.createElement('label');scrub.className='gift-demo-scrub';scrub.innerHTML='<span>演示进度 · 拖动查看动作</span><input id="gift-demo-time" type="range" min="0" step="50" value="0" aria-label="演示时间"><output></output>';canvas.after(scrub);
 const range=scrub.querySelector<HTMLInputElement>('input')!,clock=scrub.querySelector<HTMLOutputElement>('output')!;
 const condition=document.createElement('p');condition.className='gift-demo-condition';canvas.before(condition);
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 let elapsed=0,last=0,frame=0,paused=reduced,stopped=false;const controller=new AbortController();
 const render=()=>{const id=select.value as GiftVisualId,s=paintGiftPreview(context,id,elapsed,simple,lowFlash);range.max=String(s.total);range.value=String(elapsed);clock.textContent=`${(elapsed/1000).toFixed(1)} / ${(s.total/1000).toFixed(1)}秒`;caption.textContent=s.caption;canvas.setAttribute('aria-label',`${giftVisualName(id)}使用示例：${s.caption}`);root.querySelectorAll<HTMLElement>('[data-demo-step]').forEach(e=>{if(e.dataset.demoStep===s.phase)e.setAttribute('aria-current','step');else e.removeAttribute('aria-current');});};
 const draw=(now:number)=>{frame=0;if(stopped||!canvas.isConnected)return;if(!details.open||document.hidden||paused){last=0;return;}if(last)elapsed=(elapsed+Math.min(100,now-last))%demoTimeline(select.value as GiftVisualId).total;last=now;render();frame=requestAnimationFrame(draw);};
 const schedule=()=>{cancelAnimationFrame(frame);frame=0;last=0;if(!stopped&&details.open&&!document.hidden&&!paused)frame=requestAnimationFrame(draw);};
 const update=()=>{const id=select.value as GiftVisualId,level=levels[id]??1,plan=demoSample(id,0).plan;elapsed=reduced?demoTimeline(id).effectAt+300:0;title.textContent=`${giftVisualName(id)} · ${Object.hasOwn(GIFT_RESONANCES,id)?'共鸣效果':`${level}级效果`}`;condition.textContent=`触发条件：${plan.setup}`;title.nextElementSibling!.textContent=`操作：${plan.actions.map(a=>a==='I'?'I 剑风':a==='J'?'J 挥剑':a==='K'?'K 弹反':a==='L'?'L 风步':a==='小宝'?'小宝攻击':a==='清场'?'整场结束':a).join(' → ')}`;description.textContent=demoEffect(id,level);render();schedule();};
 select.addEventListener('change',update,{signal:controller.signal});replay.addEventListener('click',()=>{paused=reduced;pause.textContent=paused?'播放示例':'暂停';pause.setAttribute('aria-pressed',String(paused));update();},{signal:controller.signal});
 range.addEventListener('input',()=>{elapsed=Number(range.value);paused=true;pause.textContent='继续播放';pause.setAttribute('aria-pressed','true');render();schedule();},{signal:controller.signal});
 pause.textContent=paused?'播放示例':'暂停';pause.setAttribute('aria-pressed',String(paused));
 pause.addEventListener('click',()=>{paused=!paused;pause.textContent=paused?'继续播放':'暂停';pause.setAttribute('aria-pressed',String(paused));schedule();},{signal:controller.signal});
 details.addEventListener('toggle',()=>{if(details.open)update();else schedule();},{signal:controller.signal});document.addEventListener('visibilitychange',schedule,{signal:controller.signal});
 const stop=()=>{stopped=true;cancelAnimationFrame(frame);controller.abort();observer.disconnect();};
 const observer=new MutationObserver(()=>{if(!canvas.isConnected)stop();});observer.observe(root,{childList:true,subtree:true});
 const urls=[...Object.values(sprites).map(v=>asset(v[0])),GIFT_MATERIAL_URL(),asset('icon-potion.png'),...['flight','hit'].map(n=>asset(`animation/sword-wind/sword-wind-${n}.png`)),...['flight','rift','suction'].map(n=>asset(`animation/black-hole-slash/${n}.png`))];
 for(const url of urls){const image=imageFor(url);if(!ready(image))image.addEventListener('load',()=>{if(!stopped&&details.open)render();},{once:true,signal:controller.signal});}
 update();return stop;
}
