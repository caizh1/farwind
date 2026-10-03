import {showWindGifts} from '../ui/windGifts';
import type {World} from '../scenes/World';
import {initialState,validate,add} from './state';
import {WIND_GIFTS,EXTRA_WIND_GIFTS,offerWindGift,type WindGiftId} from './windGifts';
import {advanceEncounters} from './encounterState';
import {enemyDefs} from '../../data/world';
import {creatureMaxHP} from '../../data/maps/windbell/elites';
import {LESSON_IDS} from '../../data/windLessons';
import {motionBlocked} from './obstacles';

// 固定初始样本与正式存档隔离；输入、敌人、伤害、三选一及保存均走游戏原有流程。
export function installWindGiftArena(w:World){
 if(!import.meta.env.DEV||!new URLSearchParams(location.search).has('windGiftArena'))return;
 const panel=document.createElement('details');panel.id='wind-gift-arena';panel.open=true;
 panel.style.cssText='position:fixed;top:12px;right:12px;z-index:12000;width:min(330px,90vw);padding:12px;background:#233b35ed;color:#e8f3de;border:1px solid #9fc8ad;border-radius:12px;font:13px sans-serif';
 const profiles:Record<string,WindGiftId[]>={
  '闪链电弧':['chain'],
  'I贯通与节奏':['gale','longEdge','broadWind','pierceCurtain','clearPath','windRhythm','echoWind','stillWind','focusWind','roamEdge'],
  'J连段与终结':['blade','chainedEdge','catchEdge','guardStance','stepEdge','shock','heavyEdge','openGap','aftershock','finalBreath','breath'],
  '弹反与治疗':['riposte','poise','clearMirror','breakStance','borrowWind','drinkDew','stopBleeding','lingeringGrace','potion','spring'],
  '防御与风步':['firstVeil','softenWound','guardedBreath','unyielding','skimShadow','residualWind','escapeCircle','returningTide','stepEdge'],
  '控场与混合':['holdWind','curledWind','suppressField','returningTide','delayedEdge','duet','storedTurn','guidingEdge','cyclicBreath','duality'],
  '伙伴同行':['sharedHeart','protectCompanion','relayEdge','returningBreath','sideBySide'],
  '完整目录':Object.keys(WIND_GIFTS) as WindGiftId[],
 };
 panel.innerHTML=`<summary>风赐全流派 · 隔离试玩</summary><div style="display:grid;gap:8px;margin-top:10px"><p style="margin:0">方向键移动；I剑风，J连段，K弹反，L风步。预设仅设置隔离初始条件。</p><label>流派 <select id="gift-profile">${Object.keys(profiles).map(p=>`<option>${p}</option>`).join('')}</select></label><label>等级 <select id="gift-level"><option>1</option><option>4</option></select></label><button id="gift-arena-reset">开始／重置此流派</button><button id="gift-arena-view">查看风赐与待选奖励</button><button id="gift-arena-capture">截取下一次风赐画面</button><button id="gift-arena-evidence">导出战斗证据</button><button id="gift-arena-record">录制八秒实战动画</button><output>准备开始。当前定义61种，其中48种为本批新增。</output><div id="gift-arena-exports" style="display:grid;gap:6px"></div></div>`;
 document.body.append(panel);const exports=panel.querySelector<HTMLDivElement>('#gift-arena-exports')!,exportUrls=new Map<string,string>();const download=(url:string,name:string,label:string)=>{if(!panel.isConnected)return;const prior=exportUrls.get(name);if(prior)URL.revokeObjectURL(prior);if(url.startsWith('blob:'))exportUrls.set(name,url);const link=document.createElement('a');link.href=url;link.download=name;link.textContent=label;link.style.color='#c8f7ef';exports.querySelector(`[download="${name}"]`)?.remove();exports.append(link);link.click();};const output=panel.querySelector<HTMLOutputElement>('output')!;let busy=false,capture=false;let recorder:MediaRecorder|undefined,recordTimer:ReturnType<typeof setTimeout>|undefined;
 const observe=()=>{if(!w.active||!w.runes)return;const g=w.runes.gifts,m=g.metrics;output.textContent=`原生命中 ${w.runes.engine.metrics.native} · 派生命中 ${m.derived} · 伙伴实击 ${m.companionHits} · 回声 ${m.echoes} · 自动治疗 ${m.healed.toFixed(2)} · 护盾 ${g.snapshot().shield.toFixed(1)} · 牵引 ${m.pulled.toFixed(1)} · 生命 ${w.state.player.hp.toFixed(1)} · 体力 ${w.state.player.stamina.toFixed(1)}`;const visual=w.runes.engine.effects.some(f=>f.rune===''&&w.runes!.engine.now-f.born>=(f.visual==='gift:chain'?115:70)&&w.runes!.engine.now-f.born<240);if(capture&&(visual||g.echoes.winds.some(b=>!b.terminated))){capture=false;w.game.renderer.snapshot(image=>{if(!(image instanceof HTMLImageElement))return;download(image.src,'wind-gifts-game.png','保存最新实战截图');});}};w.events.on('postupdate',observe);
 async function reset(){if(busy||w.economy.busy)return;busy=true;try{
  const profile=panel.querySelector<HTMLSelectElement>('#gift-profile')!.value,level=Number(panel.querySelector<HTMLSelectElement>('#gift-level')!.value),s=initialState();
  s.skills.swordWindStage=3;s.skills.completedLessons=LESSON_IDS.slice(0,3);s.skills.discoveredLessons=LESSON_IDS.slice(0,3);s.skills.devices.serialValve=1;s.skills.devices.leakClosed=true;s.skills.meleeFinisher=true;s.skills.buildLessons=['melee'];s.player.x=3200;s.player.y=1280;s.player.stamina=65;if(profile==='弹反与治疗')s.player.hp=95;
  s.windGifts.held=profiles[profile]!.map(id=>({id,level}));add(s,'potion',5);
  if(profile==='伙伴同行'){s.xiaobao.known=true;s.xiaobao.task='follow';s.xiaobao.hp=640;s.xiaobao.x=s.player.x-45;s.xiaobao.y=s.player.y+25;}
  let seed=0;do{s.windGifts.pending=[];s.windGifts.receipts=[];offerWindGift(s.windGifts,'wind-gift-arena-reward',seed++,true);}while(!s.windGifts.pending[0]!.candidates.some(id=>Object.hasOwn(EXTRA_WIND_GIFTS,id)));
  validate(s);w.loaded=s;await w.start(true);const engine=w.runes!.engine;engine.events=[];for(const key of Object.keys(engine.metrics) as (keyof typeof engine.metrics)[])engine.metrics[key]=0;w.runes!.gifts.metrics={companionHits:0,derived:0,healed:0,shielded:0,pulled:0,echoes:0,resonances:0};
  if(w.wilderness)w.wilderness.update=(delta,now)=>{advanceEncounters(w.state.encounters,delta);w.wilderness?.capture(now);};
  for(const e of w.enemies){e.sprite.destroy();e.shadow.destroy();}w.enemies=[];
  const positions=profile==='闪链电弧'?[[0,90,0],[1,120,-140],[2,230,95]]:[[0,80,0],[1,140,0],[2,100,60],[3,100,-60]];
  for(const [i,dx,dy] of positions){const x=s.player.x+dx,y=s.player.y+dy;if(motionBlocked(x,y))throw Error('预览站位被地形阻挡。');const definition=profile==='伙伴同行'?enemyDefs[i]!:{id:`gift-preview-${i}`,type:profile!=='闪链电弧'&&i===1?'archer':'slime',x,y};const e=w.makeEnemy({...definition,x,y});e.hp=e.maxHP=profile==='伙伴同行'?creatureMaxHP(definition.type):2000;e.cool=w.sim+(profile==='闪链电弧'||profile==='I贯通与节奏'||profile==='J连段与终结'||profile==='完整目录'?600000:1500+i*400);w.enemies.push(e);}
  w.combat.setIntent({x:1,y:0});w.ui.close(true);w.refresh();await w.persist();output.textContent=`${profile}已准备；等级${level}。`;w.ui.focusGame();
 }finally{busy=false;}}
 panel.querySelector<HTMLButtonElement>('#gift-arena-reset')!.onclick=()=>void reset().catch(e=>output.textContent=e.message);
 panel.querySelector<HTMLButtonElement>('#gift-arena-view')!.onclick=()=>showWindGifts(w.ui);
 panel.querySelector<HTMLButtonElement>('#gift-arena-capture')!.onclick=()=>{capture=true;w.ui.focusGame();output.textContent='已预约：下一次风赐特效出现时保存真实画面。';};
 panel.querySelector<HTMLButtonElement>('#gift-arena-evidence')!.onclick=()=>{const value={说明:'隔离场真实输入与战斗状态，不能替代正式存档或长期性能验收',流派:panel.querySelector<HTMLSelectElement>('#gift-profile')!.value,风赐:w.state.windGifts,生命:w.state.player.hp,伙伴:w.state.xiaobao,战斗:w.runes!.snapshot(),敌人:w.enemies.map(e=>({编号:e.id,生命:e.hp,位置:{x:e.x,y:e.y},减速:e.runeSlow,失衡:e.staggerUntil}))};const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));download(url,'wind-gifts-evidence.json','保存最新战斗证据');let pre=exports.querySelector('pre');if(!pre){pre=document.createElement('pre');pre.style.cssText='max-height:100px;overflow:auto;white-space:pre-wrap;font-size:10px';exports.append(pre);}pre.textContent=JSON.stringify(value,null,2);};
 panel.querySelector<HTMLButtonElement>('#gift-arena-record')!.onclick=()=>{if(recorder?.state==='recording')return;const canvas=w.game.canvas as HTMLCanvasElement;if(!canvas.captureStream||typeof MediaRecorder==='undefined'){output.textContent='当前浏览器不支持录制，请使用Chrome。';return;}const stream=canvas.captureStream(60),chunks:Blob[]=[];const type=MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9':'video/webm';recorder=new MediaRecorder(stream,{mimeType:type,videoBitsPerSecond:6000000});recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onstop=()=>{stream.getTracks().forEach(t=>t.stop());if(!panel.isConnected)return;const url=URL.createObjectURL(new Blob(chunks,{type}));download(url,'wind-gifts-continuous.webm','保存最新八秒实战录像');output.textContent='实战录像已生成，可用下方链接保存。';};recorder.start();recordTimer=setTimeout(()=>{if(recorder?.state==='recording')recorder.stop();},8000);w.ui.focusGame();output.textContent='正在录制八秒真实实战动画，请按键攻击。';};
 w.events.once('shutdown',()=>{if(recordTimer)clearTimeout(recordTimer);if(recorder?.state==='recording')recorder.stop();w.events.off('postupdate',observe);exportUrls.forEach(url=>URL.revokeObjectURL(url));panel.remove();});
}
