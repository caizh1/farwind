import {showWindGifts} from '../ui/windGifts';
import type {World} from '../scenes/World';
import {initialState,validate} from './state';
import {offerWindGift} from './windGifts';
import {advanceEncounters} from './encounterState';
import {motionBlocked} from './obstacles';

// 只在独立开发存档设置可复现初始条件，后续输入、AI、碰撞和伤害走正式世界。
export function installBlackHoleArena(world:World){
 if(!import.meta.env.DEV||!new URLSearchParams(location.search).has('blackHoleArena'))return;
 const panel=document.createElement('details');panel.id='black-hole-arena';panel.open=true;
 panel.style.cssText='position:fixed;top:12px;right:12px;z-index:12000;max-width:min(330px,90vw);padding:12px;background:#25213aed;color:#eee6ff;border:1px solid #9f88bd;border-radius:12px;font:13px sans-serif';
 panel.innerHTML='<summary>黑洞斩 · 隔离试玩 · 美术待验收</summary><div style="display:grid;gap:8px;margin-top:10px"><p style="margin:0">按 I 斩出星云风刃，按方向键移动。普通怪物会被牵引并持续掉血。</p><label><input id="black-hole-guaranteed" type="checkbox" checked> 确定触发预览（仅此隔离场）</label><button id="black-hole-reset">开始／重置隔离试玩</button><button id="black-hole-capture">截取下一次裂缝画面</button><button id="black-hole-upgrade">查看六级升级奖励</button><output id="black-hole-status">准备开始：正式概率为5%至10%。</output></div>';
 document.body.append(panel);const status=panel.querySelector<HTMLOutputElement>('output')!,guaranteed=panel.querySelector<HTMLInputElement>('input')!;let busy=false,capture=false;world.runes!.blackHole.random=()=>0;
 const observe=()=>{const engine=world.runes?.blackHole;if(!world.active||!engine)return;const m=engine.metrics;status.textContent=`原生I：${m.rolls}次 · 黑洞斩：${m.procs}次 · 持续实伤：${m.dotDamage.toFixed(2)} · 牵引距离：${m.pulled.toFixed(1)} · 活跃裂缝：${engine.rifts.length}`;
  const r=engine.rifts.find(r=>world.sim-r.born>=420&&world.sim-r.born<1200);if(capture&&r){capture=false;world.game.renderer.snapshot(image=>{if(!(image instanceof HTMLImageElement))return;const a=document.createElement('a');a.href=image.src;a.download='black-hole-slash-game.png';a.click();});}
 };world.events.on('postupdate',observe);
 async function reset(){if(busy||world.economy.busy)return;busy=true;
  try{const s=initialState();s.skills.swordWindStage=1;s.skills.legacySwordWind=true;
   s.player.x=3200;s.player.y=1280;s.windGifts.held=[{id:'blackHole',level:5},{id:'armor',level:100},{id:'thrift',level:10}];
   let seed=0;do{ s.windGifts.pending=[];s.windGifts.receipts=[];offerWindGift(s.windGifts,'black-hole-arena-reward',seed++,true); }while(!s.windGifts.pending[0].candidates.includes('blackHole'));
   validate(s);world.loaded=s;await world.start(true);
   if(world.wilderness)world.wilderness.update=(delta,now)=>{advanceEncounters(world.state.encounters,delta);world.wilderness?.capture(now);};
   for(const e of world.enemies){e.sprite.destroy();e.shadow.destroy();}world.enemies=[];
   for(const [i,dx,dy] of [[0,140,0],[1,200,65],[2,240,-65],[3,320,60]]){const x=s.player.x+dx,y=s.player.y+dy;if(motionBlocked(x,y))throw Error('预览站位被地形阻挡。');
    const e=world.makeEnemy({id:`black-hole-preview-${i}`,type:'slime',x,y});e.hp=e.maxHP=1000;e.cool=world.sim+600000;world.enemies.push(e);
   }
   world.runes!.blackHole.random=guaranteed.checked?()=>0:()=>Math.random();world.combat.setIntent({x:1,y:0});world.ui.close(true);world.refresh();
   status.textContent='隔离初始条件：五级9%，高生命怪物；预览开关可让每次I触发。'
  }finally{busy=false;}
 }
 panel.querySelector<HTMLButtonElement>('#black-hole-reset')!.onclick=()=>void reset().catch(e=>status.textContent=e.message);
 panel.querySelector<HTMLButtonElement>('#black-hole-capture')!.onclick=()=>{capture=true;world.ui.focusGame();};
 panel.querySelector<HTMLButtonElement>('#black-hole-upgrade')!.onclick=()=>showWindGifts(world.ui);
 guaranteed.onchange=()=>{world.runes!.blackHole.random=guaranteed.checked?()=>0:()=>Math.random();status.textContent=guaranteed.checked?'确定触发预览已启用。':'正式概率已启用：五级9%，六级最高10%。';};
 world.events.once('shutdown',()=>{world.events.off('postupdate',observe);panel.remove();});
}
