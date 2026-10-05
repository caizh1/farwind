import {ROAD_NEST,ROAD_POSTS} from '../../data/merchantRoad';
import {roadTracked,roadRouteStatus} from '../systems/merchantRoadState';
import {CITY_BUILDINGS} from '../../data/cityLayout';
import {cityBuilding} from '../../data/cityLayout';
import { BRIDGES, WORLD, WATERS, roads, region } from '../../data/world';
import { CITY_PROPS, CITY_SERVICES, TRADE_ROAD_NODES,tradeRoadAnchor } from '../../data/maps/windwhisper';
import { SERVICE_SIGNS } from '../../data/maps/windbell/layout';
import { ENCOUNTERS } from '../../data/maps/windbell/encounters';
import { SHORTCUTS } from '../../data/maps/windbell/shortcuts';
import { HOMES } from '../../data/npcLife';
import type { State } from '../systems/state';
import { legacyTracked } from '../systems/windLegacy';
import { createMinimapTerrain, loadMinimapArt, type MinimapArt } from './minimapTerrain';

const size = { width: 320, height: 160 };
const viewWidth = 2800;
const viewHeight = viewWidth * size.height / size.width;
const landmarks = [
  ...SERVICE_SIGNS.map(s => ({ ...s.point, name: s.name })),
  ...CITY_BUILDINGS.filter(b=>!b.private).map(b=>({...b.door,name:b.name})),
  ...CITY_PROPS.filter(p => p.id.startsWith('road-rest-')).map(p => ({ ...p, name: p.label!.split(' · ')[0] })),
];

// 只读导航使用室外入口，不把室内坐标错误地投射到世界地图。
export function minimapView(s: State) {
  const player = s.life.playerSpace === 'village' ? s.player : s.life.outside;
  const left = Math.max(WORLD.left, Math.min(WORLD.right - viewWidth, player.x - viewWidth / 2));
  const top = Math.max(WORLD.top, Math.min(WORLD.bottom - viewHeight, player.y - viewHeight / 2));
  return { player, camera: { x: left + viewWidth / 2, y: top + viewHeight / 2, scale: size.width / viewWidth }, left, top, width: viewWidth, height: viewHeight };
}

export class Minimap {
  private terrain?: ReturnType<typeof createMinimapTerrain>;
  private art?: MinimapArt;
  private loading = false;
  private failed = false;
  private previous?: { x: number; y: number; space: string };
  private heading = 0;
  private peakDraw = 0;

  private load() {
    if (this.loading) return;
    this.loading = true;
    loadMinimapArt().then(art => {
      this.art = art;
      this.terrain = createMinimapTerrain(art);
    }).catch(() => { this.failed = true; });
  }

