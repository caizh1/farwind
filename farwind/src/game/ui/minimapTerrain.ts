import { WORLD, WATERS, BRIDGES, roads, roadWidth, props, mapGeometryRevision } from '../../data/world';
import { MAP_REGIONS, VILLAGE_WALLS } from '../../data/village';
import { BUILDING_LOTS } from '../../data/maps/windbell/layout';
import { CITY_PROPS } from '../../data/maps/windwhisper';
import {CITY_BUILDINGS} from '../../data/cityLayout';
import {loadCityMapArt,type CityMapArt} from './cityMapArt';
import type { MapCamera, MapSize } from './mapViewport';

const spriteNames = ['tree-oak', 'tree-dark', 'tree-light', 'tree-pine', 'rock', 'bush', 'roof-house', 'roof-tower', 'bridge-stone', 'bridge-wood', 'bank-rock', 'player'] as const;
type SpriteName = typeof spriteNames[number];
export type MinimapArt = { materials: HTMLImageElement; sprites: Record<SpriteName, HTMLImageElement>;city?:CityMapArt };
const image = (name: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const asset = new Image();
  asset.onload = () => resolve(asset);
  asset.onerror = () => reject(new Error(`小地图素材未能加载：${name}`));
  asset.src = `/assets/minimap/painted/${name}.webp`;
});
export async function loadMinimapArt(): Promise<MinimapArt> {
  const [[materials,...sprites],city] = await Promise.all([Promise.all(['materials', ...spriteNames].map(image)),loadCityMapArt()]);
  return { materials, sprites: Object.fromEntries(spriteNames.map((name, i) => [name, sprites[i]])) as MinimapArt['sprites'],city };
}

