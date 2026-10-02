import {synthFeedback,soundDuration,audioIdentity,FEEDBACK_AUDIO} from "./feedbackAudio";
import {feedbackAudio,audibleFeedback,isHitFeedback,type FeedbackEvent,type FeedbackMode} from "./combatFeedback";
import {synthSwordWindHowl} from './swordWindAudio';
import type {XiaobaoEvent} from './xiaobaoCombat';
import {synthCreature,type CreatureVoice} from './creatureAudio';
import {synthBossArrival} from './bossArrivalAudio';
import type {CampBossKind} from '../../data/maps/windbell/campBosses';
export class Sound {
  context?: AudioContext;
  private level = 0.25;
  get volume(){return this.level;}
  set volume(value:number){this.level=value;if(!value)this.silenceFeedback();else if(this.context)for(const gain of this.windVoices.values())gain.gain.setTargetAtTime(value,this.context.currentTime,.004);}
  output?: DynamicsCompressorNode;
  lastPlayed=new Map<string,number>();
  buses?:Record<'threat'|'player'|'battle'|'noncritical',GainNode>;
  private feedbackBuffers=new Map<string,AudioBuffer>();
  private voices=new Set<AudioBufferSourceNode>();
  private strikeVoices=new Map<string,AudioBufferSourceNode>();
  private variants=new Map<string,number>();
  private windBuffer?:AudioBuffer;
  private xiaobaoBuffers=new Map<string,AudioBuffer>();
  private creatureBuffers=new Map<string,AudioBuffer>();
  bossArrival(kind:CampBossKind,sim:number){
    const c=this.context;if(!c||c.state!=='running'||!this.volume)return;
    const key=`首领现身:${kind}`,at=c.currentTime;if(at-(this.lastPlayed.get(key)??-Infinity)<.2)return;this.lastPlayed.set(key,at);
    let buffer=this.creatureBuffers.get(key);if(!buffer){const samples=synthBossArrival(kind,c.sampleRate);buffer=c.createBuffer(1,samples.length,c.sampleRate);buffer.copyToChannel(samples,0);this.creatureBuffers.set(key,buffer);}
    const source=c.createBufferSource(),gain=c.createGain();source.buffer=buffer;gain.gain.value=this.volume*.9;source.connect(gain);gain.connect(this.buses?.threat??this.output??c.destination);
    if(this.voices.size>=12){const oldest=this.voices.values().next().value!;oldest.stop();this.voices.delete(oldest);}this.voices.add(source);source.onended=()=>{this.voices.delete(source);source.disconnect();gain.disconnect();};source.start();
    this.audioEvents.push({id:`${key}:${sim}`,kind:key,sim,submitted:performance.now(),scheduled:at,latency:c.outputLatency??null,variant:0});if(this.audioEvents.length>96)this.audioEvents.shift();
  }
  // 铜铃使用短促敲击与衰减的非整数泛音；远处降音量，静音与暂停沿用共享声部清理。
  chime(note:number,distance:number,sim:number){
    const c=this.context;if(!c||c.state!=='running'||!this.volume||distance>650)return;
    const key=`chime:${note}`,at=c.currentTime;if(at-(this.lastPlayed.get(key)??-Infinity)<.09)return;this.lastPlayed.set(key,at);
    let buffer=this.creatureBuffers.get(key);
    if(!buffer){buffer=c.createBuffer(1,Math.ceil(c.sampleRate*.8),c.sampleRate);const samples=buffer.getChannelData(0),frequency=[740,920,1100][note%3];for(let i=0;i<samples.length;i++){const t=i/c.sampleRate; samples[i]=Math.min(1,t/.003)*Math.exp(-t*6)*(Math.sin(t*frequency*Math.PI*2)+.3*Math.sin(t*frequency*2.76*Math.PI*2)+.12*Math.sin(t*frequency*5.4*Math.PI*2))*.25;}this.creatureBuffers.set(key,buffer);}
    const source=c.createBufferSource(),gain=c.createGain();source.buffer=buffer;gain.gain.value=this.volume*.6*Math.max(0,1-distance/650);source.connect(gain);gain.connect(this.route('chime'));
    if(this.voices.size>=12){const old=this.voices.values().next().value!;old.stop();this.voices.delete(old);}this.voices.add(source);source.start();source.onended=()=>{this.voices.delete(source);source.disconnect();gain.disconnect();};
    this.audioEvents.push({id:`${key}:${sim}`,kind:'chime',sim,submitted:performance.now(),scheduled:at,latency:c.outputLatency??null,variant:note});if(this.audioEvents.length>96)this.audioEvents.shift();
  }
  creature(type:string,phase:CreatureVoice,distance:number,sim:number){
    const c=this.context;if(!['wolf','burrow','guardian','priest','bomber'].includes(type)||!c||c.state!=='running'||!this.volume||distance>1000)return;
    const key=`${type}:${phase}`,at=c.currentTime;if(at-(this.lastPlayed.get(key)??-Infinity)<.07)return;this.lastPlayed.set(key,at);
    let buffer=this.creatureBuffers.get(key);if(!buffer){const samples=synthCreature(type,phase,c.sampleRate);buffer=c.createBuffer(1,samples.length,c.sampleRate);buffer.copyToChannel(samples,0);this.creatureBuffers.set(key,buffer);}
    const source=c.createBufferSource(),gain=c.createGain();source.buffer=buffer;gain.gain.value=this.volume*.8*Math.max(0,1-distance/1000);source.connect(gain);gain.connect(this.buses?.threat??this.output??c.destination);
    if(this.voices.size>=12){const oldest=this.voices.values().next().value!;oldest.stop();this.voices.delete(oldest);}this.voices.add(source);source.onended=()=>{this.voices.delete(source);source.disconnect();gain.disconnect();};source.start();
    this.audioEvents.push({id:`creature:${key}:${sim}`,kind:key,sim,submitted:performance.now(),scheduled:at,latency:c.outputLatency??null,variant:0});if(this.audioEvents.length>96)this.audioEvents.shift();
  }
  private flightVoice?:{source:AudioBufferSourceNode;gain:GainNode};
  private windVoices=new Map<AudioBufferSourceNode,GainNode>();
  audioEvents:{id:string;kind:string;sim:number;submitted:number;scheduled:number;latency:number|null;variant:number}[]=[];
  prepareFeedback() {
    const c=this.context!;if(this.feedbackBuffers.size)return;
    for(const kind of ['guard-start','enemy-charge','enemy-strike','parry-contact','parry-perfect-contact','deflect-release','counter-swing','counter-hit','afterguard','hit','protected-hit','interrupt','guard-break','kill'] as const)
      for(const material of kind==='counter-hit'||isHitFeedback(kind)?['slime','leaf','straw','armor'] as const:['slime'] as const)for(let v=0;v<FEEDBACK_AUDIO.variants;v++) {
        const samples=synthFeedback(kind,material,v,c.sampleRate),buffer=c.createBuffer(1,samples.length,c.sampleRate);buffer.copyToChannel(samples,0);this.feedbackBuffers.set(`${kind}:${material}:${v}`,buffer);
      }
  }
  feedbackBatch(events:readonly FeedbackEvent[],mode:FeedbackMode) {
    let contacts=0;
    const ordered=[...(feedbackAudio(mode)?audibleFeedback(events):events)].sort((a,b)=>Number(b.sourceId==='player')-Number(a.sourceId==='player')||Number(b.kind==='kill')-Number(a.kind==='kill'));
    for(const event of ordered){
      if(isHitFeedback(event.kind)&&++contacts>4)continue;
      this.feedback(event,mode,isHitFeedback(event.kind)?(event.sourceId&&event.sourceId!=='player'?.3:contacts>1?.45:(event.isFinisher??event.stage===3)?1:.75):1);
    }
  }
  feedback(event:FeedbackEvent,mode:FeedbackMode,scale=1) {
    if(!feedbackAudio(mode)) {
      const legacy:Record<string,string>={'guard-start':'guard','enemy-charge':'enemy-charge','enemy-strike':'enemy-strike','parry-contact':'parry','parry-perfect-contact':'parry-perfect','counter-start':'deflect','counter-hit':event.legacyHit??(event.material==='straw'?'straw':'hit'),'hit':'hit','protected-hit':'guard','interrupt':'hit','guard-break':'guard','kill':'finish'};
      if(legacy[event.kind])this.play(legacy[event.kind]);return;
    }
    const c=this.context;if(!c||!this.volume||c.state!=='running'||soundDuration(event.kind)===0)return;
    // 较早子步已发声的同一次来招也在成功时截停；不压低整个威胁声部。
    if(['parry-contact','parry-perfect-contact','afterguard'].includes(event.kind)){this.strikeVoices.get(event.attackId)?.stop();this.strikeVoices.delete(event.attackId);}
    const material=event.kind==='counter-hit'||isHitFeedback(event.kind)?event.material:'slime',key=`${event.kind}:${material}`,variant=(this.variants.get(key)??0)%FEEDBACK_AUDIO.variants;this.variants.set(key,variant+1);
    const source=c.createBufferSource(),gain=c.createGain();source.buffer=this.feedbackBuffers.get(`${key}:${variant}`)!;
    if(!source.buffer)return;
    if(this.voices.size>=FEEDBACK_AUDIO.voices){const old=this.voices.values().next().value!;old.stop();this.voices.delete(old);}
    gain.gain.value=this.volume*scale;source.connect(gain);gain.connect(this.buses![audioIdentity(event.kind)]);
    this.voices.add(source);if(event.kind==='enemy-strike')this.strikeVoices.set(event.attackId,source);const at=c.currentTime;source.start(at);source.onended=()=>{this.voices.delete(source);if(this.strikeVoices.get(event.attackId)===source)this.strikeVoices.delete(event.attackId);source.disconnect();gain.disconnect();};
    this.audioEvents.push({id:event.id,kind:event.kind,sim:event.at,submitted:performance.now(),scheduled:at,latency:c.outputLatency??null,variant});if(this.audioEvents.length>96)this.audioEvents.shift();
    if(event.kind==='parry-contact'||event.kind==='parry-perfect-contact'||event.kind==='counter-hit')for(const bus of ['battle','noncritical'] as const){const g=this.buses![bus].gain;g.cancelScheduledValues(at);g.setValueAtTime(g.value,at);g.linearRampToValueAtTime(10**(-FEEDBACK_AUDIO.duckDb/20),at+.003);g.linearRampToValueAtTime(1,at+FEEDBACK_AUDIO.duckRestore);}
  }
  private silenceSwordWind(){for(const voice of this.windVoices.keys())voice.stop();this.windVoices.clear();}
  silenceFeedback(){for(const voice of this.runeVoices)voice.stop();this.runeVoices.clear();this.runeLast=this.runeFinishLast=-Infinity;this.xiaobaoFlight(false,0);this.silenceSwordWind();for(const voice of this.voices)voice.stop();this.voices.clear();this.strikeVoices.clear();if(this.buses&&this.context)for(const bus of Object.values(this.buses)){bus.gain.cancelScheduledValues(this.context.currentTime);bus.gain.setValueAtTime(1,this.context.currentTime);}}
  clearFeedback(){this.silenceFeedback();this.audioEvents=[];this.variants.clear();}
  diagnostic(){return {runeVoices:this.runeVoices.size,runeCached:this.runeBuffers.size,voices:this.voices.size,strikeVoices:this.strikeVoices.size,audioProfile:'双剑金属／同来招截停',windVoices:this.windVoices.size,windCached:!!this.windBuffer,xiaobaoFlightVoices:this.flightVoice?1:0,xiaobaoCached:this.xiaobaoBuffers.size,cached:this.feedbackBuffers.size,events:this.audioEvents,state:this.context?.state??'unstarted',outputLatency:this.context?.outputLatency??null,buses:this.buses?Object.fromEntries(Object.entries(this.buses).map(([k,v])=>[k,v.gain.value])):null};}
  private route(kind:string){return this.buses?.[kind.startsWith('enemy-')?'threat':kind.startsWith('wind-')||['attack','attack-heavy','hit','finish','straw','straw-heavy'].includes(kind)?'battle':['guard','parry','parry-perfect','deflect','counter'].includes(kind)?'player':'noncritical']??this.output??this.context!.destination;}
  private xiaobaoBuffer(kind:string){
    const c=this.context!,old=this.xiaobaoBuffers.get(kind);if(old)return old;
    const stone=kind==='rock'||kind==='unity',fire=kind==='fire',thunder=kind==='thunder'||kind==='chain',bell=['guard','landing','recover'].includes(kind),duration=kind==='cruise'?.4:thunder?.24:stone?.22:fire?.3:bell?.32:.14;
    const buffer=c.createBuffer(1,Math.ceil(c.sampleRate*duration),c.sampleRate),data=buffer.getChannelData(0);let seed=4711,pink=0;
    for(let i=0;i<data.length;i++){const t=i/c.sampleRate,u=t/duration;seed=seed*16807%2147483647;const noise=seed/1073741824-1;pink=.92*pink+.08*noise;
      const envelope=kind==='cruise'?1:Math.min(1,t/.008)*(1-u)**2,frequency=bell?900:stone?82:thunder?124:fire?220:kind==='star'?760:380;
      data[i]=envelope*(bell?(Math.sin(t*frequency*Math.PI*2)+.28*Math.sin(t*frequency*2.7*Math.PI*2))*.3:thunder?noise*.25+pink*.6:stone?pink*.8+Math.sin(t*frequency*Math.PI*2)*.22:fire?pink*.6:pink*.5+Math.sin(t*frequency*Math.PI*2)*.12);
    }
    this.xiaobaoBuffers.set(kind,buffer);return buffer;
  }
  xiaobao(event:XiaobaoEvent,distance:number,outside:boolean){
    const c=this.context;if(!outside||!c||c.state!=='running'||!this.volume||distance>1100)return;
    if(event.kind==='shield')return;
    const kind=event.kind==='landing'?'landing':event.kind==='flight'?'flight':event.kind==='recover'?'recover':event.kind==='rest'?'guard':event.skill==='unity'&&event.stage!==undefined?event.stage===0?'rock':event.stage===6?'thunder':'fire':event.skill;
    const key=`xiaobao:${kind}`,at=c.currentTime;if(at-(this.lastPlayed.get(key)??-Infinity)<.06)return;this.lastPlayed.set(key,at);
    const source=c.createBufferSource(),gain=c.createGain();source.buffer=this.xiaobaoBuffer(kind);gain.gain.value=this.volume*Math.max(0,1-distance/1100)*.8;
    source.connect(gain);gain.connect(this.buses?.battle??this.output??c.destination);
    if(this.voices.size>=12){const oldest=this.voices.values().next().value!;oldest.stop();this.voices.delete(oldest);}this.voices.add(source);
    source.onended=()=>{this.voices.delete(source);source.disconnect();gain.disconnect();};source.start();
    this.audioEvents.push({id:event.id,kind:key,sim:event.at,submitted:performance.now(),scheduled:at,latency:c.outputLatency??null,variant:0});if(this.audioEvents.length>96)this.audioEvents.shift();
  }
  xiaobaoFlight(active:boolean,distance:number){
    const c=this.context;if(!active||!c||!this.volume||distance>1100){if(this.flightVoice){this.flightVoice.source.stop();this.flightVoice.source.disconnect();this.flightVoice.gain.disconnect();this.flightVoice=undefined;}return;}
    if(!this.flightVoice){const source=c.createBufferSource(),gain=c.createGain();source.buffer=this.xiaobaoBuffer('cruise');source.loop=true;gain.gain.value=0;source.connect(gain);gain.connect(this.buses?.battle??this.output??c.destination);source.start();this.flightVoice={source,gain};}
    this.flightVoice.gain.gain.setTargetAtTime(this.volume*.22*Math.max(0,1-distance/1100),c.currentTime,.025);
  }
  loops:{source:AudioBufferSourceNode;filter:BiquadFilterNode;gain:GainNode;target:number}[]=[];
  ambience(night:number,active:boolean){
    if(!active)this.silenceSwordWind();
    if(!this.context)return;
    const c=this.context;
    if(active&&!this.loops.length){
      for(let layer=0;layer<2;layer++){
        const buffer=c.createBuffer(1,c.sampleRate*8,c.sampleRate),v=buffer.getChannelData(0);let seed=1729,pink=0;
        for(let i=0;i<v.length;i++){seed=seed*16807%2147483647;pink=.98*pink+.02*(seed/1073741824-1);const envelope=layer?Math.pow(Math.max(0,Math.sin(i/c.sampleRate*5.5)*Math.sin(i/c.sampleRate*.75)),4):.5+.15*Math.sin(i/c.sampleRate*1.1);v[i]=pink*envelope;}
        const source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();source.buffer=buffer;source.loop=true;
        filter.type=layer?"bandpass":"lowpass";filter.frequency.value=layer?2800:900;filter.Q.value=.5;gain.gain.value=0;
        source.connect(filter);filter.connect(gain);gain.connect(this.route("ambience"));source.start();this.loops.push({source,filter,gain,target:0});
      }
    }
    this.loops.forEach((l,i)=>{const target=active?this.volume*(i?night*.18:(1-night)*.15):0;if(target===0&&l.target!==0||Math.abs(target-l.target)>.0001){l.gain.gain.cancelScheduledValues(c.currentTime);l.gain.gain.setTargetAtTime(target,c.currentTime,.25);l.target=target;}});
  }
  destroy(){this.runeBuffers.clear();this.clearFeedback();for(const bus of Object.values(this.buses??{}))bus.disconnect();this.buses=undefined;this.feedbackBuffers.clear();this.xiaobaoBuffers.clear();this.creatureBuffers.clear();this.windBuffer=undefined;for(const l of this.loops){l.source.stop();l.source.disconnect();l.filter.disconnect();l.gain.disconnect();}this.loops=[];void this.context?.close();this.context=undefined;this.output=undefined;}
  private runeBuffers=new Map<string,AudioBuffer>();
  private runeVoices=new Set<AudioBufferSourceNode>();
  private runeLast=-Infinity;
  private runeFinishLast=-Infinity;
  rune(family:string,phase:'release'|'hit'|'finish',now:number){
    const c=this.context;if(!c||!this.volume||c.state!=='running'||(phase==='finish'?now-this.runeFinishLast<80:now-this.runeLast<45))return;
    this.runeLast=now;if(phase==='finish')this.runeFinishLast=now;const key=family+':'+phase;let buffer=this.runeBuffers.get(key);
    if(!buffer){const duration=phase==='finish'?.65:phase==='release'?.36:.18;buffer=c.createBuffer(1,Math.ceil(c.sampleRate*duration),c.sampleRate);const data=buffer.getChannelData(0),frequency=family.includes('thunder')||family.includes('storm')?124:family==='mirror'||family==='time'?860:family==='chill'?1150:family==='poison'?220:family==='phoenix'?168:family==='doom'||family==='void'?82:family==='swords'||family==='hunter'?650:380;let seed=7341,pink=0;
    for(let i=0;i<data.length;i++){const t=i/c.sampleRate,u=t/duration;seed=seed*16807%2147483647;const noise=seed/1073741824-1;pink=.91*pink+.09*noise;const env=Math.min(1,t/.008)*(1-u)**2,tone=Math.sin(t*frequency*(1-.3*u)*Math.PI*2);data[i]=env*(tone*.15+pink*(frequency<300?.6:.16)+noise*(frequency===124?.16:.025));}this.runeBuffers.set(key,buffer);}
    if(this.runeVoices.size>=4){const old=this.runeVoices.values().next().value!;old.stop();this.runeVoices.delete(old);}
    const source=c.createBufferSource(),gain=c.createGain();source.buffer=buffer;gain.gain.value=this.volume*(phase==='finish'?.5:.32);source.connect(gain);gain.connect(this.route('wind-rune'));this.runeVoices.add(source);source.start();source.onended=()=>{this.runeVoices.delete(source);source.disconnect();gain.disconnect();};
  }
  start() {
    this.context ??= new AudioContext();
    if(!this.output){this.output=this.context.createDynamicsCompressor();this.output.threshold.value=-9;this.output.knee.value=6;this.output.ratio.value=8;this.output.attack.value=.003;this.output.release.value=.1;this.output.connect(this.context.destination);}
    if(!this.buses){this.buses={} as NonNullable<Sound['buses']>;for(const name of ['threat','player','battle','noncritical'] as const){const gain=this.context.createGain();gain.connect(this.output);this.buses[name]=gain;}}
    this.prepareFeedback();
    if(!this.windBuffer){const samples=synthSwordWindHowl(this.context.sampleRate);this.windBuffer=this.context.createBuffer(2,samples[0].length,this.context.sampleRate);samples.forEach((channel,i)=>this.windBuffer!.copyToChannel(channel,i));}
    void this.context.resume();
  }
  play(kind = "pick") {
    if (!this.context || !this.volume) return;
    const at=this.context.currentTime;
    if(at-(this.lastPlayed.get(kind)??-Infinity)<.025)return;this.lastPlayed.set(kind,at);
    if(kind.startsWith('wind-')){this.swordWindSound(kind);return;}
    if(["enemy-charge","enemy-strike","enemy-stagger","deflect","counter"].includes(kind)){this.legacyMotionSound(kind);return;}
    if(["guard","parry","parry-perfect"].includes(kind)) {this.legacyParrySound(kind);return;}
    if (
      [
        "attack",
        "attack-heavy",
        "hit",
        "finish",
        "straw",
        "straw-heavy",
      ].includes(kind)
    ) {
      this.combatSound(kind);
      return;
    }
    const c = this.context,
      o = c.createOscillator(),
      g = c.createGain();
    o.type = kind === "cat-meow" ? "triangle" : kind === "hit" || kind === "finish" ? "triangle" : "sine";
    o.frequency.setValueAtTime(
      (
        {
          "cat-meow": 600,
          pick: 650,
          talk: 420,
          hit: 140,
          finish: 100,
          attack: 230,
          dash: 720,
          success: 880,
        } as Record<string, number>
      )[kind] ?? 520,
      c.currentTime,
    );
    o.frequency.exponentialRampToValueAtTime(kind === "cat-meow" ? 1050 : kind === "hit" ? 60 : 900,c.currentTime + 0.15);
    if(kind === "cat-meow")o.frequency.exponentialRampToValueAtTime(480,c.currentTime+.28);
    g.gain.setValueAtTime(this.volume * (kind === "cat-meow" ? .12 : .3), c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + (kind === "cat-meow" ? .3 : .2));
    o.connect(g);
    g.connect(this.route(kind));
    o.start();
    o.stop(c.currentTime + (kind === "cat-meow" ? .31 : .21));
    o.onended=()=>{o.disconnect();g.disconnect();};
  }
  private swordWindSound(kind:string){
    if(kind==='wind-release'){this.swordWindHowl();return;}
    const c=this.context!,at=c.currentTime,charge=kind==='wind-charge',hit=kind==='wind-hit',dissolve=kind==='wind-dissolve',duration=charge?.11:hit?.13:dissolve?.06:.14;
    const noise=c.createBuffer(1,Math.ceil(c.sampleRate*duration),c.sampleRate),samples=noise.getChannelData(0);let seed=hit?941:charge?307:1709;
    for(let i=0;i<samples.length;i++){seed=seed*16807%2147483647;samples[i]=seed/1073741824-1;}
    const source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();source.buffer=noise;filter.type=hit?'highpass':'bandpass';filter.Q.value=.7;
    filter.frequency.setValueAtTime(charge?700:hit?1600:dissolve?1100:5400,at);filter.frequency.exponentialRampToValueAtTime(charge?1500:hit?500:dissolve?350:850,at+duration);
    gain.gain.setValueAtTime(.001,at);gain.gain.linearRampToValueAtTime(this.volume*(charge?.2:hit?.8:dissolve?.15:.75),at+(charge?.045:.006));gain.gain.exponentialRampToValueAtTime(.001,at+duration);
    source.connect(filter);filter.connect(gain);gain.connect(this.route(kind));source.start(at);source.stop(at+duration);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
  }
  private swordWindHowl(){
    const c=this.context!;if(c.state!=='running'||!this.windBuffer)return;
    if(this.windVoices.size>=2){const oldest=this.windVoices.keys().next().value!;oldest.stop();this.windVoices.delete(oldest);}
    const source=c.createBufferSource(),gain=c.createGain();source.buffer=this.windBuffer;gain.gain.value=this.volume;
    source.connect(gain);gain.connect(this.route('wind-release'));this.windVoices.set(source,gain);
    source.onended=()=>{this.windVoices.delete(source);source.disconnect();gain.disconnect();};source.start(c.currentTime);
  }
  private legacyMotionSound(kind:string) {
    const c=this.context!,at=c.currentTime,charge=kind==="enemy-charge",contact=kind==="enemy-stagger",duration=charge?.23:contact?.14:.12;
    const buffer=c.createBuffer(1,Math.ceil(c.sampleRate*duration),c.sampleRate),samples=buffer.getChannelData(0);let seed=701;
    for(let i=0;i<samples.length;i++){seed=seed*16807%2147483647;samples[i]=seed/1073741824-1;}
    const source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();source.buffer=buffer;filter.type="bandpass";filter.Q.value=.65;
    filter.frequency.setValueAtTime(charge?220:contact?420:3200,at);filter.frequency.exponentialRampToValueAtTime(charge?450:contact?110:650,at+duration);
    gain.gain.setValueAtTime(.001,at);gain.gain.linearRampToValueAtTime(this.volume*(charge?.18:contact?.35:.42),at+(charge?.1:.012));gain.gain.exponentialRampToValueAtTime(.001,at+duration);
    source.connect(filter);filter.connect(gain);gain.connect(this.route(kind));source.start(at);source.stop(at+duration);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
  }
  private legacyParrySound(kind:string) {
    const c=this.context!,at=c.currentTime,perfect=kind==="parry-perfect",guard=kind==="guard";
    // 起手是短促剑身轻响；接触用独立的衰减金属谐波，避免通用提示上升音。
    if(!guard)this.legacyMotionSound("enemy-stagger");
    const frequencies=guard?[620,930]:perfect?[780,1170,1950]:[650,1010];
    const duration=guard?0.06:perfect?0.17:0.13;
    frequencies.forEach((frequency,i)=>{
      const o=c.createOscillator(),g=c.createGain(),begin=at+(perfect?i*0.006:0);
      o.type="sine";o.frequency.setValueAtTime(frequency,begin);o.frequency.exponentialRampToValueAtTime(frequency*0.78,begin+duration);
      g.gain.setValueAtTime(0.001,begin);g.gain.linearRampToValueAtTime(this.volume*(guard?0.1:perfect?0.26:0.3)/(i+1),begin+0.003);
      g.gain.exponentialRampToValueAtTime(0.001,begin+duration);
      o.connect(g);g.connect(this.route(kind));o.start(begin);o.stop(begin+duration);
      o.onended=()=>{o.disconnect();g.disconnect();};
    });
  }
  private combatSound(kind: string) {
    const c = this.context!;
    const swing = kind.startsWith("attack"),
      heavy = kind === "finish" || kind.endsWith("heavy"),
      straw = kind.startsWith("straw");
    const duration = swing ? (heavy ? 0.19 : 0.13) : heavy ? 0.22 : 0.12;
    const at = c.currentTime;
    // 短噪声带通塑造破风／接触，避免用同一个上升纯音代替所有反馈。
    const noise = c.createBuffer(
      1,
      Math.ceil(c.sampleRate * duration),
      c.sampleRate,
    );
    const samples = noise.getChannelData(0);
    let seed = 137;
    for (let i = 0; i < samples.length; i++) {
      seed = (seed * 16807) % 2147483647;
      samples[i] = seed / 1073741824 - 1;
    }
    const source = c.createBufferSource(),
      filter = c.createBiquadFilter(),
      gain = c.createGain();
    source.buffer = noise;
    filter.type = swing || straw ? "bandpass" : "lowpass";
    filter.Q.value = swing ? 0.7 : 0.5;
    filter.frequency.setValueAtTime(
      straw ? 1400 : swing ? 4200 : heavy ? 2300 : 3600,
      at,
    );
    filter.frequency.exponentialRampToValueAtTime(
      swing ? 650 : 350,
      at + duration,
    );
    gain.gain.setValueAtTime(0.001, at);
    gain.gain.linearRampToValueAtTime(
      this.volume * (swing ? 0.9 : heavy ? 1.25 : 0.9),
      at + (swing ? 0.024 : 0.003),
    );
    gain.gain.exponentialRampToValueAtTime(0.001, at + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.route(kind));
    source.start(at);
    source.stop(at + duration);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    if (!swing) {
      const body = c.createOscillator(),
        envelope = c.createGain();
      body.type = "triangle";
      body.frequency.setValueAtTime(straw ? 260 : heavy ? 105 : 185, at);
      body.frequency.exponentialRampToValueAtTime(
        heavy ? 42 : 75,
        at + duration * 0.8,
      );
      envelope.gain.setValueAtTime(this.volume * (heavy ? 0.65 : 0.38), at);
      envelope.gain.exponentialRampToValueAtTime(0.001, at + duration);
      body.connect(envelope);
      envelope.connect(this.route(kind));
      body.start(at);
      body.stop(at + duration);
      body.onended = () => {
        body.disconnect();
        envelope.disconnect();
      };
    }
  }
}
