import {createServer} from 'vite';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const evidence=fileURLToPath(new URL('.',import.meta.url));
const root=process.env.FARWIND_PERF_ROOT??fileURLToPath(new URL('../../../',import.meta.url));
const probe=await readFile(evidence+'bottleneck-probe.js','utf8');
const save=await readFile('/Users/archer/Downloads/farwind-save (18).json','utf8');
const server=await createServer({root,configFile:false,server:{host:'127.0.0.1',port:5261,strictPort:true},plugins:[{name:'瓶颈分项隔离诊断',enforce:'pre',configureServer(server){server.middlewares.use(async(req,res,next)=>{if(req.url==='/diagnostic-save'){res.setHeader('Content-Type','application/json');res.end(save);}else if(req.url==='/bottleneck-visual'&&req.method==='POST'){let text='';for await(const part of req)text+=part;const data=JSON.parse(text);await writeFile(evidence+'visual-equality.json',JSON.stringify(data.结果,null,2));await writeFile(evidence+'shadow-before.png',Buffer.from(data.之前.split(',')[1],'base64'));await writeFile(evidence+'shadow-after.png',Buffer.from(data.之后.split(',')[1],'base64'));res.end('已保存像素对照');}else if(req.url==='/bottleneck-result'&&req.method==='POST'){let content='';for await(const part of req)content+=part;JSON.parse(content);await writeFile(evidence+'bottleneck-latest.json',content);res.end('已保存');}else next();});},transform(code,id){if(id.endsWith('/src/game/scenes/World.ts'))return code+'\n'+probe;}}]});
await server.listen();console.log('瓶颈诊断服务已启动：http://127.0.0.1:5261/');