// 桥面、路径与水域仍来自正式世界。装饰只改变画面，不参与通行判定。
export function createMinimapTerrain(art: MinimapArt) {
  const cells = Array.from({ length: 8 }, (_, i) => {
    const cell = document.createElement('canvas'); cell.width = cell.height = 512;
    const c = cell.getContext('2d')!;
    // 镜像拼接保持相邻材质边缘相同，避免河水与草地出现方格接缝。
    for (const flipX of [false, true]) for (const flipY of [false, true]) {
      c.save(); c.translate(flipX ? 512 : 0, flipY ? 512 : 0); c.scale(flipX ? -1 : 1, flipY ? -1 : 1);
      c.drawImage(art.materials, i % 4 * art.materials.naturalWidth / 4, Math.floor(i / 4) * art.materials.naturalHeight / 2, art.materials.naturalWidth / 4, art.materials.naturalHeight / 2, 0, 0, 256, 256); c.restore();
    }
    return cell;
  });
  const cache = new Map<string, HTMLCanvasElement>();
  let generated = 0, peak = 0;
  const span = 768, resolution = .5, limit = 24;
  const treeArts = new Set(['tree', 'pink', 'pine', 'tree-pine', 'tree-autumn']);
  const buildings = [
    ...BUILDING_LOTS.map(p => ({ x: p.x, y: p.y, w: p.solid[0], h: p.solid[1], tower: false,art:'' })),
    ...CITY_BUILDINGS.map(b=>({x:b.x,y:b.y,w:b.w*.8,h:90,tower:b.id==='tower',art:b.art})),
  ];
  const path = (c: CanvasRenderingContext2D, points: readonly (readonly number[])[]) => {
    c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
  };
  const paint = (x: number, y: number) => {
    const tile = document.createElement('canvas'); tile.width = tile.height = span * resolution;
    const c = tile.getContext('2d')!; c.setTransform(resolution, 0, 0, resolution, -x * resolution, -y * resolution);
    const visible = (left: number, top: number, width: number, height: number) => left < x + span && left + width > x && top < y + span && top + height > y;
    const texture = (index: number, units: number) => {
      const pattern = c.createPattern(cells[index], 'repeat')!;
      pattern.setTransform(new DOMMatrix().scale(units / 512)); return pattern;
    };
    const sprite = (name: SpriteName, cx: number, cy: number, width: number, angle = 0) => {
      const asset = art.sprites[name], height = width * asset.naturalHeight / asset.naturalWidth;
      // 宽松外接圆保证旋转的松树与岩石不会在块边界截断。
      const radius = Math.hypot(width, height) / 2;
      if (!visible(cx - radius, cy - radius, radius * 2, radius * 2)) return;
      c.save(); c.translate(cx, cy); c.rotate(angle); c.drawImage(asset, -width / 2, -height / 2, width, height); c.restore();
    };
    c.fillStyle = texture(0, 720); c.fillRect(x, y, span, span);
    for (const r of MAP_REGIONS) {
      if (r.id === 'village') continue;
      const xs = r.polygon.map(p => p.x), ys = r.polygon.map(p => p.y);
      if (!visible(Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys))) continue;
      c.save(); c.beginPath(); r.polygon.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.closePath(); c.clip();
      c.globalAlpha = r.id === 'wind-city' ? .14 : r.id === 'south' ? .55 : .32;
      c.fillStyle = texture(r.id === 'south' || r.id === 'west' ? 7 : r.id === 'ruins' ? 6 : r.id === 'wind-city' ? 3 : 5, 720);
      c.fillRect(x, y, span, span); c.restore();
    }
    for (const p of WATERS) {
      if (!visible(p.x - p.rx - 100, p.y - p.ry - 100, p.rx * 2 + 200, p.ry * 2 + 200)) continue;
      c.beginPath(); c.ellipse(p.x, p.y, p.rx + 24, p.ry + 24, 0, 0, Math.PI * 2); c.fillStyle = texture(6, 360); c.fill();
      c.beginPath(); c.ellipse(p.x, p.y, p.rx + 10, p.ry + 10, 0, 0, Math.PI * 2); c.fillStyle = '#80a38b'; c.fill();
      c.beginPath(); c.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, Math.PI * 2); c.fillStyle = texture(2, 630); c.fill();
      // 固定世界坐标的岸边石草：只在水域外，桥口留出实际通行区。
      const count = Math.ceil(Math.PI * Math.hypot(p.rx, p.ry) / 90);
      for (let i = 0; i < count; i++) {
        const angle = i / count * Math.PI * 2;
        const bx = p.x + (p.rx + 25) * Math.cos(angle), by = p.y + (p.ry + 25) * Math.sin(angle);
        if (BRIDGES.some(b => bx > b.x - 50 && bx < b.x + b.w + 50 && by > b.y - 90 && by < b.y + b.h + 90)) continue;
        sprite(i % 3 ? 'bank-rock' : 'bush', bx, by, 56 + i % 4 * 12, i % 3 * .6);
      }
    }
    // 水域裁出路径图层：真实桥面随后绘制，避免土路横穿水体。
    c.save(); c.beginPath(); c.rect(WORLD.left, WORLD.top, WORLD.width, WORLD.height);
    for (const p of WATERS) { c.moveTo(p.x + p.rx, p.y); c.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, Math.PI * 2); }
    c.clip('evenodd'); c.lineCap = 'round'; c.lineJoin = 'round';
    for (const [i, points] of roads.entries()) {
      const xs = points.map(p => p[0]), ys = points.map(p => p[1]), pad = roadWidth(i) / 2 + 18;
      if (!visible(Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) - Math.min(...xs) + pad * 2, Math.max(...ys) - Math.min(...ys) + pad * 2)) continue;
      path(c, points); c.lineWidth = roadWidth(i) + 22; c.strokeStyle = texture(5, 500); c.stroke();
      path(c, points); c.lineWidth = roadWidth(i) + 6; c.strokeStyle = '#b3ab79'; c.stroke();
      path(c, points); c.lineWidth = roadWidth(i); c.strokeStyle = texture(points.some(([px]) => px > 9690) ? 3 : 1, 440); c.stroke();
    }
    c.restore();
    c.lineCap = 'round'; c.lineWidth = 25; c.strokeStyle = texture(3, 170);
    for (const wall of VILLAGE_WALLS) { path(c, [[wall.a.x, wall.a.y], [wall.b.x, wall.b.y]]); c.stroke(); }
    for (const p of CITY_PROPS.filter(p => p.solid && (p.id.includes('wall') || p.id.includes('edge') || p.id.startsWith('city-fortress-foot-')))) {
      const [width, height] = p.solid!;
      if (visible(p.x - width / 2, p.y - height, width, height)) { c.fillStyle = texture(3, 180); c.fillRect(p.x - width / 2, p.y - height, width, height); }
    }
    for (const b of buildings) {
      const city=art.city?.[b.art],asset=city?.image??art.sprites[b.tower ? 'roof-tower' : 'roof-house'];
      const height=b.w*(city?city.height/city.width:(asset as HTMLImageElement).naturalHeight/(asset as HTMLImageElement).naturalWidth);
      const top = b.art?b.y-height:b.y - b.h / 2 - height / 2;
      if (!visible(b.x - b.w / 2, top, b.w, height)) continue;
      // 建筑以真实占地中心定位；俯视屋顶保持素材比例，避免压成细条。
      c.drawImage(asset, b.x - b.w / 2, top, b.w, height);
    }
    for (const b of BRIDGES) {
      const horizontal = b.w >= b.h, stone = b.x > 4290;
      const length = horizontal ? b.w : b.h, deck = horizontal ? b.h : b.w;
      const asset = art.sprites[stone ? 'bridge-stone' : 'bridge-wood'];
      const totalHeight = deck + (stone ? 120 : 46);
      if (!visible(b.x - 60, b.y - 60, b.w + 120, b.h + 120)) continue;
      // 三段桥梁拉伸只延长中部桥面，柱帽与端栏杆保持自身比例。
      const sourceCap = Math.round(asset.naturalWidth * .2), scale = totalHeight / asset.naturalHeight;
      const cap = Math.min(length / 3, sourceCap * scale);
      c.save(); c.translate(b.x + b.w / 2, b.y + b.h / 2); if (!horizontal) c.rotate(Math.PI / 2);
      c.drawImage(asset, 0, 0, sourceCap, asset.naturalHeight, -length / 2, -totalHeight / 2, cap, totalHeight);
      c.drawImage(asset, sourceCap, 0, asset.naturalWidth - sourceCap * 2, asset.naturalHeight, -length / 2 + cap, -totalHeight / 2, length - cap * 2, totalHeight);
      c.drawImage(asset, asset.naturalWidth - sourceCap, 0, sourceCap, asset.naturalHeight, length / 2 - cap, -totalHeight / 2, cap, totalHeight); c.restore();
    }
    // 手绘冠幅与实景树根登记相连；不再用规则圆盘替代树林。
    for (const p of props) {
      if (treeArts.has(p.art)) {
        const seed = Math.abs(Math.round(p.x * 3 + p.y * 7));
        const name = p.art.includes('pine') ? 'tree-pine' : (['tree-oak', 'tree-dark', 'tree-light'] as const)[seed % 3];
        sprite('bush', p.x - p.w * .18, p.y + p.w * .15, p.w * .65, seed % 5 * .7);
        sprite(name, p.x, p.y - p.w * .06, p.w * 1.16, seed % 7 * .36);
      } else if (p.art === 'rock') sprite('rock', p.x, p.y - p.w * .12, p.w * .8, Math.abs(Math.round(p.x)) % 5 * .5);
      else if (p.art === 'bush') sprite('bush', p.x, p.y, p.w, .3);
    }
    generated++; return tile;
  };
  return {
    draw(c: CanvasRenderingContext2D, camera: MapCamera, size: MapSize) {
      c.save(); c.translate(size.width / 2, size.height / 2); c.scale(camera.scale, camera.scale); c.translate(-camera.x, -camera.y);
      c.beginPath(); c.rect(WORLD.left, WORLD.top, WORLD.width, WORLD.height); c.clip();
      const left = Math.max(WORLD.left, camera.x - size.width / camera.scale / 2), top = Math.max(WORLD.top, camera.y - size.height / camera.scale / 2);
      const right = Math.min(WORLD.right, camera.x + size.width / camera.scale / 2), bottom = Math.min(WORLD.bottom, camera.y + size.height / camera.scale / 2);
      for (let y = Math.floor(top / span) * span; y < bottom; y += span) for (let x = Math.floor(left / span) * span; x < right; x += span) {
        const key = `${mapGeometryRevision}:${x}:${y}`;
        let tile = cache.get(key);
        if (tile) { cache.delete(key); cache.set(key, tile); }
        else { tile = paint(x, y); cache.set(key, tile); }
        c.drawImage(tile, x, y, span, span);
        while (cache.size > limit) { const first = cache.keys().next().value!; const old = cache.get(first)!; cache.delete(first); old.width = old.height = 0; }
      }
      peak = Math.max(peak, cache.size); c.restore();
    },
    stats: () => ({ 生成块数: generated, 缓存块数: cache.size, 缓存峰值: peak }),
  };
}
