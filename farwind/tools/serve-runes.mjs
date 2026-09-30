import {createServer} from 'vite';
process.env.VITE_DEV_GRANT_SWORD_WIND='0';
// 连续游戏验收时禁止写入引发热重载；源码修改后重启服务，以清除转换缓存。
const server=await createServer({server:{host:'127.0.0.1',port:5196,strictPort:true,watch:{ignored:['**/*']}}});
await server.listen();server.printUrls();
