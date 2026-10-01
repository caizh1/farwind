import type { RuneInk } from './runeView';
import type { RuneFx } from '../systems/runeCombat';

const clamp = (v: number) => Math.max(0, Math.min(1, v));
// 与战斗时钟一致，不使用随机数、计时器或独立动画时钟。
const noise = (seed: number) => { const v = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
export const LIGHTNING_MOTION = { descent: 90, returnRise: 48, secondStroke: 112, channelEnd: 216, residueEnd: 410, segments: 13 } as const;
export const isLightningFx = (f: RuneFx) => /^(fork|thunder-edict|thunder-pillar|thunder-arrow|jolt|frozen-jolt)$/.test(f.visual) || (/^(storm-wave|storm-mist|cloud-crown)$/.test(f.visual) && f.lead !== undefined);
type Stroke = { points: number[][]; width: number; alpha: number; kind: 'leader'|'channel'|'return'|'branch'|'fragment'|'ground' };
export type LightningFrame = { phase: 'charge'|'descent'|'contact'|'afterglow'|'ended'; tip: number[]; height: number; contact: boolean; strokes: Stroke[] };

// 沿折线裁剪，末端是实际传播头，不能提前画出完整雷柱。
function section(points: number[][], from: number, to: number) {
  const count = points.length - 1, start = clamp(from) * count, end = clamp(to) * count;
  if (end <= start) return [];
  const at = (p: number) => { const i = Math.min(count - 1, Math.floor(p)), t = p - i; return [points[i][0] + (points[i + 1][0] - points[i][0]) * t, points[i][1] + (points[i + 1][1] - points[i][1]) * t]; };
  const result = [at(start)];
  for (let i = Math.floor(start) + 1; i < end; i++) result.push(points[i]);
  result.push(at(end)); return result;
}
function channel(f: RuneFx, height: number, elapsed: number) {
  const n = LIGHTNING_MOTION.segments, x = f.point.x, y = f.point.y;
  // 骨架稳定、细支路随放电重排；位置锚点与接地坐标始终不变。
  const discharge = Math.max(0, Math.floor(elapsed / 32));
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n, envelope = Math.sin(t * Math.PI);
    const bend = (noise(f.id * 41 + i * 7) - .5) * height * .17;
    const tremor = (noise(f.id * 13 + i * 11 + discharge * 3) - .5) * height * .035;
    return [x + (bend + tremor) * envelope, y - height + height * t];
  });
}
export function sampleLightning(f: RuneFx, now: number): LightningFrame {
  const age = now - f.born, lead = f.lead ?? 0, elapsed = age - lead;
  const pillar = f.visual === 'thunder-pillar', local = /jolt/.test(f.visual);
  const height = pillar ? 286 : f.visual === 'thunder-edict' ? 210 : local ? 58 : 154;
  const frame: LightningFrame = { phase: 'charge', tip: [f.point.x, f.point.y - height], height, contact: false, strokes: [] };
  if (age < 0 || age >= f.life || elapsed >= LIGHTNING_MOTION.residueEnd) { frame.phase = 'ended'; return frame; }
  const pts = channel(f, height, elapsed), descent = Math.min(lead, LIGHTNING_MOTION.descent);
  if (elapsed < 0) {
    const progress = descent ? clamp((elapsed + descent) / descent) ** .72 : 0;
    if (!progress) return frame;
    const leader = section(pts, 0, progress);
    frame.phase = 'descent'; frame.tip = leader.at(-1)!;
    frame.strokes.push({points: leader, width: pillar ? 2.6 : 1.7, alpha: .82, kind: 'leader'});
    // 先导支路逐个探出，均止于地面上方。
    for (let j = 0; j < 3; j++) {
      const t = .2 + j * .23;
      if (progress < t) continue;
      const p = pts[Math.round(t * LIGHTNING_MOTION.segments)], side = j % 2 ? 1 : -1;
      const reach = height * .18 * clamp((progress - t) * 4);
      frame.strokes.push({points: [p,[p[0]+side*reach*.35,p[1]+reach*.35],[p[0]+side*reach,p[1]+reach*.65]], width: .8, alpha: .32, kind:'branch'});
    }
    return frame;
  }
  frame.contact = true; frame.tip = [f.point.x, f.point.y]; frame.phase = elapsed < LIGHTNING_MOTION.channelEnd ? 'contact' : 'afterglow';
  if (elapsed < LIGHTNING_MOTION.channelEnd) {
    const pulse = elapsed < 86 ? 1 - elapsed / 180 : .5 * (1 - clamp((elapsed - 112) / 104));
    frame.strokes.push({points:pts,width:(pillar?6.5:3.8)*(.65+pulse*.35),alpha:.35+pulse*.4,kind:'channel'});
    // 回击从接地点向云端上行，第二道回击比第一道更细。
    for (const start of [0,LIGHTNING_MOTION.secondStroke]) {
      const t = elapsed - start;
      if (t < 0 || t >= 90) continue;
      const rise = clamp(t / LIGHTNING_MOTION.returnRise);
      const points = section(pts, 1 - rise, 1 - Math.max(0,(t - 46)/80));
      if (points.length) frame.strokes.push({points,width:(pillar?9:5)*(start? .6:1),alpha:(1-t/110)*(start?.75:1),kind:'return'});
    }
    for (let j = 0; j < (pillar ? 5 : 3); j++) {
      const delay = j * 9 + 8, t = elapsed - delay;
      if (t < 0 || t > 154) continue;
      const i = 3 + j % 4 * 2, p = pts[i], side = j % 2 ? 1 : -1;
      const reach = height * (.16 + noise(f.id + j) * .12), phase = Math.floor(t / 32);
      const branch = Array.from({length:6},(_,k)=>{const u=k/5;return [p[0]+side*reach*u+(noise(f.id+j*17+k*3+phase)-.5)*reach*.22*Math.sin(u*Math.PI),p[1]+reach*.55*u];});
      frame.strokes.push({points:section(branch,0,clamp(t/32)),width:pillar?2:1.3,alpha:(1-t/160)*.85,kind:'branch'});
    }
  } else {
    // 通道断裂成独立残弧，每段不同步收缩并向上逸散。
    for (let j=0;j<5;j++) {
      const t=clamp((elapsed-LIGHTNING_MOTION.channelEnd-j*13)/160);
      if(t>=1)continue;
      const start=j*.19+.025, fragment=section(pts,start,start+.12*(1-t));
      if(fragment.length)frame.strokes.push({points:fragment.map(p=>[p[0]+Math.sin(j+elapsed/80)*t*6,p[1]-t*18]),width:1.3*(1-t)+.3,alpha:(1-t)*.45,kind:'fragment'});
    }
  }
  // 接地电流沿碰撞半径爬行，而非把落点替换成一圈贴图。
  if(elapsed<220)for(let j=0;j<5;j++){
    const t=clamp((elapsed-j*5)/70),a=j*Math.PI*2/5+noise(f.id)*2,reach=f.radius*t;
    const points=Array.from({length:5},(_,i)=>{const u=i/4,side=Math.sin(i*2.4+f.id)*reach*.11;return [f.point.x+Math.cos(a)*reach*u-Math.sin(a)*side,f.point.y+Math.sin(a)*reach*u*.65+Math.cos(a)*side*.65];});
    frame.strokes.push({points,width:1.8,alpha:(1-elapsed/220)*.8,kind:'ground'});
  }
  return frame;
}
function diamond(g:RuneInk,x:number,y:number,r:number,color:string,alpha:number){g.solid([[x,y-r],[x+r*.4,y],[x,y+r],[x-r*.4,y]],color,alpha);}
export function paintLightning(g:RuneInk,f:RuneFx,now:number,simple:boolean,lowFlash:boolean) {
  const frame=sampleLightning(f,now);if(frame.phase==='ended')return;
  const age=now-f.born,lead=f.lead??0,elapsed=age-lead,x=f.point.x,y=f.point.y,flash=lowFlash?.53:1;
  const gold=/edict|pillar|arrow|storm/.test(f.visual),edge=gold?'#dba54e':'#428bb7',inner=gold?'#ffdf88':'#82dfe9';
  if(elapsed<0){
    const charge=clamp(age/Math.max(lead,1));
    // 金针与收束刻纹标记真正落点，不遮挡敌人危险提示。
    for(let i=0;i<3;i++){const a=i*2.094+f.id,z=f.radius*(.85-charge*.35),p=[x+Math.cos(a)*z,y+Math.sin(a)*z*.65];g.line(p[0],p[1],p[0]-Math.cos(a)*7,p[1]-Math.sin(a)*4,inner,(.3+charge*.4)*flash,1.5);}
    diamond(g,x,y-2,3+charge*3,inner,.65*flash);
    if(f.visual==='thunder-arrow')diamond(g,x,y-18,18,edge,.7);
  }
  for(const s of frame.strokes){
    if(s.points.length<2||s.alpha<=0||simple&&s.kind==='branch')continue;
    const a=s.alpha*flash,core=s.kind==='return',branch=s.kind==='branch'||s.kind==='fragment'||s.kind==='ground';
    if(!simple&&!branch)g.path(s.points,edge,a*.15,s.width*3.5);
    g.path(s.points,'#233f58',a*.75,s.width+2);
    g.path(s.points,inner,a,s.width);
    g.path(s.points,core?'#fff9dc':'#e3f8ee',a*(core?1:.8),Math.max(.55,s.width*.28));
  }
  if(frame.phase==='descent')diamond(g,frame.tip[0],frame.tip[1],6, '#e8fbe9',.95*flash);
  if(elapsed>=0&&elapsed<180){
    const t=elapsed/180,burst=(1-t)*flash,r=f.radius;
    // 接触火冠先抬升、再落下，持续保留敌人轮廓。
    for(let i=0;i<(simple?4:8);i++){
      const a=i*2.399+f.id,z=r*(.12+Math.sqrt(t)*.8),lift=Math.sin(t*Math.PI)*(8+i%3*7),px=x+Math.cos(a)*z,py=y+Math.sin(a)*z*.65-lift;
      diamond(g,px,py,(4+i%3*2)*(1-t),inner,burst*.9);
      if(!simple)g.line(px,py,px-Math.cos(a)*5,py+4,edge,burst*.7,1.2);
    }
    diamond(g,x,y-3,(f.visual==='thunder-pillar'?26:15)*(1-t), '#fff0b4',burst*.8);
  }
  if(f.visual==='frozen-jolt'&&elapsed>=0&&elapsed<260)for(let i=0;i<3;i++)diamond(g,x+(i-1)*12,y-22-elapsed/35,9*(1-elapsed/260),'#bce8ef',.7*flash);
}
