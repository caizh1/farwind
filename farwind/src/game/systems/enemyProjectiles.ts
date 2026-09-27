import { createEnemyAttack, SPORE, sporeOrigin, sporeContactAt, type EnemyAttack, type EnemyContact } from './enemyAttack';
import { clearMeleeLine, type Point } from './obstacles';

export type SporeShot = Point & { id: string; attack: EnemyAttack; born: number; now: number; state: 'flying' | 'contact' | 'burst'; burstAt?: number; deflected?: boolean };
export class EnemyProjectiles {
  shots: SporeShot[]=[];
  reset(){this.shots=[];}
  launch(attack: EnemyAttack, root: Point, now: number) {
    if(attack.type!=='spore'||attack.cancelled||attack.launched||now<attack.contactAt)return;
    attack.launched=true;attack.emitted=true;
    const origin=sporeOrigin(root,attack.direction),a=createEnemyAttack(attack.attackerId,0,'spore',attack.contactAt,origin,{x:origin.x+attack.direction.x,y:origin.y+attack.direction.y});
    Object.assign(a,{attackId:attack.attackId+':spore',direction:{...attack.direction},locked:true,startedAt:attack.contactAt,lockAt:attack.contactAt,contactAt:attack.contactAt,activeUntil:attack.contactAt+SPORE.life,recoveryUntil:attack.contactAt+SPORE.life,chargeSound:true,strikeSound:true});
    this.shots.push({...origin,id:a.attackId,attack:a,born:attack.contactAt,now:attack.contactAt,state:'flying'});
  }
  update(now: number,target: Point,clear=clearMeleeLine): EnemyContact[] {
    const contacts:EnemyContact[]=[];
    for(const shot of this.shots){
      if(shot.state!=='flying')continue;
      const end=Math.min(now,shot.born+SPORE.life),d=shot.attack.direction,old={x:shot.x,y:shot.y};
      const at=sporeContactAt(old,d,target,shot.now,end,clear);
      const dt=Math.max(0,end-shot.now),next={x:old.x+d.x*SPORE.speed*dt/1000,y:old.y+d.y*SPORE.speed*dt/1000};
      if(at!==null){const travel=SPORE.speed*(at-shot.now)/1000;shot.x=old.x+d.x*travel;shot.y=old.y+d.y*travel;
        shot.state='contact';shot.attack.emitted=true;shot.attack.actualContactAt=at;
        const p={x:shot.x,y:shot.y};contacts.push({at,attack:shot.attack,origin:p,geometry:{a:p,b:p,radius:SPORE.radius},projectileId:shot.id});
      }else if(!clear(old,next)||now>=shot.born+SPORE.life){shot.state='burst';shot.burstAt=now;shot.attack.resolved=true;}
      else Object.assign(shot,next);
      shot.now=end;
    }
    this.shots=this.shots.filter(s=>s.state!=='burst'||now-(s.burstAt??now)<SPORE.burst);
    return contacts;
  }
  settle(id:string,now:number,deflected:boolean){const shot=this.shots.find(s=>s.id===id);if(!shot)return;shot.state='burst';shot.burstAt=now;shot.deflected=deflected;}
  prediction(shot:SporeShot,target:Point){return shot.state==='flying'?sporeContactAt(shot,shot.attack.direction,target,shot.now,shot.born+SPORE.life):null;}
}
