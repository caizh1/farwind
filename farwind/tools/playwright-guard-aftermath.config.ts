import {fileURLToPath} from 'node:url';
import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'../tests',testMatch:'guard-aftermath.spec.ts',workers:1,timeout:240000,
 use:{baseURL:'http://127.0.0.1:5347',viewport:{width:1280,height:720},screenshot:'only-on-failure',launchOptions:{args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']}},
 webServer:{cwd:fileURLToPath(new URL('..',import.meta.url)),command:`node --input-type=module -e 'import {createServer} from "vite"; const server=await createServer({server:{host:"127.0.0.1",port:5347,strictPort:true,hmr:false}}); await server.listen();'`,url:'http://127.0.0.1:5347',reuseExistingServer:false},
 reporter:[['list']],
});
