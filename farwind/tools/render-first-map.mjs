import {registerHooks} from "node:module";
// 绘图工具直接读取纯地图数据，补全源码中的无扩展名相对导入。
registerHooks({resolve(specifier,context,next){try{return next(specifier,context);}catch(error){if(specifier.startsWith('.'))return next(specifier+'.ts',context);throw error;}}});
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import {
  MASTER_PLAN as plan,
  BUILDING_LOTS,
  PLANNED_POIS,
  ORCHARD_TREES,
  VILLAGE_ANCHORS as anchors,
} from "../src/data/maps/windbell/layout.ts";

const { ROAD_DEFINITIONS } = await import("../src/data/maps/windbell/roads.ts");

const out = "docs/first-map";
mkdirSync(out, { recursive: true });
const esc = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll('"', "&quot;");
const text = (x, y, s, size = 19, color = "#304a40") =>
  `<text x="${x}" y="${y}" fill="${color}" font-size="${size}" font-family="PingFang SC, sans-serif">${esc(s)}</text>`;
const svg = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="#f4eedc"/>${body}</svg>`;
let whole =
  text(64, 63, "风铃村与四方荒野 · 总平面蓝图", 34) +
  text(
    64,
    99,
    "规划画幅 6400 × 4800｜蓝图不代表荒野已经实现｜四向环线与远端连接优先",
    20,
  );
const sc = 0.215,
  tx = 64,
  ty = 145;
const point = ([x, y]) => `${x * sc + tx},${y * sc + ty}`;
whole += `<rect x="${tx}" y="${ty}" width="${plan.width * sc}" height="${plan.height * sc}" rx="18" fill="#d4ddbd"/>`;
for (const r of plan.regions) {
  whole += `<rect x="${tx + r.x * sc}" y="${ty + r.y * sc}" width="${r.w * sc}" height="${r.h * sc}" rx="36" fill="${r.color}"/>`;
  whole +=
    text(tx + (r.x + 90) * sc, ty + (r.y + 190) * sc, r.name, 22) +
    text(
      tx + (r.x + 90) * sc,
      ty + (r.y + 320) * sc,
      `${r.pois}处兴趣点 · ${r.encounters}组遭遇`,
      16,
    );
}
const v = plan.village;
whole += `<rect x="${tx + v.left * sc}" y="${ty + v.top * sc}" width="${(v.right - v.left) * sc}" height="${(v.bottom - v.top) * sc}" rx="28" fill="#e1d3a5" stroke="#84764c" stroke-width="4"/>`;
whole += `<ellipse cx="${tx + 3390 * sc}" cy="${ty + 2500 * sc}" rx="${260 * sc}" ry="${230 * sc}" fill="#73a9b2"/>`;
whole += `<polyline points="${[
  [5560, 1820],
  [5440, 2180],
  [5550, 2580],
  [5410, 3010],
  [5590, 3350],
]
  .map(point)
  .join(
    " ",
  )}" fill="none" stroke="#6b9aa7" stroke-width="18" stroke-linecap="round"/>`;
whole += `<ellipse cx="${tx + 3640 * sc}" cy="${ty + 3940 * sc}" rx="${400 * sc}" ry="${300 * sc}" fill="#95b7a7"/>`;
for (const p of PLANNED_POIS.filter((p) => p.kind === "camp"))
  whole += `<ellipse cx="${tx + p.x * sc}" cy="${ty + p.y * sc}" rx="${270 * sc}" ry="${220 * sc}" fill="#a95f4630" stroke="#a15e47" stroke-dasharray="5 7"/>`;
