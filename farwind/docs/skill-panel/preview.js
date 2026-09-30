import { snapshot, states, currentSkills, capacitySkills } from './sample-data.js?animation=1';
import { diagramMarkup, animateDiagram } from './demonstration.js';

// 只保存在此页面内存中。没有游戏模块、存储接口或战斗对象。
const query = new URLSearchParams(location.search);
const scheme = ['a','b','c'].includes(query.get('scheme')) ? query.get('scheme') : 'a';
const stateKey = Object.hasOwn(states,query.get('state')) ? query.get('state') : 'stage3';
const state = states[stateKey];
const capacity = query.get('capacity') === '30' ? 30 : query.get('capacity') === '12' ? 12 : 4;
const root = document.getElementById('design-root');
let selected = stateKey === 'few' ? 'attack' : 'sword-wind';
let category = '全部';
let filter = '全部';
let search = '';
let preview = null;
const motionPreference = matchMedia('(prefers-reduced-motion:reduce)');
let paused = motionPreference.matches;
let reducedMotion = motionPreference.matches;
let animation = null;
let closed = false;
const expanded = new Set();

function icon(id) {
  const drawings = {
    wind:'<path d="M5 12h20c7 0 7-9 1-9-3 0-4 2-4 4M3 19h29M7 26h18c7 0 7 9 1 9-3 0-4-2-4-4"/>',
    guard:'<path d="M20 3 33 9v12c0 8-8 13-13 16C15 34 7 29 7 21V9Z"/><path d="m12 23 15-15-3 7-8 8m-3-1 5 5m-8 3 5-5"/>',
    step:'<path d="m13 6 9 1-2 13 10 4c4 2 5 5 3 8H12l-1-11Z"/><path d="M7 13H2m5 7H1m6 7H3m11 0h17"/>',
    leaf:'<path d="M7 32c-4-14 9-26 27-27-1 20-13 31-27 27ZM7 32 27 13M18 22l-2-8m3 7 8 1"/>',
    companion:'<path d="m5 12 3-8 8 6h8l8-6 3 8v14c-3 8-27 8-30 0Z"/><path d="M13 21h1m12 0h1m-9 5 2 2 2-2m-2 2v4"/>',
  };
  if(id === 'sword') return '<span class="icon"><img src="assets/sword.png" alt=""></span>';
  return `<span class="icon"><svg aria-hidden="true" viewBox="0 0 40 40">${drawings[id] || drawings.wind}</svg></span>`;
}

function allSkills() {
  let list = currentSkills.map(s=>({...s}));
  const sword = list[0];
  sword.current = state.stage ? snapshot.stages[state.stage-1].name : '尚未正式学习';
  sword.status = state.stage ? '已掌握' : state.discovered.length ? '有线索' : '临时可用';
  if(stateKey === 'few') list = list.filter(s=>s.id!=='sword-wind');
  if(capacity>4) list = [...list,...capacitySkills.slice(0,capacity-4)];
  return list;
}
function visibleSkills() {
  return allSkills().filter(s=> (category==='全部'||s.category===category) &&
    (filter==='全部'||filter==='已掌握'&&!s.planned&&(s.id!=='sword-wind'||state.stage>0)||filter==='有线索'&&s.id==='sword-wind'&&state.discovered.some(n=>n>state.stage)) &&
    (!search||s.name.includes(search)||s.current.includes(search)));
}
function profile() {
  const gist=stateKey==='few'?'佩剑 · 架剑 · 风步':state.stage===3?'剑风已能贯通敌阵':state.stage===5?'五段剑风，尽数掌握':state.temporary?'基础本领与临时试用':state.stage?'已掌握一线斩':'本领随旅途增长';
  return `<aside class="profile" aria-label="人物摘要"><div class="profile-info"><h2>旅人</h2><p>${gist}</p></div><img class="portrait" src="assets/traveler-bust.webp" alt="现有棕发红围巾旅人立绘"><div class="vitals"><div class="vital"><span>生命</span><strong>${stateKey==='few'?'100':'86'} / 100</strong></div><div class="vital-bar"><span style="width:${stateKey==='few'?100:86}%"></span></div><div class="vital"><span>体力</span><strong>100 / 100</strong></div><div class="vital-bar stamina"><span></span></div></div>${capacity>4?'<div class="profile-tail"><details class="techniques"><summary>未来技法位 · 规划示意</summary><p>设计样例，非已实装</p><div class="technique-slots"><span>技法一</span><span>技法二</span><span>技法三</span></div></details></div>':''}</aside>`;
}
function compactSummary() {
  return `<section class="compact-summary" aria-label="紧凑人物摘要"><img src="assets/traveler-portrait.png" alt="旅人"><div class="summary-text"><strong>旅人</strong><span>生命 ${stateKey==='few'?100:86} / 100</span><span>体力 100 / 100</span></div></section>`;
}
function card(s) {
  return `<button class="skill-card ${selected===s.id?'selected':''} ${s.planned?'planned':''}" data-skill="${s.id}" aria-pressed="${selected===s.id}" aria-label="${s.name}，${s.current}，${s.status}">${icon(s.icon)}<span class="card-copy"><span class="card-title"><strong>${s.name}</strong><small>${s.status}</small></span><span class="card-current">${s.current}</span>${s.planned?'':`<span class="card-brief">${s.brief}</span>`}</span></button>`;
}
function catalog() {
  const list = visibleSkills();
  const grouped = capacity<=4&&scheme!=='c';
  const categories = capacity>4 ? ['全部','战斗','探索','生存','同行'] : ['战斗'];
  return `<section class="catalog" aria-label="技艺目录"><div class="catalog-head"><h2>${scheme==='b'?'本领目录':scheme==='c'?'技艺图鉴':'技艺'} <span class="count">${allSkills().length}</span></h2><select class="filters" aria-label="掌握状态筛选">${['全部','已掌握','有线索'].map(f=>`<option value="${f}" ${filter===f?'selected':''}>${f}</option>`).join('')}</select></div><nav class="categories" aria-label="能力分类">${categories.map(c=>`<button data-category="${c}" aria-pressed="${category===c||categories.length===1}">${c}</button>`).join('')}</nav>${capacity>12?`<input class="search" type="search" placeholder="查找技艺" aria-label="查找技艺名称" value="${search.replaceAll('&','&amp;').replaceAll('"','&quot;')}">`:''}<div class="skill-list" tabindex="0" aria-label="可滚动的能力目录">${list.length?list.map((s,i)=>`${grouped&&(i===0||s.external!==list[i-1]?.external)?`<div class="group-label">${s.external?'旅途外学':'基础能力'}</div>`:''}${card(s)}`).join(''):'<p class="empty">没有符合条件的技艺。</p>'}</div>${capacity>4?'<p class="catalog-note">设计样例，非已实装</p>':''}</section>`;
}

