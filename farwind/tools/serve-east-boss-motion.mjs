// 独立验收端口：只接收本页录制的两个固定文件，不修改游戏状态或旅途存档。
import {createServer} from 'vite';
import {createWriteStream} from 'node:fs';
import {resolve} from 'node:path';
import {pipeline} from 'node:stream/promises';
const server=await createServer({server:{host:'127.0.0.1',port:5366,strictPort:true},plugins:[{name:'本机动作验收记录',configureServer(vite){vite.middlewares.use(async(req,res,next)=>{if(!req.url?.startsWith('/__east-motion-evidence/'))return next();const name=req.url.slice('/__east-motion-evidence/'.length);if(req.method!=='POST'||!['gameplay-latest.json','gameplay-latest.webm'].includes(name)||req.headers.origin!=='http://127.0.0.1:5366'){res.statusCode=403;return res.end()}try{await pipeline(req,createWriteStream(resolve('docs/east-boss-motion-v2/evidence',name)));res.end('已保存')}catch{res.statusCode=500;res.end('保存失败')}})}}]});await server.listen();server.printUrls();
