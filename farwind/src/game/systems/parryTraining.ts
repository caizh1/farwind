import {createEnemyAttack,advanceEnemyAttack,sampleEnemyAttack,predictEnemyContact,delayEnemyAttack,type EnemyAttack,type EnemyContact} from "./enemyAttack";
import {PARRY,type CombatController} from "./combat";
import {defends,type ContactResult} from "./contact";
import type {Point} from "./obstacles";
export type PracticeMode="off"|"slow"|"slime"|"leaf"|"spore"|"boar"|"raven"|"chain";
export const PRACTICE={slow:900,near:185,gap:1400} as const;
export class ParryTraining {
 mode:PracticeMode="off";target:(Point&{id:string})|null=null;attack:EnemyAttack|null=null;
 projection:(Point&{id:string;hp:number;kind:"trainingProjection";type:string;staggerUntil:number;staggerSince?:number;parried?:{at:number;until:number;direction:Point;perfect:boolean}})|null=null;
 serial=0;next=0;chainOwner=-1;indicators=true;previous=0;
 feedback="面向练习投影，观察蓄力与出手；K 架剑，成功自动反斩。";
 lastContact:{at:number;result:ContactResult}|null=null;
 reset(){this.mode="off";this.target=null;this.attack=null;this.projection=null;this.next=0;this.lastContact=null;this.chainOwner=-1;}
 select(mode:PracticeMode,target:Point&{id:string},now:number,p:Point=target){
  this.reset();this.mode=mode;this.target=target;this.next=mode==="chain"?now:now+500;this.previous=now;
  const d=Math.hypot(p.x-target.x,p.y-target.y)||1;
  this.projection=mode==="off"?null:{id:`practice-${target.id}`,x:target.x+(p.x-target.x)/d*34,y:target.y+(p.y-target.y)/d*34,hp:1,kind:"trainingProjection",staggerUntil:0,type:["leaf","spore","boar","raven"].includes(mode)?mode:"slime"};
  this.feedback=mode==="chain"?"先 J 轻击；收手 K，成功自动反斩；J 接二、三刀。":mode==="spore"?"远程弹反自动发出剑气；J 接第二刀。观察孢子飞行，面向来弹架剑。":"投影与正式怪物共用出手动作；K 成功自动反斩，J 接连击。";
 }
 started(now:number){if(this.lastContact?.result==="hurt"&&now>this.lastContact.at&&now-this.lastContact.at<180)this.feedback=`按晚 · 接触后 ${Math.round(now-this.lastContact.at)} 毫秒架剑`;}
 update(now:number,p:Point,c:CombatController):EnemyContact|null {
  const t=this.target,body=this.projection;if(this.mode==="off"||!t||!body)return null;
  if(Math.hypot(p.x-t.x,p.y-t.y)>PRACTICE.near){this.reset();return null;}
  const prev=this.previous;this.previous=now;
  if(this.attack){const frozen=Math.max(0,Math.min(now,body.staggerUntil)-Math.max(prev,body.staggerSince??prev));if(!this.attack.cancelled)delayEnemyAttack(this.attack,frozen);if(now<body.staggerUntil)return null;const event=advanceEnemyAttack(this.attack,body,p,now);if(now>=this.attack.recoveryUntil){
   if(!this.attack.emitted)this.feedback="未接触 · 来招挥空；不归类为按晚";
   this.attack=null;this.next=now+PRACTICE.gap;
  }return event?{...event,training:true}:null;}
  if(now<this.next||body.parried&&now<body.parried.until)return null;
  if(this.mode==="chain"){if(c.attack?.stage!==1||c.attack.id===this.chainOwner||c.attack.counter)return null;this.chainOwner=c.attack.id;}
  const d=Math.hypot(p.x-t.x,p.y-t.y)||1;body.x=t.x+(p.x-t.x)/d*34;body.y=t.y+(p.y-t.y)/d*34;
  this.attack=createEnemyAttack(body.id,++this.serial,body.type,now,body,p,this.mode==="slow"?PRACTICE.slow:undefined);
  return null;
 }
 observe(contact:EnemyContact,result:ContactResult,c:CombatController,p:Point){
  this.lastContact={at:contact.at,result};
  if(result==="normal"||result==="perfect"){this.feedback=`${result==="perfect"?"精准成功":"普通成功"} · 提前 ${Math.round(contact.at-c.parry!.start)} 毫秒${contact.projectileId?" · 自动剑气；J 接第二刀":""}`;}
  else if(result==="invalid")this.feedback="未接触 · 距离或遮挡使来招挥空";
  else if(result==="hurt"){
   const a=c.parry??c.lastParry,attempted=(c.lastParryRequestAt??-Infinity)>=contact.attack.startedAt;
   this.feedback=attempted&&c.lastRejection==="体力不足"?"体力不足 · 未启动、未扣费":c.parryPending||attempted&&c.lastRejection==="动作不可取消"?"动作锁定 · 预输入未赶上接触":c.parryQuality(contact.at)&&!defends(c.parry!.facing,contact.origin,p,contact.attack.direction)?"方向错误 · 来招在防御范围外":a&&a.start>=contact.attack.startedAt&&a.start<=contact.at&&contact.at-a.start>=PARRY.active?`按早 · 提前 ${Math.round(contact.at-a.start)} 毫秒，窗口已结束`:"未架剑 · 接触已经发生";
  }else if(result==="afterguard")this.feedback="余势格挡 · 没有追加奖励";else this.feedback="已有保护免疫 · 没有弹反奖励";
 }
 boundary(now:number){return Math.min(...[this.attack?.lockAt??Infinity,this.attack?.contactAt??Infinity,this.attack?.activeUntil??Infinity,this.attack?.recoveryUntil??Infinity,this.next].filter(t=>t>now+1e-7));}
 snapshot(now=0,p?:Point){return {mode:this.mode,next:this.next,target:this.target,projection:this.projection,attack:this.attack,indicators:this.indicators,pose:this.attack&&this.projection?sampleEnemyAttack(this.attack,now,this.projection):null,predictedContact:this.attack&&this.projection&&p?predictEnemyContact(this.attack,this.projection,p,now,undefined,Math.max(0,this.projection.staggerUntil-now)):null,feedback:this.feedback,lastContact:this.lastContact};}
}
