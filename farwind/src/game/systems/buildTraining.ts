import type {World} from '../scenes/World';
import type {Attack} from './combat';
import {isWindAttack} from './combat';
import type {BuildLesson} from '../../data/windLessons';
import {TRAINING,FIELD_TARGETS} from './training';
import {grantMilestoneRunes} from './runeState';
import {save} from './save';

export const BUILD_TRAINING:Record<BuildLesson,{name:string;hint:string}>={
 melee:{name:'四连入门',hint:'面向木桩，J／左键依次接三刀，实际命中同一组即可学会四连终结并获得续势。'},
 finisher:{name:'破岸终结',hint:'在木桩前完成一组四刀实际命中，领取破岸；原东路奖励途径仍然保留。'},
 'wind-advance':{name:'回流训练',hint:'装备回风，在练习木桩或稻草人前按 I／中键送风，60秒内完成两次去程与回程命中同一目标，即解锁回风进阶。'},
 'resume-advance':{name:'借势训练',hint:'装备续势，第二刀挥击结束后按 L 调整站位，700毫秒内按 J 接回第三刀并命中木桩；完成两组即解锁进阶。'},
};

// 只观察正式结算的练习目标接触；不写血量、背包或任务结果来模拟训练。
const trainingTargets=[TRAINING,...FIELD_TARGETS];
export function nearBuildTraining(p:{x:number;y:number},radius:number=TRAINING.near){return trainingTargets.some(t=>Math.hypot(p.x-t.x,p.y-t.y)<radius);}
export class BuildTraining {
 active:BuildLesson|null=null;until=0;saving=false;
 combos=new Map<number,Set<number>>();out=new Set<string>();completed=new Set<number>();
 constructor(private w:World){}
 clear(){this.active=null;this.combos.clear();this.out.clear();this.completed.clear();}
 open(){
  const w=this.w;
  w.ui.dialog('练习场教本','本领永久保留，不占符文槽。J／左键即时近战；I／鼠标中键独立剑风，按住持续施放；K架剑，L风步。训练只需短暂实际应用，无材料费用。');
  const group=document.createElement('div');group.className='lesson-actions';
  for(const [id,d] of Object.entries(BUILD_TRAINING) as [BuildLesson,typeof BUILD_TRAINING[BuildLesson]][]){
   const b=document.createElement('button');b.textContent=w.state.skills.buildLessons.includes(id)?`${d.name} · 已完成`:`开始${d.name}`;
   b.disabled=w.state.skills.buildLessons.includes(id)||id!=='melee'&&!w.state.skills.meleeFinisher&&id!=='wind-advance'||id==='wind-advance'&&!w.state.runes.slots.includes('r31')||id==='resume-advance'&&!w.state.runes.slots.includes('r33');
   b.onclick=()=>{this.clear();this.active=id;this.until=w.sim+60000;w.ui.close(true);w.ui.message(d.hint);};group.append(b);
  }
  const hint=document.createElement('p');hint.textContent='回流训练需先到南侧木桥学会剑风并装备回风；借势训练需装备续势。进阶后按 R 在安全状态免费选择或切换互斥分支。';group.append(hint);
  w.ui.modal.querySelector('.dialog-copy')!.append(group);
 }
 observe(a:Attack,targetId:string){
  const id=this.active,w=this.w;
  if(!id||this.saving||!trainingTargets.some(t=>t.id===targetId)||w.state.player.hp<=0)return;
  if(w.sim>this.until||w.state.life.playerSpace!=='village'||!nearBuildTraining(w.state.player,450)){this.clear();return;}
  if(isWindAttack(a)){
   if(id!=='wind-advance'||a.kind!=='swordWind'||!w.state.runes.slots.includes('r31'))return;
   const key=`${a.id}:${targetId}`;
   if(a.windLeg!=='back')this.out.add(key);
   else if(this.out.has(key)&&!this.completed.has(a.id)){
    this.completed.add(a.id);w.ui.message(`回流训练：去程与回程已完成 ${this.completed.size}/2。`);
   }
   if(this.completed.size>=2)void this.complete(id);
   return;
  }
  if(a.counter)return;
  const combo=a.comboId??a.id,stages=this.combos.get(combo)??new Set<number>();stages.add(a.stage);this.combos.set(combo,stages);
  if(this.combos.size>8)this.combos.delete(this.combos.keys().next().value!);
  if(id==='melee'&&[1,2,3].every(n=>stages.has(n)))void this.complete(id);
  if(id==='finisher'&&a.isFinisher&&[1,2,3,4].every(n=>stages.has(n)))void this.complete(id);
  if(id==='resume-advance'&&a.resumed&&w.state.runes.slots.includes('r33')){
   this.completed.add(combo);if(this.completed.size>=2)void this.complete(id);
  }
 }
 async complete(id:BuildLesson){
  const w=this.w;if(this.saving)return;this.saving=true;
  try{
   await w.economy.run(()=>w.state,s=>{
    const next=structuredClone(s);
    if(!next.skills.buildLessons.includes(id))next.skills.buildLessons.push(id);
    if(id==='melee')next.skills.meleeFinisher=true;
    if(id==='wind-advance')next.runes.growth.r31.advanced=true;
    if(id==='resume-advance')next.runes.growth.r33.advanced=true;
    grantMilestoneRunes(next,s);return next;
   },save,next=>w.publishState(next));
   this.clear();w.ui.message(`${BUILD_TRAINING[id].name}完成，正式进度已保存。R 查看符文与进阶。`);
  }catch(e){w.ui.message(`训练结果未保存：${(e as Error).message}；再次有效命中可重试保存。`);}
  finally{this.saving=false;}
 }
 snapshot(){return {active:this.active,completed:this.completed.size,remaining:Math.max(0,this.until-this.w.sim)};}
}
