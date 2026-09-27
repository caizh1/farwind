import {describe,it,expect} from 'vitest';
import {initialDefense,validateDefense} from '../src/game/systems/defenseState';
import {EastDefense,prepareRaid} from '../src/game/systems/defense';
const player={x:670,y:720,hp:100};
const ready=()=>{const s=initialDefense();s.protectionMs=s.cooldownMs=0;return s;};
describe('安全防御反例与正常对照',()=>{
 it('健康正常的防线允许正式调度预警',()=>{const s=ready(),d=new EastDefense(s,0);d.update(5,5,player,{queries:2});expect(s.raid?.phase).toBe('warning');});
 it('全员低血不会创建新预警',()=>{const s=ready();s.guards.forEach(g=>g.hp=1);const d=new EastDefense(s,0);d.update(5,5,player,{queries:2});expect(s.raid).toBeNull();expect(s.retryMs).toBeGreaterThan(0);});
 it('永久全员死亡不会创建新预警或复活',()=>{const s=ready();s.guards.forEach(g=>Object.assign(g,{hp:0,dead:true,mode:'dead'}));const d=new EastDefense(s,0);d.update(5,5,player,{queries:2});expect(s.raid).toBeNull();expect(validateDefense(s).guards.every(g=>g.dead)).toBe(true);});
 it('真正入侵且在射程内可放箭，移出射程不能新放箭',()=>{const d=new EastDefense(prepareRaid(initialDefense(),player,'east-gate'),0),g=d.state.guards[2],e=d.enemies[0];Object.assign(e,{x:2260,y:1090});d.update(5,5,player,{queries:2});d.fire(g,e,'正常箭');expect(d.arrows).toHaveLength(1);Object.assign(e,{x:2590,y:1090});d.fire(g,e,'越界箭');expect(d.arrows).toHaveLength(1);});
 it('射手死亡取消新射击，已经射出的箭继续有限飞行',()=>{const d=new EastDefense(prepareRaid(initialDefense(),player,'east-gate'),0),g=d.state.guards[2],e=d.enemies[0];Object.assign(e,{x:2260,y:1090});d.update(5,5,player,{queries:2});d.fire(g,e,'在途箭');expect(d.arrows).toHaveLength(1);d.damageGuard({sourceId:'hostile',targetId:g.id,attackId:'致死',amount:1000,sourceType:'enemy-melee',eventId:null},{id:'hostile',hp:10});expect(d.arrows).toHaveLength(1);d.fire(g,e,'死后新箭');expect(d.arrows).toHaveLength(1);d.updateArrows(1000);expect(e.hp).toBe(26);expect(d.arrows).toEqual([]);});
 it('正式新事件可以只有一只弱怪',()=>{const s=prepareRaid(initialDefense(),player,'north-gate',1,true);expect(s.raid?.members).toHaveLength(1);expect(s.raid?.members[0].type).toBe('slime');});
});
