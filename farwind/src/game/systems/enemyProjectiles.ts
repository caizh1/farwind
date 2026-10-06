import {projectilePathClear} from './projectileGeometry';
import {sweptTargetContact} from './swordWindGeometry';
import { createEnemyAttack, sporeDirections, SPORE, sporeOrigin, sporeContactAt, projectileProfile, type EnemyAttack, type EnemyContact } from './enemyAttack';
import { clearMeleeLine, type Point } from './obstacles';
import type {ReleasedAttack} from './damage';

export type SporeShot = Point & { id: string; attack: EnemyAttack; born: number; now: number; state: 'flying' | 'contact' | 'burst'; burstAt?: number; deflected?: boolean; travelled?:number; released:ReleasedAttack };
export class EnemyProjectiles {
  speedScale:(shot:SporeShot)=>number=()=>1;
  shots: SporeShot[]=[];
  previous=new Map<string,Point>();
  reset(){this.shots=[];this.previous.clear();}
  launch(attack: EnemyAttack, root: Point, now: number) {
    if((!['spore','archer'].includes(attack.type)&&!attack.bossShotAngles)||attack.boss&&!attack.bossShotAngles||attack.cancelled||attack.launched||now<attack.contactAt)return;
    attack.launched=true;attack.emitted=true;
    const profile=projectileProfile(attack);
    for(const [index,direction] of sporeDirections(attack).entries()){
    const origin=sporeOrigin(root,direction,!!attack.boss),a=createEnemyAttack(attack.attackerId,0,attack.type==='archer'?'archer':'spore',attack.contactAt,origin,{x:origin.x+direction.x,y:origin.y+direction.y});
    Object.assign(a,{attackId:attack.attackId+':spore'+(attack.elite==='brood'||attack.boss||attack.shotAngles?`:${index}`:''),...attack.boss?{boss:attack.boss,bossAttempt:attack.bossAttempt,bossSkill:attack.bossSkill,bossPart:attack.bossPart}:{},memoryDamageScale:attack.memoryDamageScale,memoryFrequency:attack.memoryFrequency,memoryRecoveryWait:attack.memoryRecoveryWait,projectile:{...profile},eventId:attack.eventId??null,combatTier:attack.combatTier,damage:attack.damage,direction:{...direction},locked:true,startedAt:attack.contactAt,lockAt:attack.contactAt,contactAt:attack.contactAt,activeUntil:attack.contactAt+profile.life,recoveryUntil:attack.contactAt+profile.life,chargeSound:true,strikeSound:true});
    this.shots.push({...origin,id:a.attackId,attack:a,born:attack.contactAt,now:attack.contactAt,state:'flying',released:Object.freeze({sourceId:attack.attackerId,faction:'hostile',attackId:a.attackId,amount:a.damage,sourceType:'enemy-shot',eventId:attack.eventId??null})});
    }
  }
  update(now: number,target: Point,clear=clearMeleeLine,others:readonly (Point&{id:string})[]=[]): EnemyContact[] {
    const contacts:EnemyContact[]=[];
    for(const shot of this.shots){
      if(shot.state!=='flying')continue;
      const profile=projectileProfile(shot.attack),speed=Math.max(0,profile.speed*this.speedScale(shot));
      const remaining=Math.max(0,profile.distance-(shot.travelled??Math.min(profile.distance,(shot.now-shot.born)*profile.speed/1000)));
      const end=Math.min(now,shot.born+profile.life,shot.now+(speed?remaining/speed*1000:Infinity)),d=shot.attack.direction,old={x:shot.x,y:shot.y};
      const dt=Math.max(0,end-shot.now),next={x:old.x+d.x*speed*dt/1000,y:old.y+d.y*speed*dt/1000};
      const candidate=[{...target,id:'player'},...others].map(t=>{
        const last=this.previous.get(t.id)??t,part=now>shot.now?(end-shot.now)/(now-shot.now):1,current={x:last.x+(t.x-last.x)*part,y:last.y+(t.y-last.y)*part};
        const fraction=sweptTargetContact(old,next,last,current,profile.radius);
        return {t,fraction,point:fraction===null?null:{x:last.x+(current.x-last.x)*fraction,y:last.y+(current.y-last.y)*fraction}};
      }).filter(c=>c.fraction!==null).sort((a,b)=>a.fraction!-b.fraction!||a.t.id.localeCompare(b.t.id))[0];
      const fraction=candidate?.fraction??null,point=fraction===null?next:{x:old.x+(next.x-old.x)*fraction,y:old.y+(next.y-old.y)*fraction};
      if(fraction!==null&&projectilePathClear(old,point,profile.radius,clear)){
        const at=shot.now+dt*fraction;shot.x=point.x;shot.y=point.y;
        shot.state='contact';shot.attack.emitted=true;shot.attack.actualContactAt=at;
        contacts.push({at,attack:shot.attack,origin:point,geometry:{a:point,b:point,radius:profile.radius},projectileId:shot.id,targetId:candidate.t.id,sampledPoint:candidate.point!});
      }else if(!projectilePathClear(old,next,profile.radius,clear)||now>=shot.born+profile.life||speed*dt/1000>=remaining-1e-7){shot.state='burst';shot.burstAt=now;shot.attack.resolved=true;}
      else Object.assign(shot,next);
      shot.travelled=(shot.travelled??(shot.now-shot.born)*profile.speed/1000)+Math.hypot(shot.x-old.x,shot.y-old.y);
      shot.now=end;
    }
    this.previous=new Map([{...target,id:'player'},...others].map(t=>[t.id,{x:t.x,y:t.y}]));
    this.shots=this.shots.filter(s=>s.state!=='burst'||now-(s.burstAt??now)<SPORE.burst);
    return contacts;
  }
  settle(id:string,now:number,deflected:boolean){const shot=this.shots.find(s=>s.id===id);if(!shot)return;shot.state='burst';shot.burstAt=now;shot.deflected=deflected;}
  prediction(shot:SporeShot,target:Point){const profile=projectileProfile(shot.attack);return shot.state==='flying'?sporeContactAt(shot,shot.attack.direction,target,shot.now,shot.born+profile.life,clearMeleeLine,profile.speed*this.speedScale(shot),profile.radius):null;}
}
