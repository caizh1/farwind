import { createServer } from "vite";
import { cp, mkdir, symlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
// 自动化拥有会话默认强制焦点；普通Chrome真实UI通过本地服务报告只读状态。
const root=".water-local/visibility";await mkdir(root,{recursive:true});
for(const p of ["src","index.html","package.json"])await cp(`.water-local/after/${p}`,`${root}/${p}`,{recursive:true});
for(const p of ["node_modules","public"])try{await symlink(resolve(p==="public"?".water-local/after/public":p),`${root}/${p}`);}catch(e){if(e.code!=="EEXIST")throw e;}
const rows=[];
const server=await createServer({root:resolve(root),cacheDir:resolve(`${root}-cache`),server:{host:"127.0.0.1",port:5203,strictPort:true},plugins:[{
 name:"water-visibility-evidence",enforce:"post",
 transform(code,id){if(!id.endsWith("/src/main.ts"))return;return code.replace('window.addEventListener("resize"',`window.__waterGame=game;
 setInterval(()=>{const s=game.scene.getScene("World");if(!s.waterEffects)return;fetch("/water-visibility-sample",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({时间:Date.now(),隐藏:document.hidden,焦点:document.hasFocus(),模式:s.ui.mode,时钟:s.waterEffects.snapshot().time})});},200);
 window.addEventListener("resize"`);},
 configureServer(s){s.middlewares.use("/water-visibility-sample",(req,res)=>{let data="";req.on("data",c=>data+=c);req.on("end",async()=>{
 try{rows.push(JSON.parse(data));await writeFile("docs/water-effects/video/visibility-native-trace.json",JSON.stringify({说明:"普通Chrome真实点击浏览器标签切换；独立本地验证副本仅上报document.hidden与环境时钟，没有Playwright模拟焦点，不派发假事件，不改游戏状态。",记录:rows},null,2));res.statusCode=204;res.end();}catch{res.statusCode=400;res.end();}
 });});}
}]});
await server.listen();server.printUrls();
for(const signal of ["SIGINT","SIGTERM"])process.on(signal,async()=>{await server.close();process.exit(0);});
