import {defineConfig} from 'vite';

// 录屏、追踪与冻结副本不属于运行源码；其HTML和tsconfig生成不应重载试玩页面。
export default defineConfig({build:{rollupOptions:{input:{game:'index.html',xiaobao:'xiaobao-preview.html',xiaobaoCombat:'xiaobao-combat-preview.html'}}},server:{watch:{ignored:
 /(?:^|[/\\])(?:\.[a-z0-9-]+-local|docs[/\\].*[/\\]evidence(?:-[a-z0-9-]+)?|\.first-map-local|\.xiaobao-local|\.sword-wind-local|\.parry-local|\.npc-life-local|\.water-local|test-results|playwright-report)(?:[/\\]|$)/,
}}});
