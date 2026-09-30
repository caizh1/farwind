import {describe,it,expect} from 'vitest';
import {CombatController,PARRY,attackConfig,type Attack} from '../src/game/systems/combat';
import {createEnemyAttack,advanceEnemyAttack,sampleEnemyAttack,predictEnemyContact,delayEnemyAttack,warningQuality,geometryTouches,type EnemyContact} from '../src/game/systems/enemyAttack';
import {adjudicateContact,defends,orderedContacts} from '../src/game/systems/contact';
import {Input} from '../src/game/systems/input';
import {CombatTimeline} from '../src/game/systems/timeline';
import {counterVisual,parryVisual,parryWeapon} from '../src/data/animation';
import {WeaponTrail} from '../src/game/systems/weaponTrail';
import {enemyNavigation,updateEnemy,staggerEnemy,enemyAttackPermitted,type EnemyBody} from '../src/game/systems/enemy';
import sharp from 'sharp';
const open={blocked:()=>false,clear:()=>true,melee:()=>true},rules={valid:true,immune:false,clear:()=>true};
function arena(kind:'normal'|'perfect'='normal',j?:number){
 const c=new CombatController(),p={x:850,y:720,stamina:60},target={id:'main',x:850,y:690,hp:100},other={id:'other',x:850,y:685,hp:100},started:Attack[]=[],hits:number[]=[];
 c.requestParry(0,1);c.flushActions(0,p);if(j!==undefined)c.requestAttack(j);
 const at=kind==='normal'?100:50,a=createEnemyAttack('main',1,'slime',at-450,target,p);
 const contact=advanceEnemyAttack(a,target,p,at,open)!;expect(adjudicateContact(contact,c,p,rules)).toBe(kind);
 const tick=(prev:number,now:number)=>c.update(prev,now,1,p,[target,other],()=>false,()=>true,(e,_,attack)=>{e.hp-=attackConfig(attack).damage;hits.push(attack.id)},(_,a)=>started.push(a));
 return {c,p,target,other,at,tick,started,hits};
}
describe('第二轮输入、窗口与自动反斩',()=>{
 for(const [time,quality] of [[0,'perfect'],[89.999,'perfect'],[90,'normal'],[90.001,'normal'],[239.999,'normal'],[240,null],[240.001,null],[320,null],[420,null]] as const)it(`新窗口${time}`,()=>{const c=new CombatController(),p={stamina:100};c.requestParry(0,0);c.flushActions(0,p);expect(c.parryQuality(time)).toBe(quality);expect(p.stamina).toBe(88)});
 it('同帧转向松开K不依赖渲染；缓冲中修正方向、启动后锁定',()=>{
  const c=new CombatController(),input=new Input(null,()=>10),p={stamina:100};input.keyDown('d');input.keyUp('d');input.keyDown('k');
  for(const event of input.drain()){c.setIntent(event.axis);if(event.kind==='parry')c.requestActions([event as any],0,p,0)}c.flushActions(0,p);expect(c.parry!.facing).toBe(3);
  c.reset();c.dashUntil=100;c.requestParry(0,0);c.setIntent({x:-1,y:0});c.flushActions(100,p);expect(c.parry!.facing).toBe(2);c.setIntent({x:0,y:1});expect(c.parry!.facing).toBe(2);
 });
 it('贴身重叠用来招锁向回退，不任意默认方向',()=>{
  const p={x:850,y:720,stamina:100},c=new CombatController();c.requestParry(0,1);c.flushActions(0,p);
  const a=createEnemyAttack('same',1,'slime',-450,p,{x:850,y:760});a.locked=true;
  const event:EnemyContact={at:0,attack:a,origin:{x:p.x,y:p.y},geometry:{a:p,b:p,radius:28}};
  expect(defends(1,p,p,a.direction)).toBe(true);expect(defends(0,p,p,a.direction)).toBe(false);expect(adjudicateContact(event,c,p,rules)).toBe('perfect');
 });
 for(const kind of ['normal','perfect'] as const)it(`${kind}正式首刀延迟60，55前摇后才伤害；只打一刀并只打主目标`,()=>{
  const a=arena(kind),resume=a.at+60;a.tick(a.at,resume-1);expect(a.target.hp).toBe(100);expect(a.started).toHaveLength(0);a.tick(resume-1,resume);expect(a.started).toHaveLength(1);expect(a.started[0].automatic).toBe(true);expect(a.c.autoCounter).toBeNull();
  a.tick(resume,resume+54.999);expect(a.target.hp).toBe(100);a.tick(resume+54.999,resume+55);expect(a.target.hp).toBe(kind==='normal'?76:70);expect(a.other.hp).toBe(100);a.tick(resume+55,resume+700);expect(a.started).toHaveLength(1);expect(a.hits).toHaveLength(1);
 });
 it('成功前旧J清除；成功停顿内J只预约第二刀，无第二次首刀',()=>{
  const old=arena('normal',50);expect(old.c.pending).toBe(false);old.tick(100,1000);expect(old.started.map(a=>a.stage)).toEqual([1]);
  const a=arena();a.c.requestAttack(a.at);a.c.advanceFrame(55);a.tick(a.at,a.at+60);expect(a.c.pending).toBe(true);a.tick(a.at+60,a.at+275);expect(a.started.map(a=>[a.stage,a.counter])).toEqual([[1,'normal'],[2,undefined]]);a.c.requestAttack(a.at+280);a.tick(a.at+275,a.at+900);expect(a.started.map(a=>a.stage)).toEqual([1,2,3]);
 });
 for(const action of ['dash','parry'] as const)it(`恢复点${action}优先取消待反斩，不延后补放`,()=>{
  const a=arena();a.c.advanceFrame(55);a.c.requestActions([{kind:action,at:a.at,sequence:1,axis:{x:0,y:-1}}],a.at,a.p,1);a.c.flushActions(a.at+60,a.p);expect(a.c.autoCounter).toBeNull();a.tick(a.at+60,a.at+600);expect(a.started).toHaveLength(0);
 });
 it('自动首刀有效期仍不能立即切防御；不会获得整段无敌',()=>{
  const a=arena();a.c.advanceFrame(55);a.tick(100,215);expect(a.c.phase(215)).toBe('active');a.c.requestParry(216,1);a.c.flushActions(216,a.p);expect(a.c.parry).toBeNull();expect(a.c.invulnerable(216)).toBe(false);a.c.flushActions(330,a.p);expect(a.c.parry?.start).toBe(330);
 });
 it('目标移出范围或隔墙允许反斩挥空，仍消费正式实例',()=>{for(const mode of ['far','wall']){const a=arena();if(mode==='far')a.target.y=500;const hit:number[]=[];a.c.update(100,600,1,a.p,[a.target],()=>false,()=>mode!=='wall',()=>hit.push(1),()=>{});expect(hit).toEqual([]);expect(a.c.serial).toBe(1);expect(a.c.autoCounter).toBeNull();}});
 it('真实受伤、死亡、标题、新游戏、读档清除未执行反斩和后续意图',()=>{for(const mode of ['hurt','death','title','new','load']){const a=arena();a.c.requestAttack(a.at);if(mode==='hurt')a.c.hurt();else a.c.reset();a.tick(0,1000);expect(a.started).toHaveLength(0);expect(a.c.pending).toBe(false);expect(a.c.autoCounter).toBeNull();}});
 it('普通与精准长失衡不被自动反斩和后续轻击缩短',()=>{for(const kind of ['normal','perfect'] as const){const e={staggerUntil:0};staggerEnemy(e,100,PARRY[kind].stagger);staggerEnemy(e,215,75);expect(e.staggerUntil).toBe(100+PARRY[kind].stagger);}});
 it('多敌人奖励与自动反斩固定一份，排序不依赖数组',()=>{for(const reverse of [false,true]){const c=new CombatController(),p={x:850,y:720,stamina:50};c.requestParry(0,1);c.flushActions(0,p);const events=['b','a'].map(id=>{const root={x:850,y:690},a=createEnemyAttack(id,1,'slime',-400,root,p);return advanceEnemyAttack(a,root,p,50,open)!;});if(reverse)events.reverse();expect(orderedContacts(events).map(e=>adjudicateContact(e,c,p,rules))).toEqual(['perfect','afterguard']);expect(c.autoCounter?.target).toBe('a');expect(p.stamina).toBe(56);expect(c.hitStopRemaining).toBe(75);}});
});
describe('真实攻击段、同步预测与暂停',()=>{
 it('预警、正式AI与接触裁决共用扩大的家园目标资格，村内不额外无敌',()=>{expect(enemyAttackPermitted({homeX:850,homeY:720},{x:850,y:720})).toBe(true);expect(enemyAttackPermitted({homeX:2450,homeY:1060},{x:2450,y:1130})).toBe(true);expect(enemyAttackPermitted({homeX:2450,homeY:1060},{x:3450,y:1060})).toBe(true);expect(enemyAttackPermitted({homeX:2450,homeY:1060},{x:4151,y:1060})).toBe(false);});
 for(const type of ['slime','leaf'])it(`${type}先扫描再首次接触，静止预测与真实接触一致`,()=>{
  const root={x:850,y:700},p={x:850,y:770},a=createEnemyAttack('a',1,type,0,root,p);advanceEnemyAttack(a,root,p,a.lockAt,open);const prediction=predictEnemyContact(a,root,p,0);expect(prediction).not.toBeNull();expect(advanceEnemyAttack(a,root,p,a.contactAt,open)).toBeNull();expect(a.resolved).toBe(false);expect(a.emitted).toBe(false);
  const event=advanceEnemyAttack(a,root,p,a.activeUntil,open)!;expect(event.at).toBeCloseTo(prediction!,5);expect(geometryTouches(event.geometry!,p)).toBe(true);expect(a.emitted).toBe(true);expect(advanceEnemyAttack(a,root,p,a.recoveryUntil,open)).toBeNull();expect(sampleEnemyAttack(a,a.activeUntil+10,root).phase).toBe('recovery');
 });
 it('有效段第一步无接触候选不消费攻击，空间无效裁决也不标resolved',()=>{const root={x:850,y:700},p={x:850,y:770},a=createEnemyAttack('a',1,'slime',0,root,p);const c=new CombatController();expect(adjudicateContact({at:450,attack:a,origin:root},c,{...p,stamina:100},rules)).toBe('invalid');expect(a.resolved).toBe(false);expect(advanceEnemyAttack(a,root,p,455,open)).toBeNull();expect(a.emitted).toBe(false);expect(advanceEnemyAttack(a,root,p,550,open)).not.toBeNull();});
 it('轻击冻结所有阶段时钟，姿态进度、预警趋势与接触一起延后',()=>{
  const root={x:2450,y:1060},p={x:2450,y:1130},a=createEnemyAttack('a',1,'slime',0,root,p);advanceEnemyAttack(a,root,p,200,open);const before=sampleEnemyAttack(a,200,root),pred=predictEnemyContact(a,root,p,200);delayEnemyAttack(a,75);const after=sampleEnemyAttack(a,275,root);expect(after.progress).toBe(before.progress);expect(after.warningProgress).toBe(before.warningProgress);expect(predictEnemyContact(a,root,p,275)).toBeCloseTo(pred!+75,5);
 });
 it('正式敌人前摇受击暂停，画面采样不继续前进',()=>{const e:EnemyBody={id:'slime-1',type:'slime',x:2450,y:1060,hp:48,homeX:2450,homeY:1060,cool:0,windup:0,staggerUntil:0,nav:enemyNavigation(),ai:'',disabled:false,recovered:false},p={x:2450,y:1110};updateEnemy(e,p,1,0);updateEnemy(e,p,101,100);const progress=sampleEnemyAttack(e.attack!,101,e).warningProgress;staggerEnemy(e,101,75);updateEnemy(e,p,176,75);expect(sampleEnemyAttack(e.attack!,176,e).warningProgress).toBeCloseTo(progress,7);expect(e.attack!.startedAt).toBe(76);});
 it('锁向后不追踪绕背；挥空完整收招并终结',()=>{const root={x:850,y:700},p={x:850,y:770},a=createEnemyAttack('a',1,'slime',0,root,p);advanceEnemyAttack(a,root,p,a.lockAt,open);p.y=640;expect(advanceEnemyAttack(a,root,p,a.activeUntil,open)).toBeNull();expect(a.direction.y).toBe(1);expect(a.resolved).toBe(true);expect(sampleEnemyAttack(a,600,root).phase).toBe('recovery');});
 it('身体冲刺沿碰撞扫掠，障碍后不产生预测与真实接触',()=>{const root={x:850,y:700},p={x:850,y:770},a=createEnemyAttack('a',1,'slime',0,root,p);const blocked={blocked:(_:number,y:number)=>y>708,clear:()=>true,melee:()=>false};expect(predictEnemyContact(a,root,p,0,blocked)).toBeNull();expect(advanceEnemyAttack(a,root,p,550,blocked)).toBeNull();expect(root.y).toBeLessThanOrEqual(708);expect(a.resolved).toBe(true);});
 it('轻击刚发生时预测包含尚未消耗的硬直，查询不修改正式实例',()=>{const root={x:850,y:700},p={x:850,y:770},a=createEnemyAttack('a',1,'slime',0,root,p);advanceEnemyAttack(a,root,p,200,open);const before=structuredClone(a),at=predictEnemyContact(a,root,p,200,open)!;expect(predictEnemyContact(a,root,p,200,open,75)).toBeCloseTo(at+75,5);expect(a).toEqual(before);});
 it('预测与真实出手共用移动边界，即使近战无遮挡也不能穿越禁行区域',()=>{const root={x:850,y:700},p={x:850,y:770},a=createEnemyAttack('a',1,'slime',0,root,p),space={...open,blocked:(_:number,y:number)=>y>708};expect(predictEnemyContact(a,root,p,0,space)).toBeNull();expect(advanceEnemyAttack(a,root,p,550,space)).toBeNull();expect(root.y).toBeLessThanOrEqual(708);});
 it('斜向沿碰撞角滑动时，首次接触点也不能把物理根插值进禁行区',()=>{
  const root={x:-.8,y:.2},d=Math.SQRT1_2,p={x:root.x+d*40.7,y:root.y-d*40.7},a=createEnemyAttack('corner',1,'slime',0,root,p);a.locked=true;
  const blocked=(x:number,y:number)=>x<0&&y<0,space={blocked,clear:(from:{x:number;y:number},to:{x:number;y:number})=>Array.from({length:101},(_,i)=>i/100).every(t=>!blocked(from.x+(to.x-from.x)*t,from.y+(to.y-from.y)*t)),melee:()=>true};
  const prediction=predictEnemyContact(a,root,p,0,space),event=advanceEnemyAttack(a,root,p,455,space);expect(event).not.toBeNull();expect(blocked(root.x,root.y)).toBe(false);expect(blocked(event!.origin.x,event!.origin.y)).toBe(false);expect(event!.at).toBeCloseTo(prediction!,4);
 });
 for(const [lead,result] of [[240,'charge'],[239.999,'normal'],[90,'normal'],[89.999,'perfect'],[0,'perfect'],[-.001,'none'],[null,'none']] as const)it(`提示与窗口${lead}`,()=>expect(warningQuality(lead)).toBe(result));
 it('模拟轨迹30/60/120Hz与抖动首次接触一致',()=>{
  const values=[[1000/30],[1000/60],[1000/120],[7,41,13,29]].map(steps=>{const root={x:850,y:700},p={x:850,y:770},a=createEnemyAttack('a',1,'slime',0,root,p);let now=0,event:EnemyContact|null=null,index=0;while(now<850){now=Math.min(850,now+steps[index++%steps.length]);event??=advanceEnemyAttack(a,root,p,now,open);}return event!.at;});for(const value of values)expect(value).toBeCloseTo(values[0],4);
 });
 it('同帧接触先于晚到输入，等时输入先裁决；停顿输入仍到达',()=>{
  for(const inputAt of [9.999,10,10.001]){const c=new CombatController(),p={x:850,y:720,stamina:100},root={x:850,y:690},a=createEnemyAttack('a',1,'slime',-440,root,p),clock=new CombatTimeline();let event:EnemyContact|null=null,result='';const resolve=(now:number,early=false)=>{if(event&&(!early||event.at<now-1e-7)){result=adjudicateContact(event,c,p,rules);event=null;}};
   clock.frame(0,50,50,[{kind:'parry',at:inputAt,sequence:1,axis:{x:0,y:-1}}],c,{boundary:()=>Infinity,advance:(_,now)=>{const e=advanceEnemyAttack(a,root,p,now,open);if(e)event=e;},beforeInput:now=>resolve(now,true),input:(events,now)=>c.requestActions(events as any,now,p,0),resolve:now=>{c.flushActions(now,p);resolve(now);}});expect(result).toBe(inputAt<=10?'perfect':'hurt');
  }
 });
});
it('成功呈现受力与接触闪，拨开连续接正式反斩，四向根与武器像素一致',async()=>{
 const a=arena('perfect');expect(parryVisual(a.c.parry!,a.at).phase).toBe('brace');expect(parryVisual(a.c.parry!,a.at+20).phase).toBe('deflect');
 const {data,info}=await sharp('public/assets/animation/hero-parry-v2.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});expect([info.width,info.height]).toEqual([960,480]);
 for(const facing of [0,1,2,3] as const){const attack:Attack={id:1,stage:1,start:0,facing,hit:new Set(),counter:'normal',config:attackConfig({stage:1,counter:'normal'})};
  for(const time of [0,20,55,170]){const visual=counterVisual(attack,time,false);expect(visual.texture).toBe('hero-parry-v2');const tip=visual.weapon!.tip,x=Math.round(80+tip.x*160/145*(facing===2?-1:1)),y=Math.round(154+tip.y*160/145);let opaque=0;for(let dy=-5;dy<=5;dy++)for(let dx=-5;dx<=5;dx++){const px=visual.frame%6*160+x+dx,py=Math.floor(visual.frame/6)*160+y+dy;if(px>=0&&py>=0&&px<info.width&&py<info.height&&data[(py*info.width+px)*4+3]>30)opaque++;}expect(opaque,`${facing}/${time}真实剑尖像素`).toBeGreaterThan(2);}
  const trail=new WeaponTrail();for(let time=47;time<170;time+=8)trail.update(time,attack,{x:850,y:720},0);expect(trail.samples.every(s=>s.counter==='normal')).toBe(true);expect(trail.segments(170).length).toBeGreaterThan(4);
 }
 for(let pose=0;pose<6;pose++){expect(parryWeapon(2,pose).tip.x).toBe(-parryWeapon(3,pose).tip.x);expect(parryWeapon(2,pose).tip.y).toBe(parryWeapon(3,pose).tip.y);}
});
