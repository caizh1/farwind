import {defineConfig} from 'vite';
// 验收端口不热更新，避免其他任务写文件影响固定源码录像。
export default defineConfig({server:{host:'127.0.0.1',port:5255,strictPort:true,hmr:false,watch:null}});
