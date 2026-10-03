import type {World} from '../scenes/World';
import {initialState,validate} from './state';
import {advanceEncounters} from './encounterState';
import {STRIKES,COMBAT,PARRY,attackConfig,attackVector} from './combat';
import {meleeBody,MELEE_HEIGHT} from './meleeGeometry';
import {encounterUnit} from '../../data/maps/windbell/encounters';
import {props} from '../../data/world';
import {LESSON_IDS} from '../../data/windLessons';
import {motionBlocked,clearMeleeLine} from './obstacles';
import * as persistence from './save';

export const COMBAT_PRESETS={slice:'近战、冲撞与远程',highLife:'单个高生命目标',leaf:'单只叶刃螳卫',dummy:'木桩',slime:'单只苔团史莱姆',guardian:'单只苔甲守卫',spore:'单只灰冠孢卫',boar:'单只棘甲林豕',boarWall:'林豕与现有树障',group:'四只小遭遇',groupLine:'剑风双穿多目标样板',world:'完整世界'} as const;
type Preset=keyof typeof COMBAT_PRESETS;
export function installCombatFeelDebug(world:World){
 const slice=new URLSearchParams(location.search).has('combatSlice');
 if(!import.meta.env.DEV||!slice&&!new URLSearchParams(location.search).has('combatFeel'))return;
 const panel=document.createElement('details');panel.id='combat-feel-debug';panel.open=true;
 panel.style.cssText='position:fixed;right:12px;top:12px;z-index:12000;background:#173c33ee;color:#f5efda;padding:10px;border:1px solid #c9b382;max-width:min(360px,90vw);font:13px sans-serif';
 panel.innerHTML=`<summary>战斗验证 · 隔离存档 · 素材待视觉验收</summary><div style="display:grid;gap:7px;margin-top:8px"><label>样板 <select id="combat-preset">${Object.entries(COMBAT_PRESETS).map(([key,label])=>`<option value="${key}">${label}</option>`).join('')}</select></label><label><input id="combat-wind" type="checkbox"> 已解锁剑风</label><label><input id="combat-four" type="checkbox"> 四连终结（隔离初始条件）</label><label>构筑验证 <select id="combat-build"><option value="none">五空槽</option><option value="wind">回风＋留痕</option><option value="melee">续势＋破岸</option></select></label><button id="combat-reset">重置隔离预设</button><label><input id="combat-hitbox" type="checkbox"> 显示判定与采样</label><label><input id="combat-numbers" type="checkbox" checked> 显示伤害数字</label><label><input id="combat-shake" type="checkbox" checked> 轻微镜头反馈</label><label>保存延迟 <select id="combat-delay"><option value="0">正常</option><option value="300">300 毫秒</option><option value="1000">1000 毫秒</option></select></label><button id="combat-failure">下一次写入失败</button><label><input id="combat-effects" type="checkbox" checked> 命中特效与音效</label><button id="combat-export">导出有界诊断</button><output id="combat-status">先选择样板并重置；不覆盖正式旅途。</output></div>`;
 document.body.append(panel);
 const field=<T extends HTMLElement>(id:string)=>panel.querySelector<T>(`#${id}`)!;
 const ink=world.add.graphics().setDepth(8999),frames:{wall:number;sim:number;rawDelta:number;paused:boolean;session:number}[]=[];
 const responses:{id:number;sim:number;wall:number;frame:number;pose:unknown;renderWall?:number;renderFrame?:number}[]=[];
 let hitbox=false,resetting=false,preset:Preset='dummy',generation=0,lastAttack=0;
 const origin={x:3200,y:1280};
 const standing=(p:{x:number;y:number})=>{
  if(!motionBlocked(p.x,p.y))return p;
  for(let r=16;r<=160;r+=16)for(let i=0;i<16;i++){const q={x:p.x+Math.cos(i*Math.PI/8)*r,y:p.y+Math.sin(i*Math.PI/8)*r};if(!motionBlocked(q.x,q.y))return q;}
  throw Error('样板站位被地形占用，不能强行生成。');
 };
 async function reset(choice:Preset=preset,wind=field<HTMLInputElement>('combat-wind').checked){
  if(resetting||world.economy.busy||world.defenseSaving)return;
  resetting=true;generation++;ink.clear();frames.length=0;responses.length=0;lastAttack=0;
  try{
   persistence.configureSaveFault?.(0,0);
   const s=initialState();s.skills.swordWindStage=wind?(choice==='groupLine'?2:1):0;s.skills.legacySwordWind=wind;
   if(field<HTMLInputElement>('combat-four').checked){s.skills.meleeFinisher=true;s.skills.buildLessons.push('melee');}
   const build=field<HTMLSelectElement>('combat-build').value;
   const slots=build==='wind'?['r31','r32']:build==='melee'?['r33','r12']:[];
   s.runes.owned=[...slots];s.runes.slots=[...slots,...Array(s.runes.slots.length-slots.length).fill(null)];
   // 仅此隔离样板的初始成长：保留正式来源校验，不用它证明学习任务已通过。
   if(wind&&choice==='groupLine'){s.skills.discoveredLessons=[LESSON_IDS[0],LESSON_IDS[1]];s.skills.completedLessons=[LESSON_IDS[0],LESSON_IDS[1]];s.skills.devices.serialValve=1;}
   if(choice!=='world'){Object.assign(s.player,standing(choice==='dummy'?{x:850,y:835}:choice==='boarWall'?{x:3330,y:1160}:choice==='boar'?{x:3220,y:930}:origin));s.xiaobao.task='free';}
   world.loaded=s;await world.start(true);preset=choice;
   if(choice!=='world'){
    // 初始条件明确隔离；之后输入、AI、碰撞、伤害与死亡全部走正式世界入口。
    const wilderness=world.wilderness;
    if(wilderness)wilderness.update=(delta,now)=>{advanceEncounters(world.state.encounters,delta);wilderness.capture(now);};
    for(const enemy of world.enemies){enemy.sprite.destroy();enemy.shadow.destroy();}world.enemies=[];
    const definitions=choice==='slice'?[['leaf-1','leaf',65,0],['boar-1','boar',200,-140],['wild-thorn-spore','spore',240,90]]:choice==='groupLine'?[['slime-2','slime',70,0],['leaf-1','leaf',150,0],['wild-thorn-spore','spore',230,0]]:choice==='group'?[['slime-2','slime',60,-25],['leaf-1','leaf',110,65],['wild-thorn-guardian','guardian',150,-80],['wild-thorn-spore','spore',220,80]]:
      choice==='dummy'?[]:choice==='boarWall'?[['boar-1','boar',200,-120]]:[[choice==='guardian'||choice==='highLife'?'wild-thorn-guardian':choice==='slime'?'slime-1':choice==='spore'?'wild-thorn-spore':choice==='leaf'?'leaf-1':`${choice}-1`,choice==='highLife'?'guardian':choice,choice==='boar'?100:80,choice==='boar'?-350:0]];
    for(const [id,type,dx,dy] of definitions){
     const p=standing({x:origin.x+Number(dx),y:origin.y+Number(dy)}),e=world.makeEnemy({id:String(id),type:String(type),...p});
     if(choice==='highLife'){e.hp=e.maxHP=20000;}
     e.playerAggroUntil=world.sim+600000;e.face={x:-1,y:0};
     if(type==='guardian'||choice==='groupLine')e.cool=world.sim+600;
     const member=encounterUnit(e.id);if(member)world.state.encounters.groups[member.group].activated=true;
     world.enemies.push(e);
    }
    wilderness?.capture(world.sim);validate(world.state);
   }
   world.combat.setIntent(choice==='dummy'?{x:0,y:-1}:{x:1,y:0});
   world.ui.close(true);world.refresh();
   field<HTMLOutputElement>('combat-status').textContent=`${COMBAT_PRESETS[choice]} · 无装备加成 · ${wind?choice==='groupLine'?'剑风双穿已解锁':'剑风一线斩已解锁':'剑风未解锁'}`;
  }finally{resetting=false;}
 }
 const snapshot=()=>({说明:'隔离样板只设置起点，所有结果来自正式输入、伤害与AI；原始帧不删除慢帧，墙钟和模拟时钟成对记录。',版本:new URLSearchParams(location.search).get('combatVersion')==='baseline'?'baseline':'candidate',门禁:{启用:world.keys.enabled(),活动:world.active,暂停:world.ui.paused,交易:world.economy.busy,驻防保存:world.defenseSaving,按住:[...world.keys.held],序号:world.keys.sequence},样板:COMBAT_PRESETS[preset],重置序号:generation,参数:{STRIKES,COMBAT,PARRY},环境:{设备:navigator.userAgent,分辨率:[innerWidth,innerHeight],像素比:devicePixelRatio,渲染器:world.game.renderer?.type},保存: persistence.saveDiagnostic?.()??null,帧:frames,输入:world.inputHistory,动作:world.combat.diagnostic(world.sim),起手画面准备:responses,反馈:world.feedback.snapshot(),音频:world.soundFx.diagnostic(),场景:world.sys.settings.key,世界:(window as any).__farwind(),对象:world.children.length,障碍:props.filter(p=>p.solid&&Math.hypot(p.x-origin.x,p.y-origin.y)<450).map(p=>({id:p.id,x:p.x,y:p.y}))});
 const observe=()=>{
  const state=persistence.saveDiagnostic?.();frames.push({wall:performance.now(),sim:world.sim,rawDelta:world.game.loop.rawDelta,paused:!world.active||world.ui.paused,session:state?.session??generation});if(frames.length>36000)frames.shift();
  if(world.combat.attack&&world.combat.attack.id!==lastAttack){lastAttack=world.combat.attack.id;responses.push({id:lastAttack,sim:world.sim,wall:performance.now(),frame:world.presentedFrame,pose:world.hero.debug()});if(responses.length>96)responses.shift();}
  ink.clear();if(!hitbox||!world.active||world.ui.paused)return;
  const p=world.state.player,a=world.combat.attack;
  ink.lineStyle(1,0xbceade,.75).strokeCircle(p.x,p.y,6);
  if(a){const m=attackConfig(a),[vx,vy]=attackVector(a),angle=Math.atan2(vy,vx),y=p.y-MELEE_HEIGHT;ink.lineStyle(1,0xf6daa0,.6).beginPath().moveTo(p.x,y).arc(p.x,y,m.range,angle-m.angle,angle+m.angle).lineTo(p.x,y).strokePath();}
  for(const t of world.combatTargets())if(t.hp>0){const body=meleeBody(t);ink.lineStyle(1,clearMeleeLine(p,t,t.id)?0x9fddbe:0xe49a8a,.7);if(body)ink.beginPath().moveTo(body[0].x,body[0].y);else{ink.strokeCircle(t.x,t.y,8);continue;}for(const p of body.slice(1))ink.lineTo(p.x,p.y);ink.closePath().strokePath();}
  for(const sample of world.weaponTrail.samples)ink.fillStyle(0xf2efb8,.8).fillCircle(sample.tip.x,sample.tip.y,2);
 };
 world.events.on('postupdate',observe);
 const rendered=()=>{const row=responses.at(-1);if(row&&row.renderWall===undefined&&row.id===world.combat.attack?.id){row.renderWall=performance.now();row.renderFrame=world.presentedFrame;}};
 world.game.events.on('postrender',rendered);
 (window as any).__combatFeel={reset,snapshot,status:()=>({active:world.active,busy:world.economy.busy,sim:world.sim,paused:world.ui.paused}),presets:COMBAT_PRESETS,fault:(delay=0,failures=0)=>persistence.configureSaveFault?.(delay,failures)};
 field<HTMLButtonElement>('combat-reset').onclick=()=>void reset(field<HTMLSelectElement>('combat-preset').value as Preset).catch(e=>field<HTMLOutputElement>('combat-status').textContent=e.message);
 field<HTMLInputElement>('combat-hitbox').onchange=e=>hitbox=(e.target as HTMLInputElement).checked;
 field<HTMLInputElement>('combat-numbers').onchange=e=>world.combatNumbers=(e.target as HTMLInputElement).checked;
 field<HTMLInputElement>('combat-shake').onchange=e=>world.combatShake=(e.target as HTMLInputElement).checked?.35:0;
 field<HTMLSelectElement>('combat-delay').onchange=e=>persistence.configureSaveFault?.(Number((e.target as HTMLSelectElement).value),0);
 field<HTMLInputElement>('combat-effects').onchange=e=>world.feedback.mode=(e.target as HTMLInputElement).checked?'D':'A';
 field<HTMLButtonElement>('combat-failure').onclick=()=>persistence.configureSaveFault?.(Number(field<HTMLSelectElement>('combat-delay').value),1);
 field<HTMLButtonElement>('combat-export').onclick=()=>{const blob=new Blob([JSON.stringify(snapshot(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='combat-feel-diagnostic.json';a.click();URL.revokeObjectURL(url);};
 if(slice){field<HTMLSelectElement>('combat-preset').value='slice';field<HTMLOutputElement>('combat-status').textContent='点击重置开始验证；独立存档，素材待视觉验收。';}
 world.events.once('shutdown',()=>{world.events.off('postupdate',observe);world.game.events.off('postrender',rendered);ink.destroy();panel.remove();delete (window as any).__combatFeel;});
}