// 使用原生折叠，先看用途与操作，需要时再展开细节。展开状态只留在页面内存。
function disclosure(id,label,content,hint='') {
  return `<details class="disclosure" data-section="${id}" ${expanded.has(id)?'open':''}><summary><span>${label}</span>${hint?`<small>${hint}</small>`:''}</summary><div class="disclosure-content">${content}</div></details>`;
}

function diagram(stage) {
  return diagramMarkup(stage,snapshot.stages[stage-1]);
}
function sourceList() {
  if(state.legacy) return '<ul class="learning"><li><span class="record-mark">已继承</span><strong>旧版正式学习继承</strong><span class="source">没有对应教本或风道记录</span></li></ul>';
  if(!state.completed.length) return '<p class="effect-copy">尚无正式学习经历。旅途中的教本与风敏装置会留下线索。</p>';
  return `<ul class="learning">${state.completed.map(n=>`<li><span class="record-mark">${n>state.stage?'待前置':'已记录'}</span><strong>${snapshot.lessons[n-1].name}</strong><span class="source">${snapshot.lessons[n-1].source}${n>state.stage?' · 经历已记录，尚待前置':''}</span></li>`).join('')}</ul>`;
}
function clues() {
  const next=state.discovered.find(n=>n>state.stage&&!state.completed.includes(n));
  if(state.stage===5) return '<p class="quiet-state">五段传承已掌握</p>';
  if(next===4) return disclosure('clue','下一条线索 · 展风于野','<p>遗迹南侧的扩流风口，可以把细风展开。</p><p>在铺垫处面向北方，试用宽幅剑风，一次触动远处左右两枚风铃；右侧另有窄通道对照。</p>','已发现');
  if(next===1) return disclosure('clue','学习线索 · 临水送风','<p>临水草坡的守风教本，记着向水面送风的方法。</p><p>在南侧木桥边读教本，面向北方，以三连斩后的第四击触动水面风铃。</p>','已发现');
  return '<p class="quiet-state">尚未发现下一条学习线索</p>';
}
function swordDetail() {
  const shown=preview||state.stage||state.temporary||1;
  const c=snapshot.stages[shown-1];
  const future=shown>state.stage;
  const status=state.temporary?(state.stage?'已掌握':'未学习'):state.legacy?'旧版继承':state.status;
  const shortNames=['一线斩','双穿','贯通','疾风斩','三向疾风'];
  return `<div class="detail-heading">${icon('wind')}<div class="heading-copy"><h2>剑风</h2><p class="current-line">${state.temporary?'正式当前':'当前'}：${state.stage?snapshot.stages[state.stage-1].name:'未学习'}</p></div><span class="tag">${status}</span></div>${preview?`<div class="preview-warning"><strong>${future?'尚未掌握 · 效果预览':'已掌握 · 效果回顾'}：${c.name}</strong><button id="return-current">返回当前</button></div>`:!state.stage?'<div class="preview-warning">尚未掌握 · 效果预览</div>':''}${state.temporary?`<div class="preview-warning">${stateKey==='grant'?'测试授予 · 非永久掌握':'教学试用 · 非永久掌握'}：${snapshot.stages[state.temporary-1].name}${stateKey==='trial'?'（仅教学区域）':''}</div>`:''}<p class="skill-purpose">${c.brief}</p><figure class="diagram-panel">${diagram(shown)}<figcaption class="diagram-caption"><span>${shown===5?`相邻30° · 总张角60° · 每道宽${c.width}<br>`:`<span class="compact-measure">宽${c.width} · 射程${c.range} · </span>`}<span data-motion-status>演示慢放 · 蓄势送风</span></span><div class="preview-tools"><button id="pause-preview">${paused?'播放':'暂停'}</button><label><input id="reduce-motion" type="checkbox" ${reducedMotion?'checked':''} ${motionPreference.matches?'disabled title="系统已开启减少动态"':''}> 减少动态</label></div></figcaption></figure><div class="operating"><span class="operation-label">操作</span><kbd>J / 左键</kbd><span>三连斩后，再按一次接第四击</span></div><h3 class="section-label">成长</h3><div class="route" role="group" aria-label="剑风五个永久阶段">${snapshot.stages.map((s,i)=>`<button class="node ${s.id<=state.stage?'earned':''} ${s.id===state.stage?'current':''} ${s.id===preview?'viewing':''}" data-stage="${s.id}" aria-label="${s.name}，${s.id===state.stage?'当前阶段':s.id<=state.stage?'已掌握':'尚未掌握，效果预览'}"><span class="node-mark">${s.id<state.stage?'✓':s.id}</span><strong>${shortNames[i]}</strong><small>${s.id===state.stage?'当前':s.id<=state.stage?'已掌握':'未掌握'}</small></button>`).join('')}</div><div class="more-details">${disclosure('config','效果细节与数值',`<p>${c.brief}。${shown===5?'每道独立受实体障碍阻挡，同次释放对同一敌人最多结算一次伤害。':'可越过水面，实体障碍后的目标不受击。'}</p><p>攻击宽度 ${c.width} · 射程 ${c.range}（世界单位）${shown===5?' · 相邻30°，总张角60°':''}</p><p>基础配置伤害 ${snapshot.baseDamage}，实际伤害由现有装备与伤害流程修正。</p><p>J / 游戏画布左键：三连斩后以新的按下接第四击。成长永久保留，后阶继承前阶，不占技法位；节点只用于查看。</p>`)}${disclosure('learning','学习来源与经历',sourceList(),state.legacy?'旧版继承':state.completed.length+' 条')}${clues()}</div>`;
}
function otherDetail(s) {
  const instructions={
    attack:['连续按下，衔接三连斩','正式学习剑风后，以新的输入接第四击；前三刀始终保留。'],
    parry:['架剑防御，成功弹反后自动反斩','远程弹反会发出剑气；它属于架剑反击，不代表学会永久剑风。'],
    dash:['短距闪避，调整位置','消耗与冷却由现有战斗配置决定。'],
  };
  if(s.planned) return `<div class="detail-heading">${icon(s.icon)}<div class="heading-copy"><h2>${s.name}</h2><p class="current-line">${s.category} · 容量样例</p></div></div><div class="preview-warning">设计样例，非已实装</div><p class="skill-purpose">仅用于查看目录容量</p><p class="effect-copy">没有正式效果或玩家掌握状态，正式目录隐藏。</p>`;
  return `<div class="detail-heading">${icon(s.icon)}<div class="heading-copy"><h2>${s.name}</h2><p class="current-line">${s.current}</p></div><span class="tag">基础能力</span></div><p class="skill-purpose">${s.brief}</p><section class="basic-visual">${icon(s.icon)}<strong>${s.current}</strong></section><div class="operating"><span class="operation-label">操作</span><kbd>${s.key}</kbd><span>${instructions[s.id][0]}</span></div><p class="quiet-state">始终可用</p><div class="more-details">${disclosure('config','操作补充',`<p>${instructions[s.id][1]}</p>`)}${disclosure('learning','能力来源','<p>原有基础操作。</p>','基础能力')}</div>`;
}
function render(options={}) {
  animation?.dispose();animation=null;
  const list=visibleSkills();
  if(!list.some(s=>s.id===selected)) { selected=list[0]?.id||null; preview=null; expanded.clear(); }
  if(closed) { root.innerHTML='<div class="stage"><section class="closed-view"><h1>设计样稿已合上</h1><p>这是独立设计页，尚未接入真实游戏。</p><button id="reopen">重新查看图稿</button></section></div>';root.querySelector('#reopen').onclick=()=>{closed=false;render();};return; }
  const s=allSkills().find(s=>s.id===selected);
  const detail=s?(selected==='sword-wind'?swordDetail():otherDetail(s)):'<p class="empty">此分类没有可展示的内容。请选择其他分类或筛选。</p>';
  root.innerHTML=`<div class="stage scheme-${scheme} ${capacity>4?'capacity':''}"><section class="sheet" role="dialog" aria-modal="true" aria-labelledby="design-title"><header class="topbar"><div class="title-block"><h1 id="design-title">旅人技艺</h1></div><span class="design-note">${capacity>4?'设计样例，非已实装':'设计样例 · 非真实存档'}</span><button class="close" id="close-design">返回旅途 <kbd>Esc</kbd></button></header>${compactSummary()}<div class="body">${profile()}${catalog()}<section class="details-wrap" aria-label="所选技艺详情"><div class="detail-scroll" tabindex="0" aria-label="可滚动的技能详情">${detail}</div></section></div><footer class="footer"><span>只读查看 · 在旅途中学习</span><span>Tab 切换 · Esc 返回</span></footer></section></div>`;
  bind();
  const svg=root.querySelector('.attack-diagram');
  if(svg) {
    const stage=Number(svg.dataset.stage);
    animation=animateDiagram(svg,stage,snapshot.stages[stage-1],snapshot.speed,message=>{root.querySelector('[data-motion-status]').textContent=message;});
    updateMotion();
  }
  if(options.focusSelector) root.querySelector(options.focusSelector)?.focus({preventScroll:true});
  if(options.scrollTop!==undefined) root.querySelector('.skill-list').scrollTop=options.scrollTop;
}
function bind() {
  for(const button of root.querySelectorAll('[data-skill]')) button.onclick=()=>{const scroll=root.querySelector('.skill-list').scrollTop;selected=button.dataset.skill;preview=null;expanded.clear();render({focusSelector:`[data-skill="${selected}"]`,scrollTop:scroll});};
  root.querySelector('.filters').onchange=event=>{filter=event.target.value;render({focusSelector:'.filters'});};
  for(const details of root.querySelectorAll('[data-section]')) details.ontoggle=()=>{if(details.open)expanded.add(details.dataset.section);else expanded.delete(details.dataset.section);};
  for(const button of root.querySelectorAll('[data-category]')) button.onclick=()=>{category=button.dataset.category;render({focusSelector:`[data-category="${category}"]`});};
  for(const button of root.querySelectorAll('[data-stage]')) button.onclick=()=>{preview=Number(button.dataset.stage);render({focusSelector:`[data-stage="${preview}"]`});};
  const searchInput=root.querySelector('.search');
  if(searchInput) searchInput.oninput=()=>{search=searchInput.value;const cursor=searchInput.selectionStart;render({focusSelector:'.search'});const next=root.querySelector('.search');try{next.setSelectionRange(cursor,cursor);}catch{/* 搜索框不支持选择范围时保持焦点即可。 */}};
  root.querySelector('#close-design').onclick=()=>{closed=true;render();};
  root.querySelector('#return-current')?.addEventListener('click',()=>{preview=null;render({focusSelector:'[data-skill="sword-wind"]'});});
  const play=root.querySelector('#pause-preview');
  if(play) play.onclick=()=>{paused=!paused;play.textContent=paused?'播放':'暂停';updateMotion();};
  const reduce=root.querySelector('#reduce-motion');
  if(reduce) reduce.onchange=()=>{reducedMotion=reduce.checked;updateMotion();};
}
function updateMotion() {
  animation?.update(!paused,reducedMotion||motionPreference.matches);
}
motionPreference.addEventListener('change',()=>{if(motionPreference.matches){paused=true;reducedMotion=true;}render({focusSelector:'#pause-preview'});});
window.addEventListener('pagehide',()=>animation?.dispose());
window.addEventListener('pageshow',event=>{if(event.persisted)render();});
root.addEventListener('keydown',event=>{
  if(closed)return;
  if(event.key==='Escape') {event.preventDefault();event.stopPropagation();if(preview!==null){preview=null;render({focusSelector:'[data-skill="sword-wind"]'});}else{closed=true;render();}return;}
  if(event.key==='Tab') {
    const controls=[...root.querySelectorAll('button:not(:disabled),input,select,summary,[tabindex="0"]')].filter(el=>el.getClientRects().length>0);
    const index=controls.indexOf(document.activeElement);
    if(controls.length&&(index<0||event.shiftKey&&index===0||!event.shiftKey&&index===controls.length-1)){event.preventDefault();controls[event.shiftKey?controls.length-1:0].focus();}
  }
});
render();
