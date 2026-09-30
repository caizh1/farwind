import {readFile,writeFile,copyFile,rename,mkdir} from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

// 只撤销清单里的本轮源码；后续改动先拒绝，现有工作与证据保留。
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(await readFile(resolve(root,'docs/combat-feel/delivery-manifest.json'),'utf8'));
const sha=data=>createHash('sha256').update(data).digest('hex');
for(const item of manifest.修改文件){
 const path=resolve(root,item.路径);
 if(relative(root,path).startsWith('..'))throw Error('清单路径越界，停止撤销。');
 if(sha(await readFile(path))!==item.交付摘要)throw Error(`${item.路径} 已有后续变化，停止撤销；请人工合并。`);
 if(item.原始摘要&&sha(await readFile(resolve(root,'.enemy-local/combat-feel/baseline',item.路径)))!==item.原始摘要)throw Error(`${item.路径} 的原始副本摘要不符，停止撤销。`);
}
console.log(`已核对 ${manifest.修改文件.length} 个本轮文件；其他脏树与全部历史证据保留。`);
if(!process.argv.includes('--apply')){console.log('这是只读预检。需要撤销时再次执行并添加 --apply。');}
else{
 const backup=resolve(root,`.enemy-local/combat-feel/reverted-${Date.now()}`);await mkdir(backup,{recursive:true});
 for(const item of manifest.修改文件){
  const path=resolve(root,item.路径),saved=resolve(backup,item.路径);await mkdir(dirname(saved),{recursive:true});
  if(item.原始摘要){await copyFile(path,saved);await copyFile(resolve(root,'.enemy-local/combat-feel/baseline',item.路径),path);}
  else await rename(path,saved);
 }
 await writeFile(resolve(backup,'README.md'),`# 本轮撤销备份\n\n只恢复战斗专项清单中的原有文件；新增实现已移动到本目录。其他已有改动及文档、录像未删除。\n`);
 console.log(`本轮代码已撤销；备份：${backup}`);
}