for (const r of plan.routes) {
  whole += `<polyline points="${r.points.map(point).join(" ")}" fill="none" stroke="${r.kind === "cross" ? "#6c728a" : r.kind === "ring" ? "#e9f5bd" : "#f9eed0"}" stroke-width="${r.kind === "ring" ? 11 : 7}" stroke-linejoin="round" stroke-linecap="round" ${r.kind === "cross" ? 'stroke-dasharray="13 9"' : ""}/>`;
}
whole += text(tx + (v.left + 570) * sc, ty + (v.top + 790) * sc, "风铃村", 31);
for (const b of BUILDING_LOTS) {
  const x = (b.x + plan.villageOffset.x) * sc + tx,
    y = (b.y + plan.villageOffset.y) * sc + ty;
  whole += `<rect x="${x - 13}" y="${y - 15}" width="26" height="20" rx="3" fill="#8d7158"/>`;
}
for (const s of plan.shortcuts) {
  const x = tx + s.x * sc,
    y = ty + s.y * sc;
  whole +=
    `<circle cx="${x}" cy="${y}" r="9" fill="#b5663d" stroke="#fff4d3" stroke-width="3"/>` +
    text(x + 13, y - 12, s.name, 17);
}
whole += text(
  65,
  1213,
  "道路：浅色为主要道路 · 浅绿为近郊环线 · 虚线为远端跨区通路 · 铜色节点为可修复捷径",
  19,
);
whole += text(
  65,
  1246,
  "24处主要兴趣点与32组遭遇包含据点、精英及首领；具体地形与内容仍须逐阶段实机验证。",
  18,
);
for (const [i, p] of PLANNED_POIS.entries()) {
  const x = tx + p.x * sc,
    y = ty + p.y * sc,
    color =
      p.kind === "camp"
        ? "#a25239"
        : p.kind === "elite"
          ? "#705479"
          : p.kind === "boss"
            ? "#673b36"
            : "#eae5cd";
  whole += `<g><title>${esc(p.name)}：${esc(p.purpose)}</title><circle cx="${x}" cy="${y}" r="13" fill="${color}" stroke="#46594b" stroke-width="1.5"/>${text(x - (i < 9 ? 4 : 8), y + 5, i + 1, 13, ["camp", "elite", "boss"].includes(p.kind) ? "#fff3d5" : "#304a40")}</g>`;
  whole += text(
    70 + Math.floor(i / 6) * 360,
    1310 + (i % 6) * 38,
    `${String(i + 1).padStart(2, "0")}  ${p.name}`,
    20,
  );
}
whole += text(
  65,
  1560,
  "红圈为威胁来源及活动范围；紫圈为精英；深红为章节首领。蓝色为水域，浅青为湿地。",
  18,
);
whole += text(
  65,
  1596,
  "村门连接守军岗位；主路兼做撤退路线，铜色节点提供可修复捷径。点位编号对应兴趣点登记表。",
  18,
);
const world = svg(1510, 1640, whole);
writeFileSync(`${out}/master-plan.svg`, world);
await sharp(Buffer.from(world)).png().toFile(`${out}/master-plan.png`);

let village =
  text(60, 58, "风铃村 · 建筑归位与入口蓝图", 32) +
  text(
    60,
    92,
    "村庄局部坐标｜方块为地面占地，铜点为入口｜木工与铁匠归生产院，住宅归西巷，果园靠旅馆",
    18,
  );
const vs = 0.6,
  vx = 50,
  vy = 125;
const at = (x, y) => ({ x: vx + x * vs, y: vy + y * vs });
village += `<rect x="${vx + 80 * vs}" y="${vy + 220 * vs}" width="${2020 * vs}" height="${1600 * vs}" fill="#ccd5ae" stroke="#8b8560" stroke-width="4"/>`;
const pond = at(1280, 1120);
village += `<ellipse cx="${pond.x}" cy="${pond.y}" rx="${260 * vs}" ry="${230 * vs}" fill="#6cabb5"/>`;
village += `<defs><clipPath id="village-clip"><rect x="${vx + 30 * vs}" y="${vy + 80 * vs}" width="${2110 * vs}" height="${2020 * vs}"/></clipPath></defs><g clip-path="url(#village-clip)">`;
for (const road of ROAD_DEFINITIONS)
  village += `<polyline points="${road.points.map(([x, y]) => `${vx + x * vs},${vy + y * vs}`).join(" ")}" fill="none" stroke="#e4d5a7" stroke-width="${road.width * vs}" stroke-linejoin="round" stroke-linecap="round"/>`;
village += "</g>";
for (const [x, y, w, h, label] of [
  [200, 400, 500, 810, "西巷住宅"],
  [410, 1220, 510, 300, "生产作坊"],
  [880, 300, 510, 400, "药师小院"],
  [1400, 330, 650, 430, "训练与防卫"],
  [1580, 1320, 420, 440, "湖边果园"],
]) {
  const p = at(x, y);
  village +=
    `<rect x="${p.x}" y="${p.y}" width="${w * vs}" height="${h * vs}" rx="16" fill="none" stroke="#788966" stroke-dasharray="7 6"/>` +
    text(p.x + 10, p.y - 10, label, 18);
}
const plaza = at(anchors.plaza.x, anchors.plaza.y);
village +=
  `<ellipse cx="${plaza.x}" cy="${plaza.y}" rx="120" ry="58" fill="#e4d5a7"/>` +
  text(plaza.x - 78, plaza.y + 6, "公共广场", 21);
