import {defineConfig} from 'vite';

// 录屏、追踪与冻结副本不属于运行源码；其HTML和tsconfig生成不应重载试玩页面。
export default defineConfig({server:{watch:{ignored:
 /(?:^|[/\\])(?:\.sword-wind-local|\.parry-local|\.npc-life-local|\.water-local|test-results|playwright-report)(?:[/\\]|$)/,
}}});
