import {describe,it,expect} from 'vitest';
import {synthSwordWindHowl,synthSwordWindCue,SWORD_WIND_AUDIO} from '../src/game/systems/swordWindAudio';
import {Sound} from '../src/game/systems/audio';

describe('一线斩风呼啸波形及音频生命周期',()=>{
 it('常见采样率下为有限双声道、首尾归零、不削波且声体先强后隐',()=>{
  for(const rate of [44100,48000,96000]){
   const channels=synthSwordWindHowl(rate);expect(channels.map(c=>c.length)).toEqual([Math.ceil(rate*SWORD_WIND_AUDIO.duration),Math.ceil(rate*SWORD_WIND_AUDIO.duration)]);
   let peak=0,body=0,tail=0,side=0;
   for(let i=0;i<channels[0].length;i++){const [l,r]=[channels[0][i],channels[1][i]];expect(Number.isFinite(l)&&Number.isFinite(r)).toBe(true);peak=Math.max(peak,Math.abs(l),Math.abs(r));if(i>=rate*.04&&i<rate*.18)body+=l*l;if(i>=rate*.18)tail+=l*l;side+=(l-r)**2;}
   expect(peak).toBeCloseTo(SWORD_WIND_AUDIO.peak,6);expect(body).toBeGreaterThan(tail*4);expect(side).toBeGreaterThan(.001);
   const mono=channels[0].reduce((sum,l,i)=>sum+((l+channels[1][i])/2)**2,0);
   const stereo=channels[0].reduce((sum,l,i)=>sum+(l*l+channels[1][i]**2)/2,0);expect(mono/stereo).toBeGreaterThan(.95);
   for(const c of channels){expect(c[0]).toBe(0);expect(c.at(-1)).toBe(0);}
  }
  expect(synthSwordWindHowl()[0]).toEqual(synthSwordWindHowl()[0]);
 });
 it('三个释放变体与轻蓄势、消散在常见采样率下稳定，轻声不抢释放主体',()=>{
  for(const rate of [8000,44100,48000,96000])for(const kind of ['wind-release','wind-charge','wind-dissolve'] as const)for(let v=0;v<3;v++){
   const channels=synthSwordWindCue(kind,rate,v),peak=Math.max(...channels[0].map(Math.abs),...channels[1].map(Math.abs));
   expect(peak).toBeLessThanOrEqual(kind==='wind-release'?.681:kind==='wind-charge'?.046:.026);
   for(const channel of channels){expect(channel.every(Number.isFinite)).toBe(true);expect(channel[0]).toBe(0);expect(channel.at(-1)).toBe(0);}
  }
  expect(synthSwordWindHowl(48000,0)[0]).not.toEqual(synthSwordWindHowl(48000,1)[0]);
  expect(()=>synthSwordWindHowl(NaN)).toThrow(RangeError);
 });
 it('预生成缓存复用；静音、暂停音频状态与会话清理不会遗留呼啸',()=>{
  const sources:any[]=[],gains:any[]=[];
  const parameter=()=>({value:1,setValueAtTime(){},cancelScheduledValues(){},setTargetAtTime(value:number){this.value=value;}});
  const context:any={sampleRate:48000,currentTime:1,state:'running',destination:{},createBuffer(channels:number,length:number){return {channels,length,copyToChannel(){}};},createBufferSource(){const s={buffer:null,onended:null as null|(()=>void),stopped:false,connect(){},disconnect(){},start(){},stop(){this.stopped=true;this.onended?.();}};sources.push(s);return s;},createGain(){const g={gain:parameter(),connect(){},disconnect(){}};gains.push(g);return g;},createDynamicsCompressor(){return {threshold:parameter(),knee:parameter(),ratio:parameter(),attack:parameter(),release:parameter(),connect(){}};},resume(){return Promise.resolve();}};
  const sound=new Sound();sound.context=context;sound.start();sound.play('wind-release');
  const buffer=sources[0].buffer;expect(buffer.channels).toBe(2);expect(sound.diagnostic().windVoices).toBe(1);
  const gain=gains.at(-1);expect(gain.gain.value).toBe(.25);sound.volume=.1;expect(gain.gain.value).toBe(.1);
  sound.volume=0;expect(sources[0].stopped).toBe(true);expect(sound.diagnostic().windVoices).toBe(0);
  context.currentTime+=.1;sound.play('wind-release');expect(sources).toHaveLength(1);
  sound.volume=.25;context.state='suspended';context.currentTime+=.1;sound.play('wind-release');expect(sources).toHaveLength(1);
  context.state='running';context.currentTime+=.1;sound.play('wind-release');expect(sources[1].buffer).not.toBe(buffer);
  context.currentTime+=.03;sound.play('wind-release');context.currentTime+=.03;sound.play('wind-release');expect(sources[3].buffer).toBe(buffer);
  context.currentTime+=.03;sound.play('wind-charge');context.currentTime+=.03;sound.play('wind-dissolve');expect(sound.diagnostic().windVoices).toBe(SWORD_WIND_AUDIO.voices);expect(sources[1].stopped).toBe(true);
  sound.ambience(0,false);expect(sound.diagnostic().windVoices).toBe(0);
  context.currentTime+=.03;sound.play('wind-release');expect(sound.diagnostic().windVoices).toBe(1);
  sound.clearFeedback();expect(sound.diagnostic().windVoices).toBe(0);expect(sources.every(s=>s.stopped)).toBe(true);
 });
});
