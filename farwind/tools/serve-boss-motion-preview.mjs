import {cpSync,existsSync,mkdirSync,symlinkSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';

// 固定预览源码，避免并发开发的热重载混入同一次动画验收。
const root=resolve('.boss-motion-local/preview');mkdirSync(root,{recursive:true});
cpSync('src',resolve(root,'src'),{recursive:true});
for(const file of ['index.html','combat-art-preview.html','xiaobao-preview.html','xiaobao-combat-preview.html','vite.config.ts','package.json','tsconfig.json'])cpSync(file,resolve(root,file));
for(const dir of ['public','docs','node_modules'])if(!existsSync(resolve(root,dir)))symlinkSync(resolve(dir),resolve(root,dir),'dir');
const child=spawn(process.execPath,[resolve('node_modules/vite/bin/vite.js'),root,'--host','127.0.0.1','--port','5482','--strictPort'],{stdio:'inherit'});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('exit',code=>process.exit(code??0));