for (const b of BUILDING_LOTS) {
  const p = at(b.x, b.y),
    d = at(b.door.x, b.door.y);
  village +=
    `<rect x="${p.x - (b.solid[0] * vs) / 2}" y="${p.y - b.solid[1] * vs}" width="${b.solid[0] * vs}" height="${b.solid[1] * vs}" rx="8" fill="#c7af81" stroke="#806d49" stroke-width="2"/><path d="M${p.x - (b.solid[0] * vs) / 2},${p.y - b.solid[1] * vs} L${p.x},${p.y - b.solid[1] * vs - 16} L${p.x + (b.solid[0] * vs) / 2},${p.y - b.solid[1] * vs}" fill="none" stroke="#806d49" stroke-width="4"/><circle cx="${d.x}" cy="${d.y}" r="6" fill="#ae603c"/>` +
    text(
      p.x - (b.solid[0] * vs) / 2 + 5,
      p.y - (b.solid[1] * vs) / 2,
      b.name,
      15,
    );
}
for (const t of ORCHARD_TREES) {
  const p = at(t.x, t.y);
  village += `<circle cx="${p.x}" cy="${p.y - 18}" r="24" fill="#72916b"/><rect x="${p.x - 3}" y="${p.y - 6}" width="6" height="13" fill="#8a6748"/>`;
}

for (const [name, x, y] of [
  ["北门", 820, 220],
  ["东门", 2100, 1080],
  ["南门", 900, 1820],
  ["西门旧道", 80, 1430],
]) {
  const p = at(x, y);
  village +=
    `<circle cx="${p.x}" cy="${p.y}" r="13" fill="#f5ecd4" stroke="#806d49" stroke-width="3"/>` +
    text(p.x + 18, p.y + 7, name, 19);
}
village += text(
  60,
  1275,
  "本图用于冻结建筑与功能关系；完整道路、碰撞和生活路线以运行数据及通行校验为准。",
  18,
);
const local = svg(1430, 1310, village);
writeFileSync(`${out}/village-layout.svg`, local);
await sharp(Buffer.from(local)).png().toFile(`${out}/village-layout.png`);
writeFileSync(
  `${out}/BUILDINGS.md`,
  "# 建筑、入口与使用者登记\n\n以下为M1村庄局部坐标，朝向统一为已有素材的南向入口；旅馆另有客房侧门。无室内连接的既有建筑不新增空房间。\n\n| 建筑 | 用途 | 使用者 | 建筑地面锚点 | 外观尺寸／碰撞占地 | 入口 | 室内连接 | 院落与通路 |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n" +
    BUILDING_LOTS.map(
      (b) =>
        `| ${b.name} | ${b.purpose} | ${b.users} | ${b.x}, ${b.y} | ${b.w}×${b.h}／${b.solid[0]}×${b.solid[1]} | ${b.door.x}, ${b.door.y} | ${b.space ?? "无必要连接"} | ${b.courtyard} |`,
    ).join("\n") +
    "\n\n## 标识替换\n\n杂货、铁匠、旅馆、营房保留原交互身份，交互锚点在门前，视觉店招挂在建筑上，不作为地面障碍。训练提示改为教本架；四处开发预留牌移除，空院恢复菜地与苗圃。真正的村门方向牌、遗迹碑文及机关保留。\n",
);
console.log("已生成全图蓝图、村庄布局图及建筑入口登记；均为规划证据。");

writeFileSync(
  `${out}/POIS.md`,
  "# 全图兴趣点规划登记\n\n以下24处为M1蓝图落点与玩法用途，尚未接入运行内容。四据点、三精英与首领均已包含，禁止把规划数量当成实装数量。编号与总图一致。\n\n| 编号 | 稳定身份 | 地点 | 坐标 | 玩法用途 |\n| --- | --- | --- | --- | --- |\n" +
    PLANNED_POIS.map(
      (p, i) =>
        `| ${i + 1} | ${p.id} | ${p.name} | ${p.x}, ${p.y} | ${p.purpose} |`,
    ).join("\n") +
    "\n",
);
