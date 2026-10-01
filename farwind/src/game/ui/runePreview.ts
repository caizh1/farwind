import {RuneCombat} from '../systems/runeCombat';
import {paintRuneFx,paintRuneProjectile,canvasInk} from '../entities/runeView';
import {resolveDamage} from '../systems/damage';
import {resolveSwordWindConfig} from '../../data/swordWind';
import {initialState,type State} from '../systems/state';
import {runeById} from '../../data/runes';
import {loadRuneArt} from '../entities/runeArt';
export function runePreview(canvas:HTMLCanvasElement,id:string,current:State,A:number){
 loadRuneArt();
 const s=initialState();s.runes=structuredClone(current.runes);s.runes.clock=0;s.runes.cooldowns={};s.runes.counts={};s.runes.slots=id==='return-wind'?Array(5).fill(null):[id,...current.runes.slots.filter(v=>v&&v!==id).slice(0,4)];while(s.runes.slots.length<5)s.runes.slots.push(null);s.skills=structuredClone(current.skills);s.player={x:92,y:130,hp:100,stamina:100};
 const target={id:'preview-target',x:174,y:130,hp:100000},g=canvas.getContext('2d')!,ink=canvasInk(g);
 const engine=new RuneCombat({state:()=>s,targets:()=>[target],A:()=>A,visible:()=>true,clear:()=>true,blocker:()=>null,push:()=> 'immune',damage:(e,ev)=>{const hit=resolveDamage({sourceId:'player',targetId:e.id,attackId:ev.eventId,amount:ev.amount,sourceType:'player-rune',eventId:null},{id:'player',faction:'village',hp:100,armor:0},{id:e.id,faction:'hostile',hp:e.hp,armor:0});if(hit.applied)e.hp=hit.hp;return hit;},sound:()=>{},checkpoint:()=>{}});
 let stopped=false,frame=0,last=performance.now(),next=0,serial=0;
 const draw=(wall:number)=>{if(stopped||!canvas.isConnected)return;const delta=Math.min(50,wall-last);last=wall;engine.advance(delta);
 if(engine.now>=next){next=engine.now+650;serial++;if(id==='return-wind')engine.fx('return-wind',s.player,68,id,1300);else {const ev=engine.native('preview:'+serial,target,A,serial%3+1);const hit=engine.ctx.damage(target,ev);engine.nativeLanded(target,ev,hit.damage);if(serial%4===0)engine.dashStart('preview-dash:'+serial);if(serial%5===0)engine.block(true,'preview-block:'+serial,target);if(serial%3===0&&s.skills.swordWindStage>0)engine.windRelease('preview-wind:'+serial,s.player,{x:1,y:0},resolveSwordWindConfig(s.skills.swordWindStage as 1|2|3|4|5));if(id==='r30'&&serial===2)engine.damaged(target,0,100);}}
 g.globalAlpha=1;g.fillStyle='#203a33';g.fillRect(0,0,canvas.width,canvas.height);g.save();
 // 镜头适配最高的雷柱，绘制与命中仍使用正式世界坐标。
 const height=s.runes.slots.includes('r27')?286:210,zoom=Math.min(1,(canvas.height-60)/height);
 g.translate(canvas.width/2,canvas.height-24);g.scale(zoom,zoom);g.translate(-133,-130);
 g.strokeStyle='#536e57';g.lineWidth=1;g.beginPath();g.moveTo(16,148);g.lineTo(302,148);g.stroke();
 for(const f of engine.effects)paintRuneFx(ink,f,engine.now,s.runes.settings.simple,s.runes.settings.lowFlash);
 for(const p of engine.projectiles)paintRuneProjectile(ink,p,engine);
 g.globalAlpha=1;g.fillStyle='#d9ddca';g.fillRect(85,97,13,34);g.strokeStyle='#bc846f';g.lineWidth=3;g.beginPath();g.moveTo(82,108);g.lineTo(104,110);g.stroke();g.fillStyle='#839b70';g.fillRect(166,99,18,31);g.restore();g.globalAlpha=1;g.fillStyle='#e0d5b3';g.font='11px sans-serif';g.fillText('正式逻辑预览 · 隔离目标',12,18);g.fillText(`${runeById(id)?.name??'归风'} · 累计 ${Math.round(engine.metrics.damage)}`,12,34);frame=requestAnimationFrame(draw);
 };frame=requestAnimationFrame(draw);return ()=>{stopped=true;cancelAnimationFrame(frame);engine.clear();};
}
