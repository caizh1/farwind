import { createEnemyAttack, advanceEnemyAttack, type EnemyAttack, type EnemyContact } from "./enemyAttack";
import type { CombatController } from "./combat";
import { defends, type ContactResult } from "./contact";
import type { Point } from "./obstacles";
export type PracticeMode="off"|"slow"|"slime"|"leaf"|"chain";
export const PRACTICE={slow:900,near:185,gap:1400} as const;
export class ParryTraining {
  mode:PracticeMode="off";
  target:(Point&{id:string})|null=null;
  attack:EnemyAttack|null=null;
  serial=0;
  next=0;
  chainOwner=-1;
  feedback="面向木桩，观察风纹收拢，再按 K／右键。";
  lastContact:{at:number;result:ContactResult}|null=null;
  reset() {this.mode="off";this.target=null;this.attack=null;this.next=0;this.lastContact=null;this.chainOwner=-1;}
  select(mode:PracticeMode,target:Point&{id:string},now:number) {
    this.reset();this.mode=mode;this.target=target;this.next=mode==="chain"?now:now+500;
    this.feedback=mode==="chain"?"先按 J 轻击；收手后 K 弹反，再主动 J 接三连。":"面向木桩，风纹收拢到剑边时按 K／右键。";
  }
  started(now:number) {
    if(this.lastContact?.result==="hurt"&&now>this.lastContact.at&&now-this.lastContact.at<180)
      this.feedback=`按晚 · 接触后 ${Math.round(now-this.lastContact.at)} 毫秒架剑`;
  }
  update(now:number,p:Point,c:CombatController):EnemyContact|null {
    const t=this.target;
    if(this.mode==="off"||!t)return null;
    if(Math.hypot(p.x-t.x,p.y-t.y)>PRACTICE.near){this.reset();return null;}
    if(this.attack) {
      const event=advanceEnemyAttack(this.attack,t,p,now);
      if(now>=this.attack.recoveryUntil){this.attack=null;this.next=now+PRACTICE.gap;}
      return event?{...event,training:true}:null;
    }
    if(now<this.next)return null;
    if(this.mode==="chain") {
      if(c.attack?.stage!==1||c.attack.id===this.chainOwner||c.attack.counter)return null;
      this.chainOwner=c.attack.id;
    }
    this.attack=createEnemyAttack(t.id,++this.serial,this.mode==="leaf"?"leaf":"slime",now,t,p,this.mode==="slow"?PRACTICE.slow:undefined);
    return null;
  }
  observe(contact:EnemyContact,result:ContactResult,c:CombatController,p:Point) {
    this.lastContact={at:contact.at,result};
    if(result==="normal"||result==="perfect") {
      const elapsed=contact.at-c.parry!.start;
      this.feedback=`${result==="perfect"?"精准成功":"普通成功"} · 提前 ${Math.round(elapsed)} 毫秒 · J 反击，再接二、三刀`;
    } else if(result==="invalid")this.feedback="未接触 · 距离或遮挡使来招挥空";
    else if(result==="hurt") {
      const a=c.parry??c.lastParry;
      const attempted=(c.lastParryRequestAt??-Infinity)>=contact.attack.startedAt;
      this.feedback=attempted&&c.lastRejection==="体力不足"?"体力不足 · 未启动、未扣费":c.parryPending||attempted&&c.lastRejection==="动作不可取消"?"动作不可取消 · 预输入未赶上接触":
        c.parryQuality(contact.at)&&!defends(c.parry!.facing,contact.origin,p)?"朝向错误 · 来招在防御扇形之外":
          a&&a.start>=contact.attack.startedAt&&a.start<=contact.at&&contact.at-a.start>=180?`按早 · 提前 ${Math.round(contact.at-a.start)} 毫秒，窗口已结束`:"未架剑 · 接触已经发生";
    } else if(result==="afterguard")this.feedback="余势格挡 · 没有追加奖励";
    else this.feedback="已有保护免疫 · 没有弹反奖励";
  }
  boundary(now:number) {
    return Math.min(...[this.attack?.lockAt??Infinity,this.attack?.contactAt??Infinity,this.attack?.recoveryUntil??Infinity,this.next].filter(t=>t>now+1e-7));
  }
  snapshot() {return {mode:this.mode,next:this.next,target:this.target,attack:this.attack,feedback:this.feedback,lastContact:this.lastContact};}
}
