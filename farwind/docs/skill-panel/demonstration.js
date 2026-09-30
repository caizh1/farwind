// 独立展示动画：只有示意几何与本页时钟，不运行战斗、不读写玩家数据。
export function demonstration(stage, config) {
  const three = stage === 5;
  const scale = three ? .28 : .62;
  const origin = three ? [168, 144] : [28, 56];
  const targets = three ? [
    { id:'shared', x:0, y:-60 },
    { id:'left', x:-175, y:-303.1 },
    { id:'front', x:0, y:-240 },
    { id:'far', x:0, y:-370 },
    { id:'right', x:95, y:-164.5 },
    { id:'behind', x:170, y:-294.4 },
  ] : [
    { id:'first', x:85, y:0 }, { id:'second', x:175, y:0 },
    { id:'third', x:250, y:0 }, { id:'wide', x:175, y:37 },
    { id:'behind', x:335, y:0 },
  ];
  const limit = stage === 1 ? 1 : stage === 2 ? 2 : Infinity;
  const lanes = config.angles.map(angle => {
    const rotation = three ? angle - 90 : angle;
    const radians = rotation * Math.PI / 180;
    const dx = Math.cos(radians), dy = Math.sin(radians);
    const wall = three ? angle === 30 ? 280 : null : 285;
    const available = Math.min(config.range, wall ?? config.range);
    const contacts = targets.map(target => {
      const along = target.x * dx + target.y * dy;
      const across = Math.abs(target.x * dy - target.y * dx);
      return { id:target.id, distance:Math.max(0, along - 8), along, across };
    }).filter(hit => hit.along > 0 && hit.along < available && hit.across <= config.width / 2 + 8)
      .sort((a,b) => a.distance - b.distance).slice(0,limit);
    const end = contacts.length === limit ? contacts.at(-1).distance : available;
    return { angle, rotation, dx, dy, wall, end, contacts,
      stopped:contacts.length === limit ? 'target' : wall !== null && wall <= config.range ? 'wall' : 'range' };
  });
  // 三道攻击共享本次释放的受击记录，同一个示意敌人只反馈一次。
  const hits = new Map();
  for (const lane of lanes) for (const hit of lane.contacts) {
    if (!hits.has(hit.id) || hits.get(hit.id).distance > hit.distance) hits.set(hit.id,hit);
  }
  return { stage, config, three, scale, origin, targets, lanes, hits:[...hits.values()] };
}

export function diagramMarkup(stage, config) {
  const model = demonstration(stage,config);
  const { three, scale:s, origin:[ox,oy] } = model;
  const lanes = model.lanes.map((lane,index) => {
    const w = config.width * s, end = lane.end * s;
    return `<g transform="translate(${ox} ${oy}) rotate(${lane.rotation})">
      <rect x="0" y="${-w/2}" width="${config.range*s}" height="${w}" fill="none" stroke="#8c9879" stroke-opacity=".35" stroke-dasharray="3 3"/>
      <rect x="0" y="${-w/2}" width="${end}" height="${w}" rx="2" fill="#789970" fill-opacity=".22" stroke="#567a52" stroke-width="1.1"/>
      <path d="M0 0H${end}" stroke="#68805a" stroke-dasharray="3 3" stroke-opacity=".7"/>
      ${lane.wall!==null?`<rect x="${lane.wall*s}" y="${-w/2-6}" width="7" height="${w+12}" rx="1" fill="#776e54"/>`:''}
      <g data-flight="${index}" opacity="0"><svg data-frame="${index}" x="-38" y="${-w/2}" width="44" height="${w}" viewBox="0 0 128 128" preserveAspectRatio="none" overflow="hidden"><image href="assets/sword-wind-flight.png" width="768" height="128"/></svg></g>
    </g>`;
  }).join('');
  const targets = model.targets.map(target => `<circle data-target="${target.id}" cx="${ox+target.x*s}" cy="${oy+target.y*s}" r="${three?5.5:8}" fill="#dfddc8" stroke="#9b9272" ${target.id==='behind'?'stroke-dasharray="3 2"':''}/>`).join('');
  const annotation = three ? '<path d="M146 106Q168 95 190 106" fill="none" stroke="#a0864b"/><text x="133" y="93" font-size="14" fill="#816b3a">30°</text><text x="174" y="93" font-size="14" fill="#816b3a">30°</text><text x="235" y="77" font-size="14" fill="#665f4a">实体障碍</text><text x="18" y="28" font-size="14" fill="#5c6c4d">宽64</text><text x="234" y="122" font-size="14" fill="#8c694c">空隙不命中</text>' : `<text x="90" y="18" font-size="14" fill="#586849">${config.range} 射程 · 宽 ${config.width}</text><text x="174" y="107" font-size="14" fill="#716a50">障碍截断</text><text x="258" y="27" font-size="14" fill="#8b7f68">不受击</text>`;
  // 节点与攻击带是技术示意；运动风刃直接使用现有游戏帧素材。
  return `<svg class="attack-diagram" ${three?'style="height:159px"':''} viewBox="0 0 ${three?'336 165':'346 112'}" role="img" aria-label="${config.name}展示动画：${config.brief}；攻击带外与障碍后的敌人不受击" data-stage="${stage}" data-running="false">${lanes}${targets}<circle cx="${ox}" cy="${oy}" r="8" fill="#a45440"/><text x="${ox-18}" y="${oy+(three?20:34)}" font-size="14" fill="#536449">旅人</text>${annotation}</svg>`;
}

