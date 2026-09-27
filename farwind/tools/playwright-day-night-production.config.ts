import {defineConfig} from "@playwright/test";
const url=process.env.FARWIND_PRODUCTION_URL??"http://127.0.0.1:5199",port=new URL(url).port||"5199";
export default defineConfig({testDir:"../tests",testMatch:"day-night-production.spec.ts",outputDir:"../.parry-local/day-night/production-results",workers:1,timeout:90000,
 use:{baseURL:url,viewport:{width:1366,height:768},deviceScaleFactor:1.5,trace:"retain-on-failure",launchOptions:{args:["--use-angle=metal","--ignore-gpu-blocklist"]}},
 webServer:{command:`npm run preview -- --outDir .parry-local/day-night/production --port ${port}`,url,reuseExistingServer:true},reporter:[["list"]]});
