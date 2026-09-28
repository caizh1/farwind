// 确定性合成生物提示音；实际听感与混音仍需运行验收。
export type CreatureVoice='charge'|'strike'|'hurt'|'death';
export function synthCreature(type:string,phase:CreatureVoice,rate:number){
 const duration=phase==='charge'?.42:phase==='death'?.48:phase==='strike'?.2:.14,frames=Math.ceil(rate*duration),samples=new Float32Array(frames);
 let seed=27183,low=0;
 for(let i=0;i<frames;i++){
  const t=i/rate,u=t/duration;seed=seed*16807%2147483647;const noise=seed/1073741824-1;low=low*.92+noise*.08;
  const envelope=Math.min(1,t/.015)*(1-u)**(phase==='charge'?1:2),base=type==='wolf'?135:type==='burrow'?76:54;
  const pitch=base*(phase==='death'?1-.65*u:phase==='charge'?.8+u*.45:1.5-u*.6),wave=Math.sin(t*pitch*Math.PI*2);
  const voice=type==='wolf'?wave*.3+Math.sin(t*pitch*2*Math.PI*2)*.12+low*.55:type==='burrow'?low*.85+noise*.12*Math.max(0,Math.sin(t*53)):low*.75+wave*.24+noise*.15*Math.max(0,Math.sin(t*29));
  samples[i]=envelope*voice*.65;
 }
 return samples;
}
