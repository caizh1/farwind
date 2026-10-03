import {SwordWindSystem,type SwordWind,type WindEvent} from '../systems/swordWind';
import {RuneCombat} from '../systems/runeCombat';
import {paintRuneFx,paintRuneProjectile,paintWindTraces,canvasInk} from '../entities/runeView';
import {resolveDamage} from '../systems/damage';
import {resolveSwordWindConfig} from '../../data/swordWind';
import {initialState,type State} from '../systems/state';
import {runeById} from '../../data/runes';
import {loadRuneArt} from '../entities/runeArt';
import {returnMode} from '../systems/runeState';
import {branchName} from '../../data/runeGrowth';
import {STRIKES} from '../systems/combat';
import {phaseStepDestination} from '../systems/phaseStep';
import {rectInterval} from '../systems/obstacles';
// 单枚效果与角色配装分开，避免其他已装备符文遮住当前符文的行为。
export function runePreviewScene(id:string,current:State,A:number){
 const s=initialState();s.runes=structuredClone(current.runes);s.runes.clock=0;s.runes.cooldowns={};s.runes.counts={};s.runes.slots.fill(null);if(id!=='return-wind')s.runes.slots[0]=id;s.skills=structuredClone(current.skills);s.player={x:92,y:130,hp:100,stamina:100};
 const target={id:'preview-target',x:174,y:130,hp:100000},second={id:'preview-second',x:224,y:154,hp:100000},winds=new SwordWindSystem();
 const engine=new RuneCombat({state:()=>s,targets:()=>id==='r32'?[target,second]:[target],A:()=>A,visible:()=>true,clear:()=>true,blocker:()=>null,push:()=> 'immune',damage:(e,ev)=>{const hit=resolveDamage({sourceId:'player',targetId:e.id,attackId:ev.eventId,amount:ev.amount,sourceType:'player-rune',eventId:null},{id:'player',faction:'village',hp:100,armor:0},{id:e.id,faction:'hostile',hp:e.hp,armor:0});if(hit.applied)e.hp=hit.hp;return hit;},sound:()=>{},checkpoint:()=>{}});
 winds.returnAnchor=()=>({...s.player});
 const hits:WindEvent[]=[];let next=0,serial=0,released=0,phase='等待送风',phaseMoved=false;
 const phaseWall={left:126,right:155,top:95,bottom:150};
 const step=(delta:number)=>{
  const before=engine.now;engine.advance(delta);
  if(id==='r34'&&serial&&!phaseMoved&&engine.now-released>=300){
   const origin={...s.player},end=phaseStepDestination(origin,{x:origin.x+90,y:origin.y},
    (x,y)=>x>phaseWall.left&&x<phaseWall.right&&y>phaseWall.top&&y<phaseWall.bottom,
    ()=>true,(a,b)=>!rectInterval(a,b,phaseWall));
   if(end){s.player.x=end.x;s.player.y=end.y;engine.fx('phase-step',origin,23,id,700,{end});}
   phaseMoved=true;phase='穿过实体障碍 · 安全落点';
  }
  if(id==='r31'&&returnMode(s)==='anchor'&&engine.now-released>=180&&winds.winds.some(w=>!w.terminated&&w.leg==='out'))s.player.y=Math.min(190,s.player.y+delta*.25);
  const events=winds.advance(before,engine.now,id==='r31'?[{target,previous:target,current:target}]:[],()=>null);
  for(const event of events){if(!event.target)continue;const w=event.wind,ev=engine.native(`attack:${w.rootActionId}`,target,w.config.damage,1,true,false,w.leg);const hit=engine.ctx.damage(target,ev);if(hit.applied){engine.nativeLanded(target,ev,hit.damage);hits.push(event);phase=`${w.leg==='back'?'回程':'去程'}命中 ${Math.round(hit.damage*10)/10}`;}}
  if(id==='r31'&&!phase.startsWith('回程命中')&&winds.winds.some(w=>!w.terminated&&w.leg==='back'))phase=returnMode(s)==='anchor'?'回程 → 折返时的玩家位置':'回程 → 施放地点';
  while(hits.length&&engine.now-hits[0].at>500)hits.shift();
  for(const wind of winds.winds)engine.tracePass(wind);
  if(engine.now<next)return;
  next=engine.now+650;serial++;
  if(id==='r34'){next=engine.now+1600;released=engine.now;phaseMoved=false;s.player.x=92;s.player.y=130;phase='瞬步前 · 实体障碍阻挡';}
  else if(id==='r31'){
   next=engine.now+1800;released=engine.now;s.player.y=130;phase='去程 → 回程';
   const config=resolveSwordWindConfig((s.skills.swordWindStage||1) as 1|2|3|4|5);
   winds.launch({id:serial,rootActionId:serial,kind:'swordWind',stage:1,facing:3,start:engine.now,hit:new Set(),swordWind:config,returnMode:returnMode(s)},s.player,engine.now,config.damage*A/STRIKES[0].damage);
  }else if(id==='r32'){next=engine.now+(serial%2?800:1600);if(serial%2){for(const e of [target,second]){const ev=engine.native('preview-trace:'+serial,e,A,1,true,false);engine.nativeLanded(e,ev,A);}}else winds.launch({id:serial,kind:'swordWind',stage:1,facing:3,start:engine.now,hit:new Set(),swordWind:resolveSwordWindConfig(1)},s.player,engine.now,A);}
  else if(id==='return-wind')engine.fx('return-wind',s.player,68,id,1300);
  else {const ev=engine.native('preview:'+serial,target,A,serial%4+1,false,serial%4===0);const hit=engine.ctx.damage(target,ev);engine.nativeLanded(target,ev,hit.damage);if(serial%4===0)engine.dashStart('preview-dash:'+serial);if(serial%5===0)engine.block(true,'preview-block:'+serial,target);if(serial%3===0&&s.skills.swordWindStage>0)engine.windRelease('preview-wind:'+serial,s.player,{x:1,y:0},resolveSwordWindConfig(s.skills.swordWindStage as 1|2|3|4|5));if(id==='r30'&&serial===2)engine.damaged(target,0,100);}
 };
 return {state:s,engine,winds,target,second,hits,step,get phase(){return phase;},clear(){engine.clear();winds.clear();hits.length=0;}};
}
const windImages=new Map<string,HTMLImageElement>();
function paintPreviewWind(g:CanvasRenderingContext2D,w:SwordWind,now:number){
 const m=w.config.art,age=now-w.born,endAge=now-(w.ended??now),hit=w.terminated&&w.reason==='target';
 const key=w.terminated?hit?'hit':'dissolve':age<m.release?'release':'flight';
 const frame=w.terminated?hit?Math.min(7,Math.floor(endAge/m.hit*8)):Math.min(3,Math.floor(endAge/m.dissolve*4)):age<m.release?Math.min(3,Math.floor(age/m.release*4)):Math.floor((age-m.release)/m.flight*6)%6;
 let image=windImages.get(key);if(!image){image=new Image();image.src=`${import.meta.env.BASE_URL}assets/animation/sword-wind/sword-wind-${key}.png`;windImages.set(key,image);}
 if(!image.complete||!image.naturalWidth)return;
 const point=hit?{x:w.contact!.x,y:w.contact!.y-m.bodyHeight}:{x:w.position.x+w.visualOffset.x,y:w.position.y+w.visualOffset.y},size=hit?m.hitSize:m.flightSize,height=size*(hit?1:w.config.width/28);
 g.save();g.globalAlpha=1;g.translate(point.x,point.y);g.rotate(Math.atan2(w.direction.y,w.direction.x));g.drawImage(image,frame*128,0,128,128,-size/2,-height/2,size,height);g.restore();
}
export function runePreview(canvas:HTMLCanvasElement,id:string,current:State,A:number){
 loadRuneArt();
 const scene=runePreviewScene(id,current,A),{state:s,engine,winds,target,second}=scene,g=canvas.getContext('2d')!,ink=canvasInk(g);
 let stopped=false,frame=0,last=performance.now();
 const draw=(wall:number)=>{if(stopped||!canvas.isConnected)return;const delta=Math.min(50,wall-last);last=wall;scene.step(delta);
 g.globalAlpha=1;g.fillStyle='#203a33';g.fillRect(0,0,canvas.width,canvas.height);g.save();
 // 镜头适配最高的雷柱，绘制与命中仍使用正式世界坐标。
 const height=s.runes.slots.includes('r27')?286:210,windPreview=id==='r31'||id==='r32',zoom=windPreview?Math.min((canvas.width-24)/650,(canvas.height-65)/250):Math.min(1,(canvas.height-60)/height);
 g.translate(canvas.width/2,windPreview?canvas.height/2+35:canvas.height-24);g.scale(zoom,zoom);g.translate(windPreview?-320:-133,-130);
 g.strokeStyle='#536e57';g.lineWidth=1;g.beginPath();g.moveTo(16,148);g.lineTo(302,148);g.stroke();
 paintWindTraces(ink,engine);
 if(id==='r34'){g.fillStyle='#839187';g.fillRect(126,95,29,55);g.strokeStyle='#c5cabe';g.lineWidth=2;g.strokeRect(126,95,29,55);g.strokeStyle='#b9f3e7';g.setLineDash([4,4]);g.beginPath();g.moveTo(92,130);g.lineTo(182,130);g.stroke();g.setLineDash([]);}
 if(windPreview){g.strokeStyle='#536e57';g.beginPath();g.moveTo(92,130);g.lineTo(600,130);g.stroke();for(const w of winds.winds){g.strokeStyle=w.leg==='back'?'#e1c791':'#8be0ce';g.setLineDash([6,5]);g.beginPath();g.moveTo(w.origin.x,w.origin.y);g.lineTo(w.position.x,w.position.y);g.stroke();g.setLineDash([]);paintPreviewWind(g,w,engine.now);}for(const event of scene.hits){g.fillStyle=event.wind.leg==='back'?'#e1c791':'#8be0ce';g.font='22px sans-serif';g.fillText(event.wind.leg==='back'?'回程':'去程',event.point.x,event.point.y-55);}}
 for(const f of engine.effects)paintRuneFx(ink,f,engine.now,s.runes.settings.simple,s.runes.settings.lowFlash);
 for(const p of engine.projectiles)paintRuneProjectile(ink,p,engine);
 const actorWidth=windPreview?28:13,actorHeight=windPreview?66:34,targetWidth=windPreview?30:18,targetHeight=windPreview?60:31;
 g.globalAlpha=1;g.fillStyle='#d9ddca';g.fillRect(s.player.x-actorWidth/2,s.player.y-actorHeight,actorWidth,actorHeight);g.strokeStyle='#bc846f';g.lineWidth=windPreview?5:3;g.beginPath();g.moveTo(s.player.x-actorWidth,s.player.y-actorHeight*.65);g.lineTo(s.player.x+actorWidth,s.player.y-actorHeight*.6);g.stroke();g.fillStyle='#839b70';g.fillRect(target.x-targetWidth/2,target.y-targetHeight,targetWidth,targetHeight);if(id==='r32')g.fillRect(second.x-targetWidth/2,second.y-targetHeight,targetWidth,targetHeight);g.restore();g.globalAlpha=1;g.fillStyle='#e0d5b3';g.font='11px sans-serif';g.fillText('单枚符文预览 · 正式逻辑',12,18);g.fillText(id==='r34'?scene.phase:`${runeById(id)?.name??'归风'} · 累计 ${Math.round(engine.metrics.damage)}`,12,34);if(id==='r34')canvas.setAttribute('aria-label',`穿隙单枚预览：${scene.phase}`);if(id==='r31'){const mode=returnMode(s)==='anchor'?branchName('r31','anchor')+' · 施放后移步':branchName('r31','path');g.fillText(mode,12,50);g.fillText(scene.phase,12,66);canvas.setAttribute('aria-label',`回风单枚预览：${mode}；${scene.phase}`);}frame=requestAnimationFrame(draw);
 };frame=requestAnimationFrame(draw);return ()=>{stopped=true;cancelAnimationFrame(frame);scene.clear();};
}
