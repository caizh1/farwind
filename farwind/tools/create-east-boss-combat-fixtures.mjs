// 样本仅定义独立测试初始条件；后续使用正式导入入口与真实键鼠。
import {createServer} from 'vite';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {validate}=await server.ssrLoadModule('/src/game/systems/state.ts');
 const out='docs/east-boss-combat-enhancement/fixtures';await mkdir(out,{recursive:true});
 for(const [name,source,phase] of [['laser-one','skill-6',1],['laser-two','skill-6',2],['scythe','skill-0',1],['cocoon','skill-3',1],['ritual','skill-5',2],['black-hole','skill-6',1]]){
  const s=JSON.parse(await readFile(`docs/east-boss-motion-v2/fixtures/${source}.json`,'utf8'));
  const g=s.encounters.groups['east-thorn-camp'];g.boss.combat.battle.phase=phase;if(phase===2)g.members.find(m=>m.id==='boss-bound-branch').hp=1300;
  s.windGifts.held=[{id:'armor',level:20},{id:'thrift',level:10}];
  if(name==='black-hole'){s.skills.swordWindStage=1;s.skills.legacySwordWind=true;s.windGifts.held.push({id:'blackHole',level:6},{id:'riftSuction',level:5},{id:'riftDuration',level:3});}
  await writeFile(`${out}/${name}.json`,JSON.stringify(validate(s)));
 }
 for(const name of ['parry-scythe','parry-right','obstacle','death']){const s=JSON.parse(await readFile('docs/east-boss-motion-v2/fixtures/'+name+'.json','utf8'));s.windGifts.held=[{id:'armor',level:20}];if(name==='death')s.encounters.groups['east-thorn-camp'].boss.combat.battle.move=6;await writeFile(`${out}/${name}.json`,JSON.stringify(validate(s)));}
 const wall=JSON.parse(await readFile(`${out}/black-hole.json`,'utf8')),obstacle=JSON.parse(await readFile(`${out}/obstacle.json`,'utf8'));Object.assign(wall.player,obstacle.player);Object.assign(wall.encounters.groups['east-thorn-camp'].members.find(m=>m.id==='boss-bound-branch'),obstacle.encounters.groups['east-thorn-camp'].members.find(m=>m.id==='boss-bound-branch'));await writeFile(`${out}/black-hole-wall.json`,JSON.stringify(validate(wall)));
 const sigil=JSON.parse(await readFile(`${out}/ritual.json`,'utf8'));sigil.encounters.groups['east-thorn-camp'].boss.combat.battle.roots=[{x:3700,y:1190,hp:1,kind:'sigil'},{x:3735,y:1190,hp:1,kind:'sigil'}];sigil.encounters.groups['east-thorn-camp'].boss.combat.battle.castSerial=1;await writeFile(`${out}/sigil.json`,JSON.stringify(validate(sigil)));
 await writeFile(`${out}/README.md`,'# 独立初始样本\n\n通过游戏正式导入界面加载；杂兵已清、铁剑与药剂已配备，护甲风赐用于延长观察时间。黑洞样本预先解锁剑风与相关风赐，确定触发只通过开发预览复选框启用。祭印样本预设两处残血祭印，验收正式击破与招式清理分支。它们不是正常旅途通关记录，不覆盖 5173 的用户存档。\n');
 console.log('已生成十二个通过校验的初始样本。');
}finally{await server.close();}
