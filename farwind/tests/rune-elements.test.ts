import {describe,it,expect} from 'vitest';
import {paintElementFx} from '../src/game/entities/runeElements';
import {sampleLightning,LIGHTNING_MOTION} from '../src/game/entities/runeLightning';
import type {RuneInk} from '../src/game/entities/runeView';
import {RuneCombat,type RuneFx} from '../src/game/systems/runeCombat';
import {initialState} from '../src/game/systems/state';
import {runePreviewScene} from '../src/game/ui/runePreview';
import {RUNES} from '../src/data/runes';

describe('单枚符文效果预览',()=>{
 const equipped=()=>{const s=initialState();s.runes.slots=['r29','r27','r24','r31','r32'];s.skills.swordWindStage=1;s.skills.legacySwordWind=true;return s;};
 it.each([...RUNES.map(r=>r.id),'return-wind'])('%s 不混入其他配装，不修改正式状态',id=>{
  const s=equipped(),before=structuredClone(s),preview=runePreviewScene(id,s,18);
  expect(preview.state.runes.slots.filter(Boolean)).toEqual(id==='return-wind'?[]:[id]);
  for(let t=0;t<4000;t+=5)preview.step(5);
  expect(s).toEqual(before);preview.clear();expect(preview.winds.winds).toHaveLength(0);expect(preview.engine.effects).toHaveLength(0);
 });
 it.each([1,5] as const)('回风第%s阶真实去返各命中一次，伤害与配装基准一致，没有雷霆',stage=>{
  const s=equipped();s.skills.swordWindStage=stage;const preview=runePreviewScene('r31',s,27);
  for(let t=0;t<1200;t+=5)preview.step(5);
  const events=preview.engine.events;
  expect(events).toHaveLength(2);expect(events.every(e=>e.sourceKind==='native')).toBe(true);
  expect(events.map(e=>e.tags.find(t=>t==='wind_out'||t==='wind_back'))).toEqual(['wind_out','wind_back']);
  expect(events.map(e=>e.actual)).toEqual([54,32.4]);expect(preview.engine.effects).toHaveLength(0);expect(preview.engine.activeDuos.size).toBe(0);
 });
 it('引风归身按已保存分支展示移步与斜向回返',()=>{
  const s=equipped();s.runes.growth.r31={advanced:true,branch:'anchor'};const preview=runePreviewScene('r31',s,18);
  for(let t=0;t<460;t+=5)preview.step(5);
  const returning=preview.winds.winds.find(w=>w.leg==='back');
  expect(preview.state.player.y).toBeGreaterThan(130);expect(returning).toBeDefined();expect(returning!.direction.y).toBeGreaterThan(0);
  expect(preview.phase).toContain('回程');
  expect(preview.state.runes.growth.r31).toEqual(s.runes.growth.r31);
 });
 it('留痕单枚仍由后续剑风消费，进阶分支保留且没有附带回风或落雷',()=>{
  const s=equipped();s.runes.growth.r32={advanced:true,branch:'weave'};const preview=runePreviewScene('r32',s,18);
  for(let t=0;t<1200;t+=5)preview.step(5);
  expect(preview.engine.events.some(e=>e.tags.includes('trace_band_hit'))).toBe(true);
  expect(preview.winds.events.every(e=>e.wind.leg==='out')).toBe(true);
  expect(preview.engine.events.every(e=>e.sourceKind==='native'||e.sourceRuneId==='r32')).toBe(true);
 });
});

