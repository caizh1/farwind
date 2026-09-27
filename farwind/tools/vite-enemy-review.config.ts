import {defineConfig,mergeConfig} from 'vite';
import base from '../vite.config.ts';
// 本地验收沿用正式入口与保存代码，仅隔离数据库，保护常用5173的存档。
export default mergeConfig(base,defineConfig({server:{host:'127.0.0.1',port:5175,strictPort:true},plugins:[{name:'enemy-review-storage',transform(code,id){
  if(!/[/\\]src[/\\]game[/\\]systems[/\\]save\.ts$/.test(id))return;
  const original='indexedDB.open("farwind-save", 1)';if(!code.includes(original))throw Error('正式保存入口已变化，验收存档隔离失败');
  return {code:code.replace(original,'indexedDB.open("farwind-enemy-combat-review", 1)'),map:null};
}}]}));
