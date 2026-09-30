// 专项回归只重定向证据写入，保留旧截图、报告及其它任务的文件；不改测试断言。
const fs=require('node:fs'),path=require('node:path'),{syncBuiltinESMExports}=require('node:module');
// 固定到本工程，不重定向素材测试子进程在临时目录中的正常写入。
const project=path.resolve(__dirname,'..'),docs=path.join(project,'docs')+path.sep,root=path.resolve(project,process.env.FARWIND_EVIDENCE_ROOT||'.enemy-local/combat-feel/e2e-evidence');
const mapped=p=>typeof p==='string'&&path.resolve(p).startsWith(docs)?path.join(root,'docs',path.relative(docs,path.resolve(p))):p;
const mkdir=fs.mkdirSync;
for(const key of ['writeFileSync','appendFileSync']){const original=fs[key];fs[key]=function(p,...args){const q=mapped(p);if(q!==p)mkdir(path.dirname(q),{recursive:true});return original.call(this,q,...args);};}
const originalMkdir=fs.mkdirSync;fs.mkdirSync=function(p,...args){return originalMkdir.call(this,mapped(p),...args);};
for(const key of ['writeFile','appendFile']){const original=fs.promises[key];fs.promises[key]=async function(p,...args){const q=mapped(p);if(q!==p)mkdir(path.dirname(q),{recursive:true});return original.call(this,q,...args);};}
const mkdirAsync=fs.promises.mkdir;fs.promises.mkdir=function(p,...args){return mkdirAsync.call(this,mapped(p),...args);};
syncBuiltinESMExports();