  draw(canvas: HTMLCanvasElement, s: State) {
    this.load();
    const began = performance.now();
    const { player, camera, left, top } = minimapView(s);
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const width = Math.round(size.width * dpr), height = Math.round(size.height * dpr);
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    const c = canvas.getContext('2d')!;
    c.setTransform(width / size.width, 0, 0, height / size.height, 0, 0);
    c.clearRect(0, 0, size.width, size.height);
    c.fillStyle = '#658259';
    c.fillRect(0, 0, size.width, size.height);
    const px = (x: number) => (x - left) * camera.scale;
    const py = (y: number) => (y - top) * camera.scale;
    const visible = (p: { x: number; y: number }) => px(p.x) > 10 && px(p.x) < size.width - 10 && py(p.y) > 10 && py(p.y) < size.height - 10;
    if (this.terrain) this.terrain.draw(c, camera, size);
    else {
      // 素材加载期间或失败时保留真实道路、水域、桥梁与动态标记。
      c.fillStyle = '#3d8c9e';
      for (const p of WATERS) { c.beginPath(); c.ellipse(px(p.x), py(p.y), p.rx * camera.scale, p.ry * camera.scale, 0, 0, Math.PI * 2); c.fill(); }
      c.strokeStyle = '#cfbc8a'; c.lineWidth = 3;
      for (const path of roads) { c.beginPath(); path.forEach(([x, y], i) => i ? c.lineTo(px(x), py(y)) : c.moveTo(px(x), py(y))); c.stroke(); }
      c.fillStyle = '#b3a582';
      for (const b of BRIDGES) c.fillRect(px(b.x), py(b.y), b.w * camera.scale, b.h * camera.scale);
    }
    const marker = (p: { x: number; y: number }, color: string, radius = 3) => {
      c.beginPath(); c.arc(px(p.x), py(p.y), radius, 0, Math.PI * 2);
      c.fillStyle = color; c.fill(); c.strokeStyle = '#193a36'; c.lineWidth = 1.5; c.stroke();
    };
    const labelled: { x: number; y: number; width: number }[] = [];
    const label = (p: { x: number; y: number }, name: string, color: string) => {
      const x = px(p.x), y = py(p.y);
      c.font = '600 10px "Songti SC", serif';
      const width = c.measureText(name).width + 10;
      const lx = Math.max(width / 2 + 5, Math.min(size.width - width / 2 - 5, x));
      const ly = Math.max(14, Math.min(size.height - 10, y - 10));
      if (Math.abs(lx - px(player.x)) < width / 2 + 12 && Math.abs(ly - py(player.y)) < 18) return;
      if (labelled.some(l => Math.abs(lx - l.x) < (width + l.width) / 2 + 4 && Math.abs(ly - l.y) < 15)) return;
      labelled.push({ x: lx, y: ly, width });
      c.textAlign = 'center'; c.lineJoin = 'round'; c.strokeStyle = '#18392deb'; c.lineWidth = 3;
      c.strokeText(name, lx, ly); c.fillStyle = color; c.fillText(name, lx, ly);
    };
    const tracked = roadTracked(s)??legacyTracked(s);
    if (tracked && visible(tracked.point)) { marker(tracked.point, '#ffe398', 5); label(tracked.point, tracked.name, '#fff0b4'); }
    for (const b of BRIDGES) {
      const point = { x: b.x + b.w / 2, y: b.y + b.h / 2 + 110 };
      if (visible(point)) label(point, b.x > 4290 ? '石拱桥' : '渡桥', '#f5e3b8');
    }
    for (const p of landmarks.filter(visible).sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y)).slice(0, 3)) {
      marker(p, '#91e5db'); label(p, p.name, '#bff8eb');
    }
    if(visible(ROAD_NEST)){marker(ROAD_NEST,s.merchantRoad.nest.wave===3?'#a7d5aa':'#e48c6e');label(ROAD_NEST,s.merchantRoad.nest.wave===3?'巢穴已清剿':'裂牙巢穴','#ffe0bf');}
    if(s.merchantRoad.opened)for(const p of ROAD_POSTS)if(visible(p)){marker(p,'#91e5db');label(p,p.name,'#bff8eb');}
    for (const [i, p] of TRADE_ROAD_NODES.map((_,i)=>tradeRoadAnchor(i,s.merchantRoad.opened)).entries()) if (visible(p)) {
      const cleared = s.tradeRoad.nodes[i]?.cleared;
      marker(p, cleared ? '#a7d5aa' : '#e48c6e'); label(p, p.name, cleared ? '#d1edcb' : '#ffe0bf');
    }
    for (const p of ENCOUNTERS.filter(p => p.kind === 'camp' && visible(p))) {
      const cleared = s.encounters.groups[p.id].cleared;
      marker(p, cleared ? '#a7d5aa' : '#e48c6e', 4); label(p, cleared ? '已清除' : p.name, cleared ? '#d1edcb' : '#ffe0bf');
    }
    for (const p of SHORTCUTS) if (visible(p.barrier)) marker(p.barrier, s.mapProgress.shortcuts.includes(p.id) ? '#a7d5aa' : '#e48c6e');
    const xb = s.xiaobao;
    const companion = xb.space === 'village' ? xb : ((cityBuilding(xb.space)??HOMES.find(h => h.id === xb.space))?.door ?? xb);
    if (visible(companion) && Math.hypot(companion.x - player.x, companion.y - player.y) > 35) marker(companion, '#c2f6e7');
    const previous = this.previous;
    if (previous && previous.space === s.life.playerSpace) {
      const dx = player.x - previous.x, dy = player.y - previous.y;
      if (Math.hypot(dx, dy) > .5 && Math.hypot(dx, dy) < 150) this.heading = Math.atan2(dy, dx) + Math.PI / 2;
    }
    this.previous = { x: player.x, y: player.y, space: s.life.playerSpace };
    c.save(); c.translate(px(player.x), py(player.y));
    c.beginPath(); c.arc(0, 0, 11, 0, Math.PI * 2); c.fillStyle = '#17392d70'; c.fill();
    c.strokeStyle = '#f6dda5b0'; c.lineWidth = 1; c.stroke();
    c.rotate(this.heading);
    if (this.art) c.drawImage(this.art.sprites.player, -9, -12, 18, 24);
    else { c.beginPath(); c.moveTo(0, -8); c.lineTo(6, 6); c.lineTo(0, 3); c.lineTo(-6, 6); c.closePath(); c.fillStyle = '#fff7d4'; c.fill(); }
    c.restore();
    c.textAlign = 'start';
    canvas.dataset.renderer = this.terrain ? 'painted' : this.failed ? 'fallback' : 'loading';
    canvas.dataset.playerX = String(player.x); canvas.dataset.playerY = String(player.y);
    canvas.dataset.centerX = String(camera.x); canvas.dataset.centerY = String(camera.y);
    const elapsed = performance.now() - began;
    this.peakDraw = Math.max(this.peakDraw, elapsed);
    canvas.dataset.performance = JSON.stringify({ 绘制毫秒: elapsed, 峰值毫秒: this.peakDraw, ...this.terrain?.stats() });
    canvas.setAttribute('aria-label', `周边地形小地图 · ${region(player.x, player.y)}${s.life.playerSpace === 'village' ? '' : ' · 室外入口'}，上方为北，金色为主角，青色为服务，红色为挑战`);
    const note = canvas.parentElement!.querySelector<HTMLElement>('#minimap-note')!;
    note.textContent = s.life.playerSpace === 'village' ? '周边地形' : '室外入口';
  }
}