export function animateDiagram(svg, stage, config, speed, onStatus) {
  const model = demonstration(stage,config);
  const flights = [...svg.querySelectorAll('[data-flight]')];
  const frames = [...svg.querySelectorAll('[data-frame]')];
  const targets = [...svg.querySelectorAll('[data-target]')];
  const duration = 3600;
  let elapsed = 0, last = 0, request = 0, playing = false, reduced = false, disposed = false;
  function draw() {
    const age = elapsed % duration;
    // 展示慢放四倍。这里的时间不代表真实战斗释放速度。
    const distance = reduced ? Math.floor(age/700) / 3 * config.range : Math.max(0,age-300) / 4000 * speed;
    const hitCount = model.hits.filter(hit=>distance>=hit.distance).length;
    model.lanes.forEach((lane,index)=>{
      const position = Math.min(distance,lane.end) * model.scale;
      flights[index].setAttribute('transform',`translate(${position} 0)`);
      flights[index].setAttribute('opacity',!reduced&&age>=300&&distance<=lane.end?'1':'0');
      frames[index].setAttribute('viewBox',`${Math.floor(age/72)%6*128} 0 128 128`);
    });
    for (const target of targets) {
      const hit = model.hits.find(hit=>hit.id===target.dataset.target);
      const struck = Boolean(hit && distance>=hit.distance);
      target.setAttribute('fill',struck?'#d0b47a':'#dfddc8');
      target.setAttribute('stroke',struck?'#4e754a':'#9b9272');
      target.setAttribute('stroke-width',struck?'2.2':'1');
      target.setAttribute('data-hit',struck?'1':'0');
    }
    svg.dataset.elapsed = String(Math.round(elapsed));
    svg.dataset.hits = String(hitCount);
    svg.dataset.reduced = String(reduced);
    const ended = model.lanes.every(lane=>distance>lane.end);
    const message = ended ? `命中 ${hitCount} 个 · ${model.lanes.some(lane=>lane.stopped==='wall')?'障碍截断':'送风结束'}` : hitCount ? `命中 ${hitCount} 个 · 继续送风` : '蓄势送风';
    onStatus(`${reduced?'逐步演示':'演示慢放'} · ${message}`);
  }
  function tick(now) {
    if(disposed||!playing||document.hidden)return;
    elapsed += last ? Math.min(now-last,80) : 0;
    last = now;
    draw();
    request=requestAnimationFrame(tick);
  }
  function schedule() {
    cancelAnimationFrame(request);
    last=0;
    svg.dataset.running=String(playing&&!document.hidden&&!disposed);
    if(playing&&!document.hidden&&!disposed)request=requestAnimationFrame(tick);
  }
  function visibility() { schedule(); }
  document.addEventListener('visibilitychange',visibility);
  draw();
  return {
    update(isPlaying,reduceMotion) {
      if(disposed)return;
      if(reduced!==reduceMotion)elapsed=0;
      playing=isPlaying; reduced=reduceMotion;
      draw(); schedule();
    },
    dispose() {
      disposed=true;playing=false;cancelAnimationFrame(request);
      svg.dataset.running='false';
      document.removeEventListener('visibilitychange',visibility);
    },
  };
}
