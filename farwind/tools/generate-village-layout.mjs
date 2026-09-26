import { createServer } from "vite";
import { mkdir, writeFile } from "node:fs/promises";
const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
});
const world = await server.ssrLoadModule("/src/data/world.ts");
const village = await server.ssrLoadModule("/src/data/village.ts");
const { roads, roadWidth, props, POND, BRIDGES, villageAreas, WORLD } = world;
const {
  VILLAGE_PORTALS,
  VILLAGE_WALLS,
  RESERVED_PARCELS,
  DEFENSE_LAYOUT,
  VILLAGE_BOUNDS,
} = village;
const escape = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll('"', "&quot;");
const line = (points, color, width, more = "") =>
  `<polyline points="${points.map((p) => `${p.x ?? p[0]},${p.y ?? p[1]}`).join(" ")}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${more}/>`;
const text = (x, y, s, more = "") =>
  `<text x="${x}" y="${y}" font-size="27" paint-order="stroke" stroke="#f2eedc" stroke-width="7" fill="#263e33" ${more}>${escape(s)}</text>`;
const layers = [];
layers.push(
  `<g id="base"><rect width="2460" height="2200" fill="#a7bd8b"/><rect x="2100" width="360" height="2200" fill="#78997c"/><rect x="80" width="2020" height="220" fill="#b6b087"/><rect x="80" y="1820" width="2020" height="380" fill="#b6b087"/>${roads.map((p, i) => line(p, "#cfba8d", roadWidth(i))).join("")}<ellipse cx="${POND.x}" cy="${POND.y}" rx="${POND.rx}" ry="${POND.ry}" fill="#69a8ad"/>${BRIDGES.map((b) => `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="#af8353"/>`).join("")}</g>`,
);
// 复用真实素材表现已有锚点；规划图不充当运行画面或视觉验收。
const existing = props
  .filter(
    (p) =>
      p.x < 2200 &&
      !p.frame &&
      [
        "house",
        "shop",
        "tower",
        "tree",
        "pink",
        "well",
        "elder",
        "healer",
        "carpenter",
        "berry",
        "wood",
      ].includes(p.art),
  )
  .sort((a, b) => a.y - b.y);
