import {activeHostileCount} from './combatUnitBudget';
import type {World} from '../scenes/World';
// 自主键鼠验收只读出口：无授予、传送、伤害或进度写入接口，正式构建亦不能借此改变世界。
const enabled=typeof location!=='undefined'&&new URLSearchParams(location.search).has('combatObservation');
const samples=new Uint32Array(1001);let activeMs=0,count=0,maxBodies=0,maxTextures=0,next=0;
export function observeCombat(w:World,delta:number){
 if(!enabled)return;
 const active=w.active&&!w.ui.paused&&!document.hidden&&!w.economy.busy&&!w.defenseSaving&&!w.wilderness?.saving&&!w.wilderness?.checkpointFailed;
 if(active&&Number.isFinite(delta)&&delta>0){samples[Math.min(1000,Math.ceil(delta))]++;count++;activeMs+=delta;}
 maxBodies=Math.max(maxBodies,activeHostileCount(w));maxTextures=Math.max(maxTextures,w.textures.getTextureKeys().length);
 if(performance.now()<next)return;next=performance.now()+120;
 let seen=0,p95=0;for(let i=0;i<samples.length;i++){seen+=samples[i];if(seen>=count*.95){p95=i;break;}}
 let node=document.querySelector<HTMLOutputElement>('#combat-observation');if(!node){node=document.createElement('output');node.id='combat-observation';node.hidden=true;document.body.append(node);}
 node.textContent=JSON.stringify({说明:'只读真实运行记录；使用键鼠操作，不提供测试授予。',生产构建:!import.meta.env.DEV,时间:w.sim,活动:w.active,暂停:w.ui.paused,界面:w.ui.mode,位置:{x:w.state.player.x,y:w.state.player.y},生命:w.state.player.hp,体力:w.state.player.stamina,主线:w.state.quest,交互:w.target?.id??null,动作:w.combat.attack?{开始:w.combat.attack.start,段:w.combat.attack.stage}:null,风赐:w.state.windGifts,同行:{小宝:{安排:w.state.xiaobao.task,场所:w.state.xiaobao.space,x:w.state.xiaobao.x,y:w.state.xiaobao.y,生命:w.state.xiaobao.hp},小黑:{默契:w.state.catBond.score}},远征:w.state.windMemory.active?{方向:w.state.windMemory.active.direction,完成:w.state.windMemory.active.finished}:null,遭遇:Object.fromEntries(Object.entries(w.combatEncounters.groups).map(([id,g])=>[id,{激活:g.activated,波:g.wave,预兆:g.waveWarning,已清:g.cleared,驻守:g.rewarded,首领:g.boss?.stage,成员:g.activated?g.members.map(u=>({身份:u.id,血:u.hp,死亡:u.defeated})):undefined}])),接触:w.contactHistory.slice(-16),敌人:[...w.enemies,...w.defense.enemies].filter(e=>e.hp>0).map(e=>({身份:e.id,物种:e.type,首领:e.boss,血:e.hp,x:e.x,y:e.y,阶段:e.bossBattle?.phase,免伤到:e.bossBattle?.entryUntil,变形到:e.bossBattle?.transformUntil,攻击:e.attack&&!e.attack.cancelled?{技能:e.attack.bossSkill,锁定:e.attack.locked,锁向:e.attack.lockAt,命中:e.attack.contactAt,结束:e.attack.recoveryUntil,方向:e.attack.direction,可弹反:e.attack.parryable}:null})),保存:w.loaded?{结构:w.loaded.schema_version,内容:w.loaded.content_version}:null,性能:{有效运行毫秒:Math.round(activeMs),帧数:count,P95毫秒:p95,平均帧毫秒:count?activeMs/count:0,活动单位峰值:maxBodies,纹理峰值:maxTextures,当前对象:w.children.length,首领纹理:w.enemyView.boss.assets.current??null}});
}
