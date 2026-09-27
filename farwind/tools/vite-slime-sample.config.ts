import { defineConfig, mergeConfig } from 'vite';
import base from '../vite.config.ts';

// 只在专用样片开发服务中改数据库名称；复用正式校验与保存实现，不修改生产源码。
export default mergeConfig(base, defineConfig({
  server: { host: '127.0.0.1', port: 5174, strictPort: true },
  plugins: [{
    name: 'slime-sample-storage',
    transform(code, id) {
      if (!/[/\\]src[/\\]game[/\\]systems[/\\]save\.ts$/.test(id)) return;
      const original = 'indexedDB.open("farwind-save", 1)';
      if (!code.includes(original)) throw Error('正式保存入口已变化，样片存档隔离未建立，停止启动');
      return { code: code.replace(original, 'indexedDB.open("farwind-slime-animation-sample", 1)'), map: null };
    },
  }],
}));
