// 仅无损转码实际截图，逐像素核验；原图移入忽略目录保留，不修图。
import sharp from "sharp";
import {mkdir,readFile,writeFile,rename,readdir} from "node:fs/promises";
import {createHash} from "node:crypto";
const root="docs/day-night/evidence",raw=`.parry-local/day-night/raw-screenshots/${new Date().toISOString().replace(/[:.]/g,"-")}`;
await mkdir(raw,{recursive:true});
const keep=new Set(["m0-plaza","m0-gate","m0-forest","m1-clock","m2-fixed-day","m2-fixed-dusk","m2-fixed-night","m2-fixed-dawn","m2-fixed-forest","m2-fixed-ruins","m2-night-menu","m3-discovery-before","m3-discovery-reward","m3-east-night-battle","m3-east-night-live","m3-midnight","m3-night-reload","m4-inn-before","m4-inn-after","m4-save-failed","m4-active-raid-failed","m4-continue-dawn","m5-matrix-1280-1","m5-matrix-1366-1.5","m5-matrix-1920-2","m5-onend-success","m5-onend-failed","m5-production-dawn","m5-transition-0","m5-transition-1","m5-transition-2","m5-transition-3","m5-journey-night-raid","m5-journey-death-return"]);
let rows=[];
try{rows=JSON.parse(await readFile(`${root}/lossless-conversion.json`,"utf8")).记录;}catch(error){if(error.code!=="ENOENT")throw error;}
for(const file of await readdir(root)){
 if(!file.endsWith(".png"))continue;
 const base=file.slice(0,-4);
 if(keep.has(base)){
  const image=sharp(`${root}/${file}`),pixels=await image.clone().ensureAlpha().raw().toBuffer(),target=`${base}.webp`;
  await image.webp({lossless:true,effort:6}).toFile(`${root}/${target}`);
  const restored=await sharp(`${root}/${target}`).ensureAlpha().raw().toBuffer();
  if(!pixels.equals(restored))throw Error(`无损核验失败：${file}`);
  rows.push({文件:target,来源:file,原图保留:`${raw}/${file}`,转码时间:new Date().toISOString(),像素摘要:createHash("sha256").update(pixels).digest("hex"),逐像素相同:true,尺寸:await image.metadata()});
 }
 await rename(`${root}/${file}`,`${raw}/${file}`);
}
const metadata=JSON.parse(await readFile(`${root}/screenshots.json`,"utf8"));
for(const row of Object.values(metadata))if(keep.has(row.文件.slice(0,-4)))row.文件=row.文件.replace(/\.png$/, ".webp");
await writeFile(`${root}/screenshots.json`,JSON.stringify(metadata,null,2));
await writeFile(`${root}/lossless-conversion.json`,JSON.stringify({说明:"实际截图无损WebP转码；RGBA逐像素相同。未入选、修前与误定位图仅存忽略目录，不当验收证据。",记录:rows},null,2));
