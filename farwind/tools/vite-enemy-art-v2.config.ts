import {defineConfig,mergeConfig} from 'vite';
import base from '../vite.config.ts';
// 复用当前工作树与正式入口，仅隔离验收存档。
export default mergeConfig(base,defineConfig({server:{host:'127.0.0.1',port:5176,strictPort:true,watch:{ignored:['**/.enemy-local/**']}},plugins:[{name:'enemy-art-v2-storage',transform(code,id){
 if(!/[/\\]src[/\\]game[/\\]systems[/\\]save\.ts$/.test(id))return;
 const declaration=/export const SAVE_DATABASE =[^;]+;/;
 if(!code.includes('indexedDB.open(SAVE_DATABASE, 1)')||!declaration.test(code))throw Error('保存入口变化，无法安全隔离验收存档');
 return {code:code.replace(declaration,"export const SAVE_DATABASE = 'farwind-enemy-art-v2-review';"),map:null};
}}]}));
