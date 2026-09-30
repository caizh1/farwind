import {createServer} from 'vite';
process.env.VITE_DEV_GRANT_SWORD_WIND='0';
// 固定当前源码；截图与诊断落盘不触发验收页面重载。修改源码后重启本服务。
const server=await createServer({server:{host:'127.0.0.1',port:5225,strictPort:true,watch:{ignored:['**/*']}}});
await server.listen();server.printUrls();
