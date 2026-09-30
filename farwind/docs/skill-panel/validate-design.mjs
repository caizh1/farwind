// 阶段A交付核对：检查图片尺寸、样例边界与正式模块隔离，不运行游戏测试。
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { currentSkills, capacitySkills, states } from './sample-data.js';
const root=path.dirname(fileURLToPath(import.meta.url));
const images=[
  ['scheme-a.png',1440,900],['scheme-b.png',1440,900],['scheme-c.png',1440,900],
  ['scheme-a-few.png',1440,900],['scheme-a-capacity.png',1440,900],['scheme-a-compact.png',800,600],
  ['scheme-a-three-way.png',1440,900],['state-board.png',1440,900],['scheme-a-compact-detail.png',800,600],
];
const result=[];
for(const [file,width,height] of images) {
  const metadata=await sharp(path.join(root,file)).metadata();
  assert.equal(metadata.width,width,`${file}宽度不正确`);
  assert.equal(metadata.height,height,`${file}高度不正确`);
  result.push({文件:file,宽:width,高:height,核对:'通过'});
}
assert.equal(currentSkills.length,4,'真实能力目录数量错误');
assert.equal(capacitySkills.length,26,'容量样例数量错误');
assert(capacitySkills.every(skill=>skill.planned&&skill.current==='设计样例，非已实装'),'规划条目缺少边界标记');
assert.equal(states.grant.stage,0,'测试授予不能计为永久掌握');
assert.equal(states.trial.stage,3,'教学试用不能覆盖正式阶段');
assert.equal(states.waiting.stage,0,'未满足前置不能激活高阶');
for(const file of ['preview.js','sample-data.js','demonstration.js','export.js']) {
  const text=await fs.readFile(path.join(root,file),'utf8');
  assert(!/\b(?:indexedDB|localStorage|sessionStorage)\s*[.(]/.test(text),`${file}访问了持久化数据`);
  assert(!/from\s*['"][^'"]*(?:src\/|systems\/|scenes\/)/.test(text),`${file}导入了游戏模块`);
}
for(const file of ['preview.css','state-board.html','index.html']) assert(!/position\s*:\s*absolute/.test(await fs.readFile(path.join(root,file),'utf8')),`${file}存在绝对定位图标布局`);
await fs.writeFile(path.join(root,'artifact-validation.json'),JSON.stringify({说明:'设计交付核对，不代表正式游戏接入验收。',结果:'通过',图片:result,样例隔离:'通过',图标文档流:'通过'},null,2));
console.log(`设计交付核对通过：${images.length}张图片尺寸正确；规划样例、临时状态、存档隔离与图标文档流检查通过。`);
