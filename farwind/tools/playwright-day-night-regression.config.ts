import base from "../playwright.config.ts";
import {defineConfig} from "@playwright/test";
const dev=process.env.FARWIND_URL??"http://127.0.0.1:5197",production=process.env.FARWIND_PRODUCTION_URL??"http://127.0.0.1:5199";
export default defineConfig({...base,testDir:"../tests",outputDir:"../.parry-local/day-night/regression-results",workers:1,
 use:{...base.use,headless:true,video:{mode:"on",size:{width:1280,height:720}},launchOptions:{args:["--use-angle=metal","--ignore-gpu-blocklist"]}},
 projects:[{name:"开发",testIgnore:"*production.spec.ts",use:{baseURL:dev}},{name:"生产",testMatch:"*production.spec.ts",use:{baseURL:production}}],
 webServer:[{command:`npm run dev -- --port ${new URL(dev).port||5197}`,url:dev,reuseExistingServer:true},{command:`npm run preview -- --outDir .parry-local/day-night/production --port ${new URL(production).port||5199}`,url:production,reuseExistingServer:true}],reporter:[["list"]]});