layers.push(
  `<g id="existing">${existing.map((p) => `<image href="../../../public/assets/${p.art}.png" x="${p.x - p.w / 2}" y="${p.y - p.h}" width="${p.w}" height="${p.h}"><title>${escape(p.id)}</title></image>`).join("")}${villageAreas.map((p) => text(p.x, p.y + 80, p.name, 'text-anchor="middle"')).join("")}${text(1370, 1110, "池塘与两桥")}${text(2150, 1250, "森林主线")}${text(590, 110, "北部有限缓冲区")}${text(710, 2050, "南部有限缓冲区")}</g>`,
);
layers.push(
  `<g id="boundaries">${VILLAGE_WALLS.map((w) => line([w.a, w.b], "#715237", 20)).join("")}${VILLAGE_PORTALS.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="32" fill="${p.open ? "#e3f4da" : "#c88a73"}" stroke="#453e2e" stroke-width="5"/>${text(p.x + (p.axis === "x" ? 50 : 0), p.y - 48, p.open ? p.name : "西门：实体封闭", p.axis === "y" ? 'text-anchor="middle"' : "")}`).join("")}</g>`,
);
layers.push(
  `<g id="parcels">${RESERVED_PARCELS.map((p, i) => `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="12" fill="#f2eab766" stroke="#74803b" stroke-width="6" stroke-dasharray="12 8"/>${text(p.x + 18, p.y + 45, `${i + 1} ${p.name}`)}`).join("")}</g>`,
);
layers.push(
  `<g id="defense">${DEFENSE_LAYOUT.map((d) => {
    const p = VILLAGE_PORTALS.find((p) => p.id === d.portalId);
    const side =
      p.id === "east-gate" ? [1, 0] : p.id === "north-gate" ? [0, -1] : [0, 1];
    const sector = [
      d.tower,
      {
        x: d.tower.x + side[0] * 370 + side[1] * 180,
        y: d.tower.y + side[1] * 370 + side[0] * 180,
      },
      {
        x: d.tower.x + side[0] * 370 - side[1] * 180,
        y: d.tower.y + side[1] * 370 - side[0] * 180,
      },
    ];
    return `<polygon points="${sector.map((p) => `${p.x},${p.y}`).join(" ")}" fill="#5d91c92b" stroke="#4479ae" stroke-width="4" stroke-dasharray="12 7"/><circle cx="${d.tower.x}" cy="${d.tower.y}" r="29" fill="#4479ae"/>${text(d.tower.x + 35, d.tower.y - 25, "塔位（待实现）")}${d.posts.map((p, i) => `<circle cx="${p.x}" cy="${p.y}" r="16" fill="#9b602f"/><title>${d.portalId}-guard-${i + 1}</title>`).join("")}${line(d.route, "#b04f37", 10, 'marker-end="url(#arrow)"')}<rect x="${p.x - 180}" y="${p.y - 180}" width="360" height="360" rx="28" fill="none" stroke="#bb653d" stroke-width="4" stroke-dasharray="8 10"/>`;
  }).join("")}</g>`,
);
const markup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2460 2200" role="img" aria-label="一期村庄坐标与防御预留图"><defs><marker id="arrow" markerWidth="9" markerHeight="9" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="none" stroke="#b04f37" stroke-width="1.5"/></marker></defs>${layers.join("")}<g>${line(
  [
    { x: 90, y: 2130 },
    { x: 290, y: 2130 },
  ],
  "#263e33",
  6,
)}${text(90, 2100, "200 世界像素")}${text(1910, 90, "北 ↑")}</g></svg>`;
const root = "docs/village-defense/m1";
await mkdir(root, { recursive: true });
await writeFile(`${root}/layout.svg`, markup);
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>远风之地：一期布局</title><style>body{margin:0;background:#ece8d9;color:#263e33;font:16px/1.6 system-ui}main{max-width:1300px;margin:auto;padding:24px}.controls{display:flex;gap:20px;flex-wrap:wrap;padding:16px;background:#fff8}.grid{display:grid;grid-template-columns:minmax(0,3fr) minmax(260px,1fr);gap:24px}svg{width:100%;height:auto;background:#a7bd8b}table{border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid #c7c5b9;text-align:left}a{color:#326863}@media(max-width:850px){.grid{grid-template-columns:1fr}}</style><main><h1>远风之地 · 一期村庄布局</h1><p>已实现区域、道路、三门与闭合边界；蓝色塔位、棕色岗位、射界和红色来袭方向为未来防御叠层。本图沿用正式坐标与已有素材，只负责空间审阅，不能代替实机截图。</p><div class="controls">${[
  ["existing", "已有锚点"],
  ["boundaries", "村界和门"],
  ["parcels", "预留小院"],
  ["defense", "未来防御"],
]
  .map(
    ([id, name]) =>
      `<label><input type="checkbox" checked data-layer="${id}"> ${name}</label>`,
  )
  .join(
    "",
  )}<a href="review.html">固定视口前后对照</a></div><div class="grid"><div>${markup}</div><aside><p>世界仍为4200×2200，图面只展示西部2460×2200。现有七区、池塘和森林遗迹位置保持。道路主干170，普通支路115，特殊小径80世界像素。</p><table><tr><th>通路</th><th>柱脚后净宽</th></tr><tr><td>北／南门</td><td>154像素</td></tr><tr><td>东门</td><td>170像素</td></tr><tr><td>西侧预留门</td><td>封闭</td></tr></table><p>门口中央与岗位保留净空；红色虚线范围为规划禁刷区，当前没有怪物生成调度。射界仅为方向初值，尚无弓手或箭矢碰撞验收。</p><p>M2在广场与生活巷接入商业服务；新住宅和营房需要逐栋完成占地、前院与道路审查，再写入世界。这里没有把未确定的建筑占地伪装成已完成布局。</p><p>四处小院拥有稳定编号。可建设面积及15%～20%预留比例待建筑占地测量后确认。</p><p>素材状态：复用旧手绘资源；新增竖栏为候选。全村最终美术尚未验收。</p></aside></div><script>document.querySelectorAll('[data-layer]').forEach(c=>c.addEventListener('change',()=>document.getElementById(c.dataset.layer).style.display=c.checked?'':'none'));</script></main></html>`;
await writeFile(`${root}/layout.html`, html);
await writeFile(
  `${root}/layout-data.json`,
  JSON.stringify(
    {
      世界: WORLD,
      村界: VILLAGE_BOUNDS,
      出口: VILLAGE_PORTALS,
      预留院: RESERVED_PARCELS,
      未来防御: DEFENSE_LAYOUT,
      说明: "从正式数据导出；岗位与塔位仅为规划，未生成守卫或炮台。",
    },
    null,
    2,
  ),
);
await server.close();
console.log("布局图及可分离叠层已生成。");
