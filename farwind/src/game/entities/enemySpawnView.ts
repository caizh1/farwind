import type Phaser from 'phaser';
import {SPAWN_CUE,type SpawnCue} from '../systems/encounterRuntime';

// 共用一层地面图形；时间来自战斗时钟，暂停与场景重建不会留下独立计时器。
export function drawSpawnCues(ink:Phaser.GameObjects.Graphics,cues:Iterable<SpawnCue>,now:number){
  ink.clear();
  for(const c of cues){
    const u=Math.max(0,Math.min(1,(now-c.startedAt)/SPAWN_CUE.lead));
    const alpha=c.spawned?Math.max(0,1-(now-c.readyAt)/SPAWN_CUE.fade):.65+.35*u;
    const r=c.spawned?54+(now-c.readyAt)*.08:44+10*u,y=r*.52;
    ink.fillStyle(0xebb06a,.12*alpha).fillEllipse(c.x,c.y,r*2,y*2);
    ink.lineStyle(12,0xffc97d,.14*alpha).strokeEllipse(c.x,c.y,r*2,y*2)
      .lineStyle(7,0x372237,.92*alpha).strokeEllipse(c.x,c.y,r*2,y*2)
      .lineStyle(4,0xf6b468,alpha).strokeEllipse(c.x,c.y,r*2,y*2)
      .lineStyle(1.5,0xfff3d5,alpha).strokeEllipse(c.x,c.y,r*2,y*2);
    if(c.spawned)continue;
    const inner=r*(.85-.65*u);
    ink.lineStyle(2,0xffecd3,.8*alpha).strokeEllipse(c.x,c.y,inner*2,inner);
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4+u*.35,dx=Math.cos(a),dy=Math.sin(a)*.52;
      ink.lineStyle(3,0xffedd0,alpha).lineBetween(c.x+dx*(r-6),c.y+dy*(r-6),c.x+dx*(r+5),c.y+dy*(r+5));
      const rise=((u+i/8)%1)*28;
      ink.fillStyle(0xffe1a6,.6*alpha).fillCircle(c.x+dx*r*.7,c.y+dy*r*.7-rise,1.5);
    }
  }
}
