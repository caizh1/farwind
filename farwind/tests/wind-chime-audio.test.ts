import {test,expect} from 'vitest';
import {Sound} from '../src/game/systems/audio';

test('铜铃距离衰减、节流、声部上限与静音清理',()=>{
 const sources:any[]=[],gains:number[]=[],buffers:Float32Array[]=[];
 const context:any={sampleRate:48000,currentTime:1,state:'running',destination:{},
  createBuffer(_channels:number,length:number){const data=new Float32Array(length);buffers.push(data);return {getChannelData:()=>data};},
  createBufferSource(){const s={buffer:null,onended:null as null|(()=>void),stopped:false,connect(){},disconnect(){},start(){},stop(){this.stopped=true;this.onended?.();}};sources.push(s);return s;},
  createGain(){return {gain:{set value(v:number){gains.push(v);}},connect(){},disconnect(){}};},
 };
 const sound=new Sound();sound.context=context;
 sound.chime(0,0,0);sound.chime(0,0,0);expect(sources).toHaveLength(1);
 context.currentTime+=.1;sound.chime(0,325,100);expect(gains[1]).toBeCloseTo(gains[0]/2);
 expect(sources[1].buffer).toBe(sources[0].buffer);
 sound.chime(1,651,100);expect(sources).toHaveLength(2);
 context.state='suspended';sound.chime(1,0,100);expect(sources).toHaveLength(2);context.state='running';
 for(let i=0;i<16;i++){context.currentTime+=.1;sound.chime(i%3,0,i*100);}
 expect(sound.diagnostic().voices).toBe(12);
 expect(buffers).toHaveLength(3);expect(buffers.every(b=>b.every(v=>Number.isFinite(v)&&Math.abs(v)<=1))).toBe(true);
 sound.volume=0;expect(sound.diagnostic().voices).toBe(0);expect(sources.every(s=>s.stopped)).toBe(true);
 context.currentTime+=.1;sound.chime(2,0,2000);expect(sources).toHaveLength(18);
});
