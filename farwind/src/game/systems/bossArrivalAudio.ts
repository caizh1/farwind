import type {CampBossKind} from '../../data/maps/windbell/campBosses';
// 四种材质的入场声共用现有音频总线与暂停清理，没有另一套播放器。
export function synthBossArrival(kind:CampBossKind,rate:number){
 const duration=1.25,data=new Float32Array(Math.ceil(rate*duration));let seed=721,low=0,phase=0;
 for(let i=0;i<data.length;i++){
  const t=i/rate,u=t/duration,envelope=Math.min(1,t/.045)*Math.sin(Math.PI*u)**1.4;
  seed=seed*16807%2147483647;const noise=seed/1073741824-1;low+=.065*(noise-low);
  const f=kind==='spore-heart'?82+Math.sin(t*13)*12:kind==='thorn-crown'?118-42*u+Math.sin(t*17)*6:kind==='crag-tusk'?62-18*u:104+Math.sin(t*9)*18;
  phase+=2*Math.PI*f/rate;let v=0;
  if(kind==='spore-heart')v=.31*Math.sin(phase+.9*Math.sin(t*29))+.28*low+.10*Math.sin(phase*2.04)*Math.sin(t*31)**2;
  if(kind==='thorn-crown')v=.28*Math.sin(phase)+.15*Math.sin(phase*2)+.09*Math.sin(phase*3.04)+.16*low;
  if(kind==='crag-tusk')v=.38*Math.sin(phase)+.25*low+.11*noise*Math.exp(-t*13);
  if(kind==='bound-branch'){v=.18*low+.16*Math.sin(phase);for(const at of [.05,.27,.49])if(t>=at){const d=t-at;v+=Math.exp(-d*16)*(.15*Math.sin(d*840*Math.PI*2)+.10*Math.sin(d*1733*Math.PI*2)+.08*noise);}}
  data[i]=Math.max(-.85,Math.min(.85,v*envelope));
 }
 return data;
}
