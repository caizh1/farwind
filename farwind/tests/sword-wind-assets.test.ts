import {expect,it} from 'vitest';
import sharp from 'sharp';
import {readFile,writeFile,mkdir,mkdtemp,cp,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {swordWindVisual} from '../src/data/animation';
import {SWORD_WIND} from '../src/data/swordWind';
const directory='public/assets/animation/sword-wind';
it('剑风24角色帧和28独立效果帧可加载、透明且无边缘裁切',async()=>{
 const sets=[['hero-sword-wind',160,8,3],['sword-wind-release',128,4,1],['sword-wind-flight',128,6,1],['sword-wind-hit',128,8,1],['sword-wind-dissolve',128,4,1],['sword-wind-ground',128,6,1]] as const;
 for(const [name,size,cols,rows] of sets){const {data,info}=await sharp(`${directory}/${name}.png`).ensureAlpha().raw().toBuffer({resolveWithObject:true});expect([info.width,info.height]).toEqual([size*cols,size*rows]);
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){let visible=0,transparent=0,border=0;for(let y=0;y<size;y++)for(let x=0;x<size;x++){const alpha=data[((row*size+y)*info.width+col*size+x)*4+3];visible+=alpha>16?1:0;transparent+=alpha===0?1:0;if((x===0||y===0||x===size-1||y===size-1)&&alpha>16)border++;}expect(visible,`${name}/${row}/${col}非占位`).toBeGreaterThan(5);expect(transparent).toBeGreaterThan(size*size*.3);expect(border,`${name}/${row}/${col}没有裁切`).toBe(0);}
 }
 const meta=JSON.parse(await readFile('docs/sword-wind/assets/metadata.json','utf8'));expect(meta.角色.地面根).toEqual([80,154]);expect(meta.角色.源根.flat()).toHaveLength(24);expect(meta.角色.源剑柄剑尖.flat()).toHaveLength(24);expect(meta.角色.释放标记).toBe(110);expect(meta.临时).toBe(true);expect(meta.用户美术认可).toBe(false);
});
it('用户认可只覆盖当前上撩和地面图集，不扩大到其余效果或玩法',async()=>{
 const acceptance=JSON.parse(await readFile('docs/sword-wind/assets/acceptance.json','utf8'));
 const meta=JSON.parse(await readFile('docs/sword-wind/assets/metadata.json','utf8'));
 const manifest=JSON.parse(await readFile('public/assets/manifest.json','utf8'));
 expect(acceptance.资源.map((e:any)=>e.ID).sort()).toEqual(['hero-sword-wind','sword-wind-ground']);
 for(const e of acceptance.资源)expect(createHash('sha256').update(await readFile(`${directory}/${e.ID}.png`)).digest('hex')).toBe(e.图集SHA256);
 expect(meta.角色.临时).toBe(false);expect(meta.角色.用户美术认可).toBe(true);
 for(const e of meta.效果){expect(e.临时).toBe(e.名称!=='ground');expect(e.用户美术认可).toBe(e.名称==='ground');}
 for(const e of manifest.资源.filter((r:any)=>r.文件.startsWith('animation/sword-wind/')))expect(e.是否临时).toBe(!acceptance.资源.some((r:any)=>r.ID===e.ID));
 for(const direction of [0,1,2,3] as const){const visual=swordWindVisual(direction,110,{...SWORD_WIND.strike});expect(visual.provisional).toBe(false);expect(visual.weapon?.provisional).toBe(false);}
 expect(meta.临时).toBe(true);expect(meta.用户美术认可).toBe(false);
});
it('重新打包时摘要不匹配或缺少认可记录会恢复临时标记',async()=>{
 const root=await mkdtemp(join(tmpdir(),'farwind-sword-wind-'));
 try{
  for(const path of ['docs/sword-wind/assets','docs/sword-wind/evidence',directory,'src/data'])await mkdir(join(root,path),{recursive:true});
  for(const file of ['hero-down-rise-source.png','hero-up-rise-source.png','hero-side-rise-source.png','ground-source.png','release-source.png','flight-source.png','hit-source.png','dissolve-source.png'])await cp(`docs/sword-wind/assets/${file}`,join(root,'docs/sword-wind/assets',file));
  await cp('public/assets/manifest.json',join(root,'public/assets/manifest.json'));
  const acceptance=JSON.parse(await readFile('docs/sword-wind/assets/acceptance.json','utf8'));
  acceptance.资源.find((r:any)=>r.ID==='hero-sword-wind').图集SHA256='不匹配的旧图集摘要';
  const record=join(root,'docs/sword-wind/assets/acceptance.json');await writeFile(record,JSON.stringify(acceptance));
  const pack=()=>promisify(execFile)(process.execPath,[resolve('tools/pack-sword-wind.mjs')],{cwd:root});
  await pack();
  let meta=JSON.parse(await readFile(join(root,'docs/sword-wind/assets/metadata.json'),'utf8'));
  expect(meta.已认可图集).toEqual(['sword-wind-ground']);expect(meta.角色.临时).toBe(true);
  expect(await readFile(join(root,'src/data/swordWindArt.ts'),'utf8')).toContain('SWORD_WIND_HERO_PROVISIONAL = true');
  await rm(record);await pack();
  meta=JSON.parse(await readFile(join(root,'docs/sword-wind/assets/metadata.json'),'utf8'));expect(meta.已认可图集).toEqual([]);expect(meta.角色.临时).toBe(true);expect(meta.效果.every((e:any)=>e.临时)).toBe(true);
 }finally{await rm(root,{recursive:true,force:true});}
},15000);