function ink(){const calls:{kind:string;args:unknown[]}[]=[];const record=(kind:string)=>(...args:unknown[])=>{calls.push({kind,args});};const g:RuneInk={line:record('line'),path:record('path'),ellipse:record('ellipse'),solid:record('solid'),stamp:record('stamp')};return {g,calls};}
function fx(visual:string,extra:Partial<RuneFx>={}):RuneFx{return {id:7,visual,rune:'r27',point:{x:120,y:150},radius:46,born:0,life:650,...extra};}
describe('符文演出与正式提交时刻',()=>{
 it('雷头逐段下降，到正式伤害提交帧才接地',()=>{
  const f=fx('thunder-pillar',{lead:160}),charge=sampleLightning(f,40),early=sampleLightning(f,85),late=sampleLightning(f,145),contact=sampleLightning(f,160);
  expect(charge.phase).toBe('charge');expect(early.phase).toBe('descent');expect(late.tip[1]).toBeGreaterThan(early.tip[1]);expect(late.tip[1]).toBeLessThan(f.point.y);expect(late.contact).toBe(false);expect(contact.tip).toEqual([120,150]);expect(contact.contact).toBe(true);
  for(const age of [80,120,159])expect(sampleLightning(f,age).strokes.flatMap(s=>s.points).every(p=>p[1]<150)).toBe(true);
 });
 it('回击向上传播、分叉重排、消散分段，不能用整图渐隐代替',()=>{
  const f=fx('fork',{lead:160}),a=sampleLightning(f,172),b=sampleLightning(f,194),c=sampleLightning(f,230),residue=sampleLightning(f,410);
  const returning=(v:typeof a)=>v.strokes.find(s=>s.kind==='return')!;
  expect(returning(b).points[0][1]).toBeLessThan(returning(a).points[0][1]);expect(a.strokes.some(s=>s.kind==='branch')).toBe(true);
  expect(b.strokes.find(s=>s.kind==='channel')?.points).not.toEqual(c.strokes.find(s=>s.kind==='channel')?.points);
  expect(residue.phase).toBe('afterglow');expect(residue.strokes.every(s=>s.kind==='fragment')).toBe(true);expect(residue.strokes.length).toBeGreaterThan(1);
  expect(sampleLightning(f,160+LIGHTNING_MOTION.residueEnd).strokes).toHaveLength(0);
  const painted=ink();paintElementFx(painted.g,f,200,false,false);expect(painted.calls.some(s=>s.kind==='stamp')).toBe(false);expect(painted.calls.some(s=>s.kind==='path')).toBe(true);
 });
 it('雷雾中央不画假雷击，目标独立事件才发生传播与接地',()=>{
  const field=ink(),target=ink();paintElementFx(field.g,fx('storm-mist'),250,false,false);paintElementFx(target.g,fx('storm-mist',{lead:160}),200,false,false);
  expect(field.calls.filter(c=>c.kind==='stamp')).toHaveLength(0);expect(target.calls.filter(c=>c.kind==='path').length).toBeGreaterThan(5);expect(sampleLightning(fx('storm-mist',{lead:160}),140).contact).toBe(false);
 });
 it('潮汐自身只画融合电浪，连锁落雷单独保留预兆和回击',()=>{
  const tide=ink(),strike=ink();paintElementFx(tide.g,fx('storm-wave'),100,false,false);paintElementFx(strike.g,fx('storm-wave',{lead:160}),180,false,false);
  expect(tide.calls.some(c=>c.kind==='stamp')).toBe(false);expect(strike.calls.filter(c=>c.kind==='path').length).toBeGreaterThan(tide.calls.filter(c=>c.kind==='path').length);
  expect(sampleLightning(fx('storm-wave',{lead:160}),130).phase).toBe('descent');expect(sampleLightning(fx('storm-wave',{lead:160}),180).contact).toBe(true);
 });
 it('凰心先化烬，提交帧展翼和火环，过期无残影',()=>{const f=fx('mirror-phoenix',{rune:'r30',lead:360,life:2000,radius:170}),ash=ink(),release=ink(),ended=ink();paintElementFx(ash.g,f,359,false,false);paintElementFx(release.g,f,390,false,false);paintElementFx(ended.g,f,2000,false,false);expect(ash.calls.some(c=>c.kind==='stamp')).toBe(false);expect(release.calls.some(c=>c.args[0]==='phoenix')).toBe(true);expect(release.calls.some(c=>c.args[0]==='flame')).toBe(true);expect(ended.calls).toHaveLength(0);});
 it('正式凰焰反击保留180毫秒伤害延迟，命中反馈无需再次蓄势',()=>{
  const state=initialState();state.runes.slots=['r30',null,null,null,null];state.player.x=0;state.player.y=0;const target={id:'target',x:50,y:0,hp:10000};let damage=0;
  const engine=new RuneCombat({state:()=>state,targets:()=>[target],A:()=>20,clear:()=>true,visible:()=>true,blocker:()=>null,push:()=> 'immune',damage:(_e,ev)=>{damage+=ev.amount;return {applied:true,damage:ev.amount,killed:false};},sound:()=>{},checkpoint:()=>{}});
  engine.damaged(target,90,10);expect(engine.effects[0].lead).toBe(180);engine.advance(179);expect(damage).toBe(0);engine.advance(1);expect(damage).toBeGreaterThan(0);expect(engine.effects.at(-1)?.lead).toBe(0);const hit=ink();paintElementFx(hit.g,engine.effects.at(-1)!,engine.now+20,false,false);expect(hit.calls.some(c=>c.args[0]==='flame')).toBe(true);
 });
 it('简化和低闪光保持主通道几何，绘制不改事件或使用整张雷柱材质',()=>{
  const f=fx('thunder-pillar',{lead:160}),original=structuredClone(f),normal=ink(),simple=ink();paintElementFx(normal.g,f,210,false,false);paintElementFx(simple.g,f,210,true,true);
  expect(f).toEqual(original);expect(normal.calls.some(c=>c.kind==='stamp')).toBe(false);expect(simple.calls.length).toBeLessThan(normal.calls.length);
  const core=(v:ReturnType<typeof ink>)=>v.calls.filter(c=>c.kind==='path'&&c.args[1]==='#fff9dc').map(c=>[c.args[0],c.args[3]]);
  expect(core(normal).length).toBeGreaterThan(0);expect(core(simple)).toEqual(core(normal));
  const wings=fx('mirror-phoenix',{lead:160}),high=ink(),low=ink();paintElementFx(high.g,wings,210,false,false);paintElementFx(low.g,wings,210,true,true);
  expect(high.calls.find(c=>c.args[0]==='phoenix')?.args.slice(1,5)).toEqual(low.calls.find(c=>c.args[0]==='phoenix')?.args.slice(1,5));
 });
 it('暂停时同一时刻几何不变，事件过期及负时间不绘制，每次放电拓扑有界',()=>{
  for(const visual of ['fork','thunder-edict','thunder-pillar','thunder-arrow','jolt','frozen-jolt','storm-wave','storm-mist','cloud-crown']){
   const f=fx(visual,{lead:160});expect(sampleLightning(f,200)).toEqual(sampleLightning(f,200));expect(sampleLightning(f,-1).strokes).toHaveLength(0);expect(sampleLightning(f,650).strokes).toHaveLength(0);
   for(let age=0;age<650;age+=7){const frame=sampleLightning(f,age);expect(frame.strokes.length).toBeLessThanOrEqual(13);expect(frame.strokes.reduce((n,s)=>n+s.points.length,0)).toBeLessThan(130);expect(frame.strokes.flatMap(s=>s.points).flat().every(Number.isFinite)).toBe(true);}
  }
 });
 it('各演出全阶段没有无效坐标、负尺寸或无限值',()=>{for(const visual of ['fork','jolt','frozen-jolt','thunder-charge','thunder-wheel','thunder-arrow','thunder-edict','thunder-pillar','storm-wave','storm-mist','cloud-crown','wave','breaker','wall-wave','return-wave','phantom-wave','mirror-sea','phoenix','phoenix-counter','mirror-phoenix','phoenix-flight'])for(const simple of [false,true])for(const age of [0,1,159,160,161,300,649,650]){const log=ink();paintElementFx(log.g,fx(visual,{lead:160}),age,simple,simple);for(const call of log.calls){const numbers=call.args.flat(3).filter(v=>typeof v==='number') as number[];expect(numbers.every(Number.isFinite),visual).toBe(true);if(call.kind==='ellipse')expect(numbers.slice(2,4).every(v=>v>=0),visual).toBe(true);}}});
});
