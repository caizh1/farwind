import type {FeedbackKind,FeedbackMaterial} from './combatFeedback';
export const FEEDBACK_AUDIO={variants:3,voices:16,duckDb:4,duckRestore:.15,peak:.32,rate:48000} as const;
export const soundDuration=(kind:FeedbackKind)=>kind==='parry-contact'||kind==='parry-perfect-contact'?.21:kind==='guard-start'?.065:kind==='afterguard'?.055:kind==='enemy-charge'?.23:kind==='counter-start'?0:kind==='deflect-release'?.075:kind==='counter-swing'?.125:kind==='counter-hit'?.1:.12;
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
export function synthFeedback(kind:FeedbackKind,material:FeedbackMaterial='slime',variant=0,rate:number=FEEDBACK_AUDIO.rate) {
 const duration=soundDuration(kind),data=new Float32Array(Math.ceil(rate*duration));let seed=(137+variant*991+kind.split('').reduce((s,c)=>s+c.charCodeAt(0)*73,0))>>>0,low=0,last=0,peak=0;
 const detune=1+(variant-1)*.008;
 for(let i=0;i<data.length;i++) {
  const t=i/rate,u=t/duration;seed=seed*16807%2147483647;const noise=seed/1073741824-1;low+=.12*(noise-low);const bright=noise-last;last=noise;
  const clash=kind==='parry-contact'||kind==='parry-perfect-contact';
  const attack=clamp(t/(clash?.0004:.0015)),tail=clamp((duration-t)/.008),metal=(frequencies:number[],decay:number)=>frequencies.reduce((sum,f,j)=>sum+Math.sin(t*2*Math.PI*f*detune+.1*j)*Math.exp(-t/(decay/(1+j*.15)))/(1+j*1.1),0);
  let v=0;
  if(kind==='parry-contact'||kind==='parry-perfect-contact') {
   // 双刃同刻接触：硬瞬态、极短刃面摩擦、两组不规则钢刃共鸣；去掉原310赫兹闷响。
   const transient=bright*.48*Math.exp(-t/.0018),scrape=bright*.10*Math.exp(-t/.007);
   const bladeA=metal([1733,2717,4073,5849,7523],.044)*.29,bladeB=metal([1193,2243,3511,4937,6883],.037)*.24;
   v=transient+scrape+bladeA+bladeB;
   if(kind==='parry-perfect-contact')v+=metal([5179,8171],.024)*.065;
  } else if(kind==='guard-start')v=bright*.12*Math.exp(-t/.004)+metal([1249,2039],.012)*.1;
  else if(kind==='afterguard')v=bright*.18*Math.exp(-t/.004)+metal([853,1597],.015)*.12;
  else if(kind==='enemy-charge')v=low*.22*Math.sin(Math.PI*u)**2;
  else if(kind==='enemy-strike')v=(low*.75+noise*.08)*Math.sin(Math.PI*u)**.6+Math.sin(2*Math.PI*(190*t-310*t*t))*.15*Math.exp(-t/.035);
  else if(kind==='deflect-release')v=(bright*.08+low*.3)*Math.exp(-(((t-.013)/.018)**2))+metal([2917,4271],.018)*.04;
  else if(kind==='counter-swing')v=(noise*.12+low*.75)*Math.exp(-(((t-.023)/.026)**2))+bright*.05*Math.exp(-t/.018);
  else if(kind==='counter-hit') {
   const cut=bright*.28*Math.exp(-t/.004)+metal([1763,3089],.017)*.1;
   v=cut+(material==='slime'?low*.6*Math.exp(-t/.031)+Math.sin(2*Math.PI*177*t)*.17*Math.exp(-t/.022):noise*.22*Math.exp(-t/.027)+Math.sin(2*Math.PI*397*t)*.09*Math.exp(-t/.018));
   if(material==='straw')v=cut+noise*.14*Math.exp(-t/.02);
  }
  data[i]=v*attack*tail;peak=Math.max(peak,Math.abs(data[i]));
 }
 // 接触与精准共用同一峰值／近似均方根量级，精准靠模态身份区别，非加大总音量。
 const scale=kind==='parry-contact'||kind==='parry-perfect-contact'?FEEDBACK_AUDIO.peak/Math.max(.001,peak):1;
 for(let i=0;i<data.length;i++)data[i]*=scale;
 if(data.length)data[0]=0;
 return data;
}
export function audioIdentity(kind:FeedbackKind){return kind==='enemy-charge'||kind==='enemy-strike'?'threat':'player';}
